# Multi-Department Routing - Testing Guide

## Quick Start: Local Testing

### Prerequisites
- Docker with PostgreSQL, Redis running (or local instances)
- Node.js 18+
- Backend and Frontend source code

### Step 1: Start Backend
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate deploy  # Apply migrations
npm run start:dev               # Start on http://localhost:4000
```

### Step 2: Start Frontend  
```bash
cd frontend
npm install
npm run dev                      # Start on http://localhost:3100
```

### Step 3: Create Test Company & Users
```bash
# Login as admin (if seeded)
POST /api/auth/login
{
  "email": "admin@test.com",
  "password": "password123"
}

# Create test company (via seed or UI)
# This auto-creates 4 departments:
# - Administrativo (isRoot=true, #1E3A5F)
# - Laboratorio (#2E86AB)  
# - Comercial (#27AE60)
# - Financeiro (#E67E22)

# Create test users in each department
POST /api/users
{
  "name": "Agent Laboratorio",
  "email": "lab@test.com",
  "password": "password123",
  "role": "AGENT",
  "departmentId": "<laboratorio-id>"  # Get from GET /api/departments
}
# Repeat for comercial, financeiro agents
```

---

## Test Scenarios

### Scenario 1: Greeting Bot Flow
**Objective:** Verify new contact receives menu and routes correctly

**Steps:**
1. Open another browser/incognito window
2. Go to WhatsApp simulator or mock API endpoint
3. Send message as new contact (e.g., phone: 5521987654321)
4. **Expected:** Backend receives message, creates conversation with flowState=GREETING
5. **Expected:** Bot sends greeting with menu options

**Verification Queries:**
```sql
-- Check conversation was created
SELECT id, status, flowState, greetingSentAt, departmentId 
FROM conversations 
WHERE customerPhone = '5521987654321';

-- Check greeting message was saved
SELECT id, content, isBot, direction 
FROM messages 
WHERE conversationId = '<conv-id>' AND isBot = true
ORDER BY sentAt DESC;
```

**cURL Test:**
```bash
# If using API endpoint to simulate WhatsApp message:
curl -X POST http://localhost:4000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5521987654321",
            "body": "Ola",
            "timestamp": "'$(date +%s)'",
            "id": "wamid.test.'$(date +%s)'"
          }],
          "metadata": {
            "phone_number_id": "'$WHATSAPP_PHONE_NUMBER_ID'",
            "display_phone_number": "55 21 1234-5678"
          }
        }
      }]
    }]
  }'
```

---

### Scenario 2: Menu Selection & Routing
**Objective:** Verify menu choice routes to correct department

**Steps:**
1. From scenario 1, contact replies "3" (or "comercial")
2. **Expected:** Conversation.departmentId set to comercial
3. **Expected:** Conversation.flowState = DEPARTMENT_SELECTED
4. **Expected:** Customer receives "Conectando com atendente..." message
5. **Expected:** Comercial agents see conversation in their list

**Verification Queries:**
```sql
-- Check routing
SELECT id, departmentId, flowState, timeoutAt, assignedUserId
FROM conversations 
WHERE customerPhone = '5521987654321';
-- Answer: 
-- departmentId should be <comercial-id>
-- flowState should be 'DEPARTMENT_SELECTED' or 'ASSIGNED'
-- timeoutAt should be ~3 min from now

-- Check messages sent
SELECT content, isBot FROM messages 
WHERE conversationId = '<conv-id>'
ORDER BY sentAt DESC LIMIT 5;
-- Should see: greeting, connection message
```

**WebSocket Verification:**
```javascript
// In browser console, after agent logs in to commercail dept
const socket = getSocket();
socket.on('conversation-queued', (data) => {
  console.log('New conversation in queue:', data);
});
socket.on('conversation-assigned', (data) => {
  console.log('Conversation assigned to me:', data);
});
```

---

### Scenario 3: Agent Assignment Strategy
**Objective:** Verify round-robin assignment to lowest-load agent

**Setup:**
1. Create 3 agents in Comercial department: Agent A, Agent B, Agent C
2. All agents are ONLINE
3. Create 5 test contacts, each selects "Comercial"

**Expected Behavior:**
- Contact 1 → Agent A (0 conversations)
- Contact 2 → Agent B (0 conversations)  
- Contact 3 → Agent C (0 conversations)
- Contact 4 → Agent A (now has 1, vs B:1, C:1 - tie, first selected)
- Contact 5 → Agent B (1 conversation, same as A and C)

**Verification:**
```sql
SELECT 
  u.name as agent_name,
  COUNT(c.id) as open_conversations,
  c.id, c.customerPhone
FROM users u
LEFT JOIN conversations c ON u.id = c.assignedUserId 
  AND c.status = 'OPEN'
  AND c.flowState IN ('ASSIGNED', 'DEPARTMENT_SELECTED')
WHERE u.departmentId = '<comercial-id>'
GROUP BY u.id, u.name, c.id, c.customerPhone
ORDER BY u.name, c.customerPhone;
```

**Socket Verification:**
```javascript
// In each agent's browser:
socket.on('conversation-assigned', (data) => {
  console.log('Assigned conversation:', data.conversationId);
});
// Agent A should get contacts 1, 4
// Agent B should get contacts 2, 5
// Agent C should get contact 3
```

---

### Scenario 4: Timeout & Escalation
**Objective:** Verify automatic escalation after 3 minutes of no response

**Setup:**
1. Assign conversation to Comercial (from Scenario 2)
2. Note timeoutAt = conversation.createdAt + 3 minutes
3. Wait OR manually run the cron job

**Steps:**
1. Do NOT assign agent to this conversation (leave it in DEPARTMENT_SELECTED)
2. Wait 3+ minutes
3. **Expected:** Cron job (every 30s) triggers checkTimeoutAndRedirect()
4. **Expected:** Conversation.departmentId changes to Administrativo
5. **Expected:** Conversation.flowState = TIMEOUT_REDIRECT or ASSIGNED
6. **Expected:** Customer receives "Redirecionando para Administrativo..." message
7. **Expected:** Administrativo agents see the conversation

**Verification Queries:**
```sql
-- Before timeout:
SELECT id, departmentId, flowState, timeoutAt, assignedUserId
FROM conversations 
WHERE id = '<conv-id>';
-- Answer: departmentId=comercial, flowState=DEPARTMENT_SELECTED, timeoutAt=future

-- After timeout (wait 3+ min or trigger cron manually):
SELECT id, departmentId, flowState, timeoutAt, assignedUserId
FROM conversations 
WHERE id = '<conv-id>';
-- Answer: departmentId=<admin-id>, flowState=TIMEOUT_REDIRECT or ASSIGNED

-- Check escalation message:
SELECT content FROM messages 
WHERE conversationId = '<conv-id>' AND isBot = true
ORDER BY sentAt DESC LIMIT 1;
-- Should see: "Redirecionando para..."
```

**Manual Cron Trigger** (for faster testing):
```bash
# In PostgreSQL:
SELECT * FROM conversations 
WHERE flowState = 'DEPARTMENT_SELECTED' AND timeoutAt < NOW();

-- If nothing, set timeoutAt to past:
UPDATE conversations 
SET timeoutAt = NOW() - INTERVAL '5 minutes'
WHERE id = '<conv-id>';

-- Then the next cron cycle (or manually call departmentRoutingService.checkTimeoutAndRedirect())
```

---

### Scenario 5: Data Isolation by Department
**Objective:** Verify agents only see their own department conversations

**Setup:**
1. Login as Agent-Lab (laboratorio department)
2. Login as Agent-Comercial (comercial department)  
3. Create conversations routed to both departments

**Test 1: List Endpoint Filtering**
```bash
# As Agent-Lab:
curl -H "Authorization: Bearer <lab-token>" \
  http://localhost:4000/api/conversations

# Expected: Only conversations with departmentId=laboratorio

# As Agent-Comercial:
curl -H "Authorization: Bearer <comercial-token>" \
  http://localhost:4000/api/conversations

# Expected: Only conversations with departmentId=comercial

# As Admin:
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:4000/api/conversations

# Expected: ALL conversations from all departments
```

**Test 2: Direct Access (403 on Cross-Dept Access)**
```bash
# Get a comercial conversation ID
comercial_conv_id="<conv-id-from-comercial>"

# As Agent-Lab, try to access:
curl -H "Authorization: Bearer <lab-token>" \
  http://localhost:4000/api/conversations/$comercial_conv_id

# Expected: 403 Forbidden
# Response: { error: "Acesso negado a esta conversa" }

# As Agent-Comercial, access same conversation:
curl -H "Authorization: Bearer <comercial-token>" \
  http://localhost:4000/api/conversations/$comercial_conv_id

# Expected: 200 OK with conversation data

# As Admin, access same conversation:
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:4000/api/conversations/$comercial_conv_id

# Expected: 200 OK with conversation data
```

**Test 3: WebSocket Message Isolation**
```javascript
// Frontend: Open DevTools → Application → WebSocket

// As Agent-Lab:
// Should receive 'message-received' ONLY for laboratorio conversations
socket.on('message-received', (data) => {
  console.log('Message in:', data.conversationId);
  // Fetch conversation to verify departmentId=laboratorio
});

// As Agent-Comercial:
// Should receive 'message-received' ONLY for comercial conversations
```

**Verification:**
```sql
-- Verify department assignments:
SELECT u.name, u.departmentId, COUNT(c.id) as assigned_convs
FROM users u
LEFT JOIN conversations c ON u.id = c.assignedUserId AND c.status = 'OPEN'
WHERE u.role = 'AGENT'
GROUP BY u.id, u.name, u.departmentId;
```

---

### Scenario 6: Agent Status & Heartbeat
**Objective:** Verify agent status changes broadcast correctly

**Setup:**
1. Login as Agent-Lab
2. Open another tab as Agent-Comercial
3. Both in same company

**Steps:**
1. Agent-Lab changes status: Online → Busy → Offline
2. **Expected Lab sees:** Own status updated in dropdown
3. **Expected:** Comercial does NOT see Lab's status (they're in different depts)
4. Create second Lab agent (Agent-Lab2)
5. **Expected:** Agent-Lab2 see Agent-Lab's status changes in real-time

**Verification:**
```javascript
// In Agent-Lab2's browser:
socket.on('agent-status-changed', (data) => {
  console.log('Agent status changed:', data.userId, data.status);
  // Should get updates from other lab agents ONLY
});

// Make API call to verify:
fetch('http://localhost:4000/api/departments/<lab-id>/agents')
  .then(r => r.json())
  .then(agents => {
    console.table(agents.map(a => ({ 
      name: a.name, 
      status: a.onlineStatus,
      openConversations: a._count.assignedConversations 
    })));
  });
```

**Heartbeat Test:**
```javascript
// Frontend should emit 'heartbeat' every 60s
// In browser console:
socket.on('*', (event, data) => {
  if (event === 'heartbeat') {
    console.log('Heartbeat sent to server');
  }
});

// Verify server received it:
// SELECT lastHeartbeatAt FROM users WHERE id = '<agent-id>';
// Should be within last 60s
```

**Offline Timeout Test:**
```javascript
// Simulate 2+ min inactivity by not emitting heartbeat
// (disable the heartbeat setInterval in frontend for testing)
// Or just wait 2 minutes without any activity

// Then server cron job runs (every 1 min):
// SELECT onlineStatus FROM users WHERE id = '<agent-id>';
// Should be 'OFFLINE' after 2 min of no heartbeat
```

---

### Scenario 7: Conversations Reassignment on Agent Offline
**Objective:** Verify conversations reassigned when agent goes offline

**Setup:**
1. Create 3 conversations assigned to Agent-Lab
2. Agent-Lab is ONLINE

**Steps:**
1. Agent-Lab goes OFFLINE (via status dropdown or beforeunload)
2. **Expected:** Agent goes offline
3. **Expected:** The 3 conversations have assignedUserId cleared
4. **Expected:** Conversations reassigned to other available Lab agents (if any)
5. **Expected:** Emit 'conversation-transferred' to company room

**Verification Queries:**
```sql
-- Before Agent-Lab goes offline:
SELECT id, assignedUserId, flowState FROM conversations 
WHERE assignedUserId = '<agent-lab-id>' AND status = 'OPEN';

-- After Agent-Lab goes offline:
SELECT id, assignedUserId, flowState FROM conversations 
WHERE assignedUserId = '<agent-lab-id>' AND status = 'OPEN';
-- Should be empty (reassigned)

-- Check if reassigned:
SELECT id, assignedUserId FROM conversations 
WHERE id IN ('<conv1-id>', '<conv2-id>', '<conv3-id>');
-- Should have new assignedUserId (if another agent available in dept)
-- OR should have assignedUserId = NULL, flowState = 'DEPARTMENT_SELECTED'
```

---

### Scenario 8: Bot Message Display in UI
**Objective:** Verify bot messages show different styling

**Setup:**
1. Start new conversation, receive greeting

**Steps:**
1. Open chat window
2. **Expected:** Greeting message appears with different background (gray)
3. **Expected:** Greeting uses italic text
4. **Expected:** Greeting shows bot icon or no avatar
5. **Expected:** Normal agent messages use colored bubbles
6. **Expected:** Status indicators show for agent messages (sent, delivered, read)

**Frontend Inspection:**
```javascript
// In DevTools, inspect greeting message element:
// - Background color: gray (#f3f4f6 or similar)
// - Text: italic
// - No agent avatar or robot icon shown
// - Status icons (checkmarks) NOT shown for bot messages

// Verify message object in store:
window.__STORE__.messages['<conv-id>'].forEach(msg => {
  if (msg.isBot) {
    console.log('Bot message:', msg.content);
    console.assert(msg.isBot === true);
  }
});
```

---

## Debugging Checklist

### Backend Issues

**Migrations not applied:**
```bash
cd backend
npm run prisma:migrate deploy
npm run prisma:generate
```

**WebSocket not connecting:**
```bash
# Check CORS
grep CORS src/modules/websocket/websocket.gateway.ts

# Verify frontend URL matches
grep FRONTEND_URL .env

# Test WebSocket endpoint
wscat -c ws://localhost:4000
```

**Cron jobs not running:**
```bash
# Check logs:
docker compose logs -f backend | grep -i "cron\|timeout\|heartbeat"

# Verify ScheduleModule in AppModule
grep -A 5 "ScheduleModule" src/app.module.ts

# Check cron service is provided in module
grep -A 10 "DepartmentRoutingCron" src/modules/departments/departments.module.ts
```

**Conversation not routing:**
```sql
-- Check flow engine logs:
SELECT content FROM messages WHERE isBot = true ORDER BY sentAt DESC LIMIT 5;

-- Verify department exists:
SELECT id, slug, name FROM departments ORDER BY createdAt DESC;

-- Check menu processing:
-- Try to trace through FlowEngineService.processMenuChoice logic
```

### Frontend Issues

**AgentStatusBar not showing:**
```javascript
// Check component is mounted:
document.querySelector('[data-testid="agent-status-bar"]');

// Check auth store:
console.log(useAuthStore.getState().user);
// Should have onlineStatus property

// Check socket connection:
const socket = getSocket();
console.log(socket?.connected);
```

**Conversations showing for wrong department:**
```javascript
// Check current user department:
console.log(useAuthStore.getState().user.departmentId);

// Check conversations payload:
fetch('http://localhost:4000/api/conversations', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json()).then(convs => {
  console.table(convs.map(c => ({
    id: c.id,
    department: c.department?.name,
    assigned: c.assignedUser?.name
  })));
});
```

**WebSocket events not received:**
```javascript
// Set up debug listener:
socket.on('*', (event, ...args) => {
  console.log(`[socket] ${event}`, args);
});

// Check room joins:
socket.on('connect', () => {
  console.log('Rooms:', socket.adapter.rooms);
});
```

---

## Performance Testing

### Load Test: 100 Conversations
```javascript
// Send 100 messages to backend in quick succession
for (let i = 0; i < 100; i++) {
  fetch('/api/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: conversation_id,
      content: `Test message ${i}`,
      type: 'TEXT'
    })
  });
}

// Monitor:
// - Response times (should be < 200ms)
// - Database connection pool (should not saturate)
// - Memory usage (should not spike excessively)
```

### WebSocket Broadcast Test
```bash
# Open 10 browser tabs as different department agents
# Send message in one conversation
# Measure time for all to receive 'message-received' event
# Should be < 100ms for all clients
```

---

## Automated Test Commands

```bash
# Backend unit tests
cd backend && npm run test

# Backend e2e tests  
cd backend && npm run test:e2e

# Frontend tests (if configured)
cd frontend && npm run test

# Type checking
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Linting
cd backend && npm run lint
cd frontend && npm run lint
```

---

## Test Data Reset

```sql
-- WARNING: DESTRUCTIVE - clears all conversations for a company

DELETE FROM messages 
WHERE companyId = '<company-id>';

DELETE FROM conversations 
WHERE companyId = '<company-id>';

DELETE FROM assignments 
WHERE conversationId NOT IN (
  SELECT id FROM conversations
);

-- Reset conversation status:
UPDATE conversations SET 
  flowState = 'GREETING',
  departmentId = NULL,
  assignedUserId = NULL,
  greetingSentAt = NULL,
  timeoutAt = NULL
WHERE companyId = '<company-id>';
```

---

## Summary

This testing guide covers:
- ✅ Greeting bot flow verification
- ✅ Menu selection routing
- ✅ Agent assignment algorithm
- ✅ Timeout escalation
- ✅ Department data isolation
- ✅ Agent status updates
- ✅ Conversation reassignment
- ✅ Bot message styling
- ✅ Debugging techniques
- ✅ Performance benchmarks

**Expected Time to Complete All Tests:** 2-3 hours for manual testing

**Automated Test Coverage:** Unit tests for core services, E2E tests available

