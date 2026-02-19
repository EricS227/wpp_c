# Multi-Department System - Quick Reference Guide

## 🎯 System In 30 Seconds

**Problem:** Multiple agents in different departments need to handle WhatsApp conversations, with automatic routing, load balancing, and escalation.

**Solution:** Bot greets customer with department menu → Routes to department → Assigns to least-busy agent → Escalates to admin after 3 minutes.

---

## 📊 Key Architecture Diagram

```
Customer  →  Bot Menu  →  Routing  →  Assignment  →  Real-Time Updates
   ↓           ↓            ↓            ↓                ↓
Whatsapp   "Choose:       Database    Load Balance    WebSocket
Message    1. Lab         Update      Round-Robin     Broadcast
           2. Comm        Department  Agent Lookup    to Department
           3. Fin         flowState    Open Convs      Rooms
           4. Admin"      timeout      Count
```

---

## 🔑 Core Concepts

### FlowState Machine
```
GREETING 
  → Menu sent, waiting for choice
  ↓
DEPARTMENT_SELECTED 
  → User selected dept, looking for agent
  → If no agent → starts 3-min timer
  ↓
ASSIGNED 
  → Agent assigned, conversation active
  ↓
TIMEOUT_REDIRECT 
  → No agent responded, escalated to Administrativo
  ↓
RESOLVED 
  → Conversation closed
```

### Room Architecture
```
company:{companyId}      - All enterprise messages
department:{deptId}      - Department-specific (messages, assignments, status)
conversation:{convId}    - Specific chat (both participants)
user:{userId}            - Personal notifications (assigned to me)
```

### Database Relationships
```
Company
  ├─ Department[] (4 auto-created)
  │   ├─ User[] (agents assigned)
  │   ├─ Conversation[] (routed here)
  │   └─ settings (timeout, max agents)
  │
  └─ Conversation[]
      ├─ Department (routed to)
      ├─ User (assignedTo)
      ├─ Message[] (all messages in conv)
      └─ Assignment[] (history)
```

---

## 🔌 API Quick Reference

### Quick Tests
```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"pass"}'
# Get token: response.accessToken

# List departments
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/departments

# List conversations (filtered by dept)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/conversations

# Assign conversation
curl -X POST http://localhost:4000/api/conversations/$CONV_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"'$AGENT_ID'"}'

# Change status
curl -X PATCH http://localhost:4000/api/users/me/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"ONLINE"}'
```

---

## 💾 Database Queries Cheat Sheet

```sql
-- All departments
SELECT id, name, slug, isRoot FROM departments;

-- Conversations by status
SELECT id, customerPhone, departmentId, flowState, assignedUserId 
FROM conversations 
WHERE status = 'OPEN' 
ORDER BY lastMessageAt DESC;

-- Agents in department with load
SELECT 
  u.id, u.name, u.onlineStatus,
  COUNT(c.id) as open_convs
FROM users u
LEFT JOIN conversations c 
  ON u.id = c.assignedUserId AND c.status = 'OPEN'
WHERE u.departmentId = '<dept-id>'
GROUP BY u.id, u.name, u.onlineStatus
ORDER BY open_convs ASC;

-- Messages from bot
SELECT id, content, sentAt FROM messages 
WHERE isBot = true 
ORDER BY sentAt DESC LIMIT 20;

-- Conversations waiting to timeout
SELECT id, customerPhone, departmentId, timeoutAt, NOW()
FROM conversations 
WHERE flowState = 'DEPARTMENT_SELECTED' 
  AND timeoutAt < NOW();

-- Last heartbeat per agent
SELECT name, lastHeartbeatAt, NOW() - lastHeartbeatAt as inactive_for
FROM users 
WHERE onlineStatus IN ('ONLINE', 'BUSY')
ORDER BY lastHeartbeatAt ASC;
```

---

## 🚀 Development Workflow

### Add New Feature

1. **Update Schema** (if needed)
   ```bash
   # Edit backend/prisma/schema.prisma
   # Add migration
   npm run prisma:migrate dev --name describe_change
   ```

2. **Create Service**
   ```typescript
   @Injectable()
   export class MyService {
     constructor(private prisma: PrismaService) {}
     async doSomething() { ... }
   }
   ```

3. **Wire Up in Module**
   ```typescript
   @Module({
     providers: [MyService],
     exports: [MyService],
   })
   export class MyModule {}
   ```

4. **Add API Endpoint**
   ```typescript
   @Controller('route')
   export class MyController {
     constructor(private service: MyService) {}
     
     @Post('action')
     @UseGuards(JwtAuthGuard)
     async action(@CurrentUser() user: any, @Body() dto: any) {
       return this.service.doSomething(user.id, dto);
     }
   }
   ```

5. **Test Locally**
   ```bash
   npm run start:dev
   # In another terminal:
   curl -X POST http://localhost:4000/api/route/action \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"key":"value"}'
   ```

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Conversations invisible | Wrong departmentId | Check `GET /departments/:id/queue` |
| No conversation assigned | No agents ONLINE | Set agent status to ONLINE in UI |
| Timeout not triggered | Cron not running | Check `docker compose logs backend` for cron |
| 403 on conversation GET | Cross-dept access | User.departmentId ≠ conversation.departmentId |
| WebSocket not connecting | CORS issue | Check FRONTEND_URL in .env |
| Bot not responding | Polling disabled | Check WahaPollingService in logs |
| Agent doesn't see new msg | Wrong room | Check if in department:{deptId} room |

---

## 🔄 Common Operations

### Reset Test Data
```sql
DELETE FROM messages WHERE createdAt < NOW() - INTERVAL '1 day';
DELETE FROM conversations WHERE createdAt < NOW() - INTERVAL '1 day';

UPDATE conversations SET 
  flowState = 'GREETING',
  departmentId = NULL,
  assignedUserId = NULL,
  greetingSentAt = NULL
WHERE status = 'OPEN';
```

### Create Test Users
```bash
# Create Lab Agent
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Agent Lab",
    "email": "lab@test.com",
    "password": "password123",
    "role": "AGENT",
    "departmentId": "<lab-dept-id>"
  }'
```

### Monitor System Health
```bash
# Check cron jobs
docker compose logs backend | tail -50 | grep "routing\|timeout\|heartbeat"

# Check WebSocket
docker compose logs backend | grep -i "connected\|disconnected"

# Database load
psql -U whatsapp -c "
  SELECT 
    datname,
    numbackends as active_connections,
    xact_commit as transactions
  FROM pg_stat_database
  WHERE datname = 'whatsapp_db';"
```

---

## 📋 Testing Checklist

- [ ] New contact gets greeting menu
- [ ] Menu selection routes to correct department
- [ ] Invalid selection shows error + menu
- [ ] Agent sees assigned conversation in real-time
- [ ] Agent status changes broadcast to department only
- [ ] 3-minute timeout escalates to admin
- [ ] Cross-department access returns 403
- [ ] Admin sees all conversations
- [ ] Bot messages show differently (gray/italic)
- [ ] Conversation reassigned when agent goes offline
- [ ] WebSocket reconnects after disconnect

---

## 🎓 Understanding the Code

### Flow: Message arrives
```typescript
WahaPollingService.poll()
  → processChat()
    → findOrCreateConversation()
    → conversation.flowState === 'GREETING'?
      → YES: FlowEngineService.sendGreeting()
      → NO: MessagesService.handleIncomingMessage()
        → websocketGateway.emitToDepartment()
```

### Flow: Menu selection
```typescript
WahaPollingService.processChat()
  → FlowEngineService.processMenuChoice() // validates "3" → "comercial"
  → DepartmentRoutingService.routeToDepartment()
    → Update conversation.departmentId, .flowState
    → assignToAgent() // get lowest load agent
      → websocketGateway.emitToDepartment() // "conversation-queued"
```

### Flow: Timeout check
```typescript
@Cron('*/30 * * * * *')
DepartmentRoutingCron.handleRoutingTimeouts()
  → DepartmentRoutingService.checkTimeoutAndRedirect()
    → FOR each conversation.flowState='DEPARTMENT_SELECTED' AND .timeoutAt < NOW()
      → Find rootDept
      → Update .departmentId = rootDept.id
      → reassignToAgent()
      → Send "Redirecionando..." message
```

---

## 📱 Frontend Component Tree

```
App
  ├─ AgentStatusBar
  │   ├─ useSocket()
  │   ├─ useAuthStore()
  │   └─ Select (Online/Busy/Offline)
  │
  ├─ ConversationList
  │   ├─ useConversations() ← filtered by department
  │   ├─ DepartmentBadge (per conversation)
  │   └─ Message preview
  │
  ├─ ChatWindow
  │   ├─ MessageBubble[] (shows isBot different)
  │   └─ MessageInput
  │
  └─ useSocket()
      ├─ conversation-assigned
      ├─ message-received
      ├─ agent-status-changed
      └─ heartbeat (60s)
```

---

## 🔐 Security Checklist

- ✅ All endpoints need JwtAuthGuard
- ✅ Department filter on GET endpoints
- ✅ 403 on cross-dept access
- ✅ Passwords hashed (bcrypt)
- ✅ JWT expires in 7 days
- ✅ Webhooks verify token
- ✅ CORS to frontend URL only
- ✅ Rate limiting (60 req/min)
- ✅ No sensitive data in API responses

---

## 📞 Key Contacts/Files

| Need | File | Command |
|------|------|---------|
| Change timeout | `schema.prisma` | `responseTimeoutMinutes` field |
| Change menu options | `flow-engine.service.ts` | `MENU_ALIASES` object |
| Change greeting text | `company.greetingMessage` | DB field or `getDefaultGreeting()` |
| Change dept color | `departments` table | `color` field (#hex) |
| Enable/disable dept | `departments` table | `isActive` field |
| Debug routing | `department-routing.service.ts` | Logger calls |
| Debug messages | `messages.service.ts` | Emit calls |
| WebSocket events | `websocket.gateway.ts` | @SubscribeMessage |

---

## 🎯 Next Steps

1. **Run locally:**
   ```bash
   npm run start:dev && npm run dev
   ```

2. **Test greeting bot:**
   - Send message as new contact
   - Verify menu appears

3. **Test routing:**
   - Reply with "3"
   - Verify conversation routes to Comercial

4. **Test isolation:**
   - Login as different dept agents
   - Verify each sees only their dept

5. **Test timeout:**
   - Leave conversation for 3+ min
   - Verify auto-escalation to admin

6. **Monitor metrics:**
   - Check response times
   - Monitor WebSocket connections
   - Verify no errors in logs

---

## 📚 Documentation

- **IMPLEMENTATION-COMPLETE.md** - Full technical overview
- **TESTING-GUIDE.md** - Detailed test scenarios
- **This file** - Quick reference

---

**Last Updated:** February 17, 2026  
**Status:** Production Ready ✅

