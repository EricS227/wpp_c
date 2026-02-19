# Análise Técnica Completa: Fluxo de Conversas WhatsApp → Painel de Atendentes

## Índice
1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Componentes do Sistema](#componentes-do-sistema)
3. [Fluxo de Recebimento de Mensagens](#fluxo-de-recebimento-de-mensagens)
4. [Fluxo de Envio de Mensagens](#fluxo-de-envio-de-mensagens)
5. [Comunicação em Tempo Real](#comunicação-em-tempo-real)
6. [Resolução de LID (Linked ID)](#resolução-de-lid-linked-id)
7. [Armazenamento de Dados](#armazenamento-de-dados)
8. [Protocolos e APIs](#protocolos-e-apis)
9. [Diagramas de Sequência](#diagramas-de-sequência)

---

## Visão Geral da Arquitetura

O sistema é composto por três camadas principais:

```
┌─────────────────┐
│   WhatsApp      │ (Cliente final envia mensagem)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   WAHA Server   │ (WhatsApp HTTP API - Porta 3101)
└────────┬────────┘
         │ HTTP REST API
         ▼
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐
│  Backend NestJS │◄────►│   PostgreSQL │      │   WebSocket  │
│   (Porta 4000)  │      │   Database   │      │   Gateway    │
└────────┬────────┘      └──────────────┘      └──────┬───────┘
         │                                              │
         │ HTTP REST API                                │ Socket.IO
         ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│  Frontend Next  │                          │  Frontend Next  │
│  (Porta 3100)   │                          │  (Porta 3100)   │
└─────────────────┘                          └─────────────────┘
```

### Stack Tecnológica

**Backend:**
- **Framework:** NestJS (Node.js)
- **ORM:** Prisma
- **Banco de Dados:** PostgreSQL
- **WebSocket:** Socket.IO (via @nestjs/websockets)
- **HTTP Client:** Axios
- **Autenticação:** JWT

**Frontend:**
- **Framework:** Next.js 16 (React 19)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **WebSocket Client:** socket.io-client
- **HTTP Client:** Axios

**Infraestrutura:**
- **WhatsApp Integration:** WAHA (WhatsApp HTTP API)
- **Containerização:** Docker/Docker Compose
- **Reverse Proxy:** Nginx

---

## Componentes do Sistema

### 1. WAHA (WhatsApp HTTP API)

**Localização:** Servidor externo (porta 3101)

**Função:** Interface HTTP REST para interagir com WhatsApp Web conectado via sessão.

**Endpoints Principais Utilizados:**
- `GET /api/{session}/chats/overview` - Lista chats com contagem de não lidos
- `GET /api/{session}/chats/{chatId}/messages` - Busca mensagens de um chat
- `POST /api/{session}/chats/{chatId}/messages/read` - Marca mensagens como lidas
- `GET /api/contacts?session={s}&contactId={id}` - Resolve LID para número real
- `GET /api/contacts/profile-picture?session={s}&contactId={id}` - Busca foto de perfil
- `POST /api/sendText` - Envia mensagem de texto

**Autenticação:** Header `X-Api-Key` (opcional, configurável)

### 2. WahaPollingService

**Arquivo:** `backend/src/modules/whatsapp/waha-polling.service.ts`

**Responsabilidade:** Polling periódico (a cada 5 segundos) para buscar novas mensagens do WAHA.

**Fluxo de Execução:**

```typescript
onModuleInit() → setInterval(() => poll(), 5000)
```

**Método `poll()`:**
1. Faz requisição `GET /api/{session}/chats/overview` com `limit: 50`
2. Filtra chats com `unreadCount > 0` e `isGroup === false`
3. Para cada chat não lido, chama `processChat()`

**Método `processChat()`:**
1. Busca mensagens do chat: `GET /api/{session}/chats/{chatId}/messages`
2. Para cada mensagem recebida (`fromMe === false`):
   - Verifica idempotência (se já existe no banco pelo `whatsappMessageId`)
   - Resolve LID para número real via `WhatsappService.getContactInfo()`
   - Determina tipo de mensagem (TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT)
   - Extrai conteúdo e URL de mídia (se houver)
   - Chama `MessagesService.handleIncomingMessage()`
3. Marca chat como lido no WAHA: `POST /api/{session}/chats/{chatId}/messages/read`

**Características:**
- **Polling Interval:** 5 segundos (fixo)
- **Flag de Proteção:** `polling` evita execuções concorrentes
- **Idempotência:** Verifica `whatsappMessageId` antes de processar
- **Filtragem:** Ignora grupos e mensagens próprias (`fromMe === true`)

### 3. WhatsappService

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`

**Responsabilidade:** Abstração para comunicação com WAHA ou Meta Cloud API.

**Métodos Principais:**

#### `getContactInfo(contactId: string)`

Resolve um `chatId` (formato LID ou @c.us) para informações reais do contato.

**Fluxo:**
1. Requisição `GET /api/contacts?session={s}&contactId={id}`
2. Requisição opcional `GET /api/contacts/profile-picture` (não bloqueante)
3. Retorna objeto com:
   - `number`: Número real do telefone (ex: "5511999998888")
   - `pushname`: Nome definido pelo usuário no WhatsApp
   - `name`: Nome salvo na agenda (se houver)
   - `isBusiness`: Se é conta business
   - `profilePictureURL`: URL da foto de perfil

**Tratamento de Erros:** Retorna `null` se falhar (não bloqueia o fluxo)

#### `sendTextMessage(accessToken, phoneNumberId, to, text)`

Envia mensagem de texto via WAHA ou Meta.

**Para WAHA:**
- Endpoint: `POST /api/sendText`
- Payload: `{ session, chatId, text }`
- `chatId` formatado: se não contém `@`, adiciona `@c.us`
- Retorna `{ messages: [{ id: messageId }] }`

**Para Meta:**
- Endpoint: `POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages`
- Payload: `{ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body } }`
- Autenticação: Bearer token no header

#### `markAsRead(messageId: string)`

Marca mensagem como lida.

**Para WAHA:**
- Endpoint: `POST /api/sendSeen`
- Extrai `chatId` do `messageId` (formato: `true_phone@c.us_ID`)

**Para Meta:**
- Endpoint: `POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages`
- Payload: `{ messaging_product: 'whatsapp', status: 'read', message_id }`

### 4. MessagesService

**Arquivo:** `backend/src/modules/messages/messages.service.ts`

**Responsabilidade:** Lógica de negócio para mensagens e integração com banco de dados.

#### `handleIncomingMessage(...)`

Processa mensagem recebida do WhatsApp.

**Parâmetros:**
- `companyId`: ID da empresa
- `customerPhone`: Número real do telefone (já resolvido)
- `whatsappMessageId`: ID único da mensagem no WhatsApp
- `content`: Conteúdo da mensagem
- `type`: Tipo (TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT)
- `customerName`: Nome do cliente (opcional)
- `mediaUrl`: URL da mídia (opcional)
- `chatId`: ChatId original do WAHA (pode ser LID)
- `contactProfile`: Perfil do contato (opcional)

**Fluxo:**

1. **Verificação de Duplicatas:**
   ```typescript
   const existing = await prisma.message.findUnique({
     where: { whatsappMessageId }
   });
   ```
   Se existir, retorna imediatamente (idempotência).

2. **Busca/Criação de Conversa:**
   - Tenta encontrar por `companyId + customerPhone` (número real)
   - Se não encontrar e `chatId !== customerPhone`, tenta buscar por `chatId` (backward compatibility)
   - Se encontrar por `chatId`, **migra** o `customerPhone` para o número real
   - Se não existir, cria nova conversa

3. **Criação da Mensagem:**
   ```typescript
   await prisma.message.create({
     data: {
       companyId,
       conversationId,
       whatsappMessageId,
       direction: 'INBOUND',
       type,
       content,
       mediaUrl,
       status: 'DELIVERED'
     }
   });
   ```

4. **Extração de Nome:**
   - Tenta extrair nome do conteúdo usando regex patterns:
     - `/\bmeu nome (?:e|é)\s+(.+)/i`
     - `/\bme chamo\s+(.+)/i`
     - `/\bsou (?:o|a)\s+(.+)/i`
     - etc.

5. **Atualização da Conversa:**
   - `lastMessageAt`: Data atual
   - `unreadCount`: Incrementa em 1
   - `status`: Se estava `RESOLVED`, muda para `OPEN`
   - `customerName`: Atualiza se extraído ou fornecido
   - `metadata`: Atualiza com `chatId` e `contactProfile`

6. **Emissão WebSocket:**
   ```typescript
   websocketGateway.emitToCompany(companyId, 'message-received', {
     message,
     conversationId
   });
   ```

#### `sendMessage(userId, companyId, dto, agentName)`

Envia mensagem do atendente para o cliente.

**Parâmetros:**
- `userId`: ID do usuário que está enviando
- `companyId`: ID da empresa
- `dto`: `{ conversationId, content, type }`
- `agentName`: Nome do agente (opcional, usado como prefixo)

**Fluxo:**

1. **Busca da Conversa:**
   ```typescript
   const conversation = await prisma.conversation.findUnique({
     where: { id: dto.conversationId },
     include: { company: true }
   });
   ```

2. **Criação da Mensagem (Status PENDING):**
   ```typescript
   const message = await prisma.message.create({
     data: {
       companyId,
       conversationId: dto.conversationId,
       direction: 'OUTBOUND',
       type: dto.type || 'TEXT',
       content: dto.content,  // Sem prefixo do agente
       status: 'PENDING',
       sentById: userId
     }
   });
   ```

3. **Preparação do Texto para WhatsApp:**
   ```typescript
   const whatsappText = agentName
     ? `*${agentName}*: ${dto.content}`
     : dto.content;
   ```

4. **Resolução do Destinatário:**
   ```typescript
   const meta = conversation.metadata as any;
   const sendTo = meta?.chatId || conversation.customerPhone;
   ```
   **Importante:** Usa `chatId` do metadata (LID original) se disponível, senão usa `customerPhone`.

5. **Envio via WhatsApp:**
   ```typescript
   const waResponse = await whatsappService.sendTextMessage(
     conversation.company.whatsappAccessToken,
     conversation.company.whatsappPhoneNumberId,
     sendTo,
     whatsappText
   );
   ```

6. **Atualização da Mensagem:**
   - Atualiza `whatsappMessageId` com o ID retornado
   - Atualiza `status` para `SENT`

7. **Atualização da Conversa:**
   - `lastMessageAt`: Data atual

8. **Emissão WebSocket:**
   ```typescript
   websocketGateway.emitToConversation(
     dto.conversationId,
     'message-sent',
     updatedMessage
   );
   ```

9. **Tratamento de Erros:**
   - Se falhar, atualiza `status` para `FAILED`
   - Propaga o erro

### 5. WebsocketGateway

**Arquivo:** `backend/src/modules/websocket/websocket.gateway.ts`

**Responsabilidade:** Gerenciamento de conexões WebSocket e emissão de eventos em tempo real.

**Configuração:**
```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://192.168.10.156:3100',
    credentials: true
  }
})
```

**Autenticação:**
- Token JWT via `handshake.auth.token` ou `Authorization` header
- Verifica token e extrai `userId` e `companyId`
- Cliente entra automaticamente na sala `company:{companyId}`

**Eventos Recebidos (do Cliente):**

- `join-conversation`: Cliente entra na sala `conversation:{conversationId}`
- `leave-conversation`: Cliente sai da sala
- `typing-start`: Indica que usuário está digitando
- `typing-stop`: Indica que usuário parou de digitar

**Eventos Emitidos (para Cliente):**

- `message-received`: Nova mensagem recebida (emitido para toda a empresa)
- `message-sent`: Mensagem enviada com sucesso (emitido para a conversa específica)
- `message-status-updated`: Status da mensagem atualizado (DELIVERED, READ)
- `user-typing`: Indicação de digitação (broadcast para outros na conversa)

**Métodos Helper:**

```typescript
emitToConversation(conversationId, event, data)
// Emite para todos na sala conversation:{conversationId}

emitToCompany(companyId, event, data)
// Emite para todos na sala company:{companyId}
```

### 6. Frontend - useSocket Hook

**Arquivo:** `frontend/src/hooks/useSocket.ts`

**Responsabilidade:** Gerenciamento da conexão WebSocket no frontend e atualização do estado.

**Inicialização:**
```typescript
const socket = connectSocket(token);
// Conecta com autenticação via auth.token
```

**Listeners:**

1. **`message-received`:**
   ```typescript
   socket.on('message-received', (data) => {
     addMessage(data.conversationId, data.message);
     queryClient.invalidateQueries({ queryKey: ['conversations'] });
     if (data.conversationId !== selectedConversationId) {
       incrementUnread(data.conversationId);
     }
     // Notificação do navegador se tab não está focada
   });
   ```

2. **`message-sent`:**
   ```typescript
   socket.on('message-sent', (message) => {
     addMessage(message.conversationId, message);
   });
   ```

3. **`message-status-updated`:**
   ```typescript
   socket.on('message-status-updated', (data) => {
     updateMessageStatus(data.messageId, data.status);
   });
   ```

**Métodos Expostos:**

- `joinConversation(conversationId)`: Entra na sala da conversa
- `leaveConversation(conversationId)`: Sai da sala
- `emitTypingStart(conversationId)`: Indica início de digitação
- `emitTypingStop(conversationId)`: Indica fim de digitação

**Cleanup:**
- Remove listeners e desconecta ao desmontar componente

### 7. Frontend - API Client

**Arquivo:** `frontend/src/lib/api-client.ts`

**Configuração:**
```typescript
baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://192.168.10.156:4000/api'
```

**Interceptors:**

**Request:**
- Adiciona token JWT do `localStorage` no header `Authorization`

**Response:**
- Se `401 Unauthorized`, remove token e redireciona para `/login`

**Endpoints Utilizados:**

- `POST /api/messages/send`: Envia mensagem
- `GET /api/conversations`: Lista conversas
- `GET /api/conversations/:id`: Busca conversa específica
- `GET /api/conversations/:id/messages`: Busca mensagens da conversa

---

## Fluxo de Recebimento de Mensagens

### Diagrama de Sequência Completo

```
Cliente WhatsApp    WAHA Server      WahaPollingService    WhatsappService    MessagesService    Database    WebsocketGateway    Frontend
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │─── Mensagem ────►│                    │                    │                  │              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │◄─── Poll (5s) ─────│                  │              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │─── GET /chats/overview ────────────────►│                  │              │              │                │
      │                  │◄─── [{chatId, unreadCount}] ────────────│                  │              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │─── GET /chats/{chatId}/messages ────────►│                  │              │              │                │
      │                  │◄─── [{id, body, fromMe, ...}] ──────────│                  │              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │─── getContactInfo(chatId) ────────────►│              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │─── GET /api/contacts?contactId={chatId} ─►│                  │              │              │                │
      │                  │◄─── {number, pushname, name, ...} ──────│                  │              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │◄─── {number, pushname, ...} ────────────│              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │─── handleIncomingMessage(...) ────────►│              │              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │─── findUnique(whatsappMessageId) ──►│              │                │
      │                  │                    │                    │◄─── null (não existe) ──────────────│              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │─── findUnique(companyId_customerPhone) ──►│              │                │
      │                  │                    │                    │◄─── conversation ou null ──────────────│              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │─── create/update conversation ──────►│              │                │
      │                  │                    │                    │◄─── conversation ──────────────────────│              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │─── create message ────────────────────►│              │                │
      │                  │                    │                    │◄─── message ───────────────────────────│              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │─── update conversation (unreadCount++) ─►│              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │─── emitToCompany('message-received') ──►│              │                │
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │                  │              │─── message-received ────────────►│
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │                    │                  │              │              │◄─── addMessage() ──│
      │                  │                    │                    │                  │              │              │◄─── invalidateQueries() ──│
      │                  │                    │                    │                  │              │              │                │
      │                  │                    │─── POST /chats/{chatId}/messages/read ─►│                  │              │              │                │
      │                  │                    │◄─── OK ────────────────────────────────│                  │              │              │                │
```

### Passo a Passo Detalhado

#### 1. Cliente envia mensagem no WhatsApp
- Mensagem é recebida pelo WhatsApp Web conectado ao WAHA
- WAHA armazena a mensagem internamente

#### 2. Polling detecta nova mensagem
- `WahaPollingService.poll()` executa a cada 5 segundos
- Faz `GET /api/{session}/chats/overview`
- Filtra chats com `unreadCount > 0` e `isGroup === false`

#### 3. Busca mensagens do chat
- Para cada chat não lido, faz `GET /api/{session}/chats/{chatId}/messages`
- Filtra mensagens onde `fromMe === false` (apenas recebidas)

#### 4. Verificação de idempotência
- Para cada mensagem, verifica se `whatsappMessageId` já existe no banco
- Se existir, pula para próxima mensagem

#### 5. Resolução de LID
- Chama `WhatsappService.getContactInfo(chatId)`
- Faz `GET /api/contacts?session={s}&contactId={chatId}`
- WAHA retorna número real: `{ number: "5511999998888", pushname: "João", ... }`
- Se falhar, usa `chatId` como fallback

#### 6. Determinação do tipo de mensagem
- Verifica `msg.hasMedia` e `msg.media.mimetype`
- Tipos possíveis:
  - `TEXT`: Mensagem de texto simples
  - `IMAGE`: `mimetype.startsWith('image/')`
  - `AUDIO`: `mimetype.startsWith('audio/')`
  - `VIDEO`: `mimetype.startsWith('video/')`
  - `DOCUMENT`: Outros tipos de mídia

#### 7. Processamento no MessagesService
- `handleIncomingMessage()` é chamado com todos os dados
- Verifica duplicatas novamente (double-check)
- Busca ou cria conversa:
  - Tenta por `companyId + customerPhone` (número real)
  - Se não encontrar e `chatId !== customerPhone`, tenta por `chatId` (migração)
  - Se encontrar por `chatId`, migra para número real
  - Se não existir, cria nova conversa com `status: 'OPEN'`

#### 8. Criação da mensagem
- Cria registro no banco:
  ```typescript
  {
    companyId,
    conversationId,
    whatsappMessageId,
    direction: 'INBOUND',
    type,
    content,
    mediaUrl,
    status: 'DELIVERED'
  }
  ```

#### 9. Atualização da conversa
- `lastMessageAt`: Data atual
- `unreadCount`: Incrementa em 1
- `status`: Se estava `RESOLVED`, muda para `OPEN`
- `customerName`: Atualiza se extraído ou fornecido
- `metadata`: Atualiza com `chatId` e `contactProfile`

#### 10. Emissão WebSocket
- `websocketGateway.emitToCompany(companyId, 'message-received', { message, conversationId })`
- Todos os clientes conectados da empresa recebem o evento

#### 11. Atualização no Frontend
- Hook `useSocket` recebe `message-received`
- Chama `addMessage()` para adicionar ao estado local
- Invalida query `['conversations']` para refetch
- Se conversa não está selecionada, incrementa contador de não lidos
- Se tab não está focada, mostra notificação do navegador

#### 12. Marcação como lida no WAHA
- Após processar todas as mensagens, faz `POST /api/{session}/chats/{chatId}/messages/read`
- Isso marca as mensagens como lidas no WhatsApp

---

## Fluxo de Envio de Mensagens

### Diagrama de Sequência Completo

```
Frontend          API Client    MessagesController    MessagesService    WhatsappService    WAHA Server    Database    WebsocketGateway    Frontend
    │                  │                │                    │                  │              │              │              │                │
    │─── POST /messages/send ───────────►│                    │                  │              │              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │─── sendMessage() ──►│                  │              │              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │─── findUnique(conversationId) ──►│              │              │                │
    │                  │                │                    │◄─── conversation ────────────────│              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │─── create message (PENDING) ────►│              │              │                │
    │                  │                │                    │◄─── message ─────────────────────│              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │─── sendTextMessage(...) ─────────►│              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │                  │─── POST /api/sendText ──►│              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │                  │              │─── Envia via WhatsApp Web ──►│              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │                  │◄─── {id: messageId} ──────│              │              │                │
    │                  │                │                    │◄─── {messages: [{id}]} ───────────│              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │─── update message (SENT) ────────►│              │              │                │
    │                  │                │                    │◄─── updatedMessage ────────────────│              │              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │─── update conversation (lastMessageAt) ──►│              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │─── emitToConversation('message-sent') ──►│              │                │
    │                  │                │                    │                  │              │              │              │                │
    │                  │                │                    │                  │              │              │─── message-sent ────────────►│
    │                  │                │                    │                  │              │              │                │                │
    │                  │                │                    │                  │              │              │                │◄─── addMessage() ──│
    │                  │                │                    │                  │              │              │                │                │
    │◄─── 200 OK ───────│◄───────────────│◄───────────────────│                  │              │              │              │                │
```

### Passo a Passo Detalhado

#### 1. Usuário digita e envia mensagem no frontend
- Componente React chama função de envio
- Monta payload: `{ conversationId, content, type }`

#### 2. Requisição HTTP para API
- `apiClient.post('/messages/send', payload)`
- Token JWT adicionado automaticamente via interceptor
- Requisição vai para `POST /api/messages/send`

#### 3. Controller recebe requisição
- `MessagesController.send()` é chamado
- Extrai `userId` e `companyId` do token JWT via `@CurrentUser()`
- Chama `MessagesService.sendMessage(userId, companyId, dto, user.name)`

#### 4. Busca da conversa
- `MessagesService.sendMessage()` busca conversa completa:
  ```typescript
  const conversation = await prisma.conversation.findUnique({
    where: { id: dto.conversationId },
    include: { company: true }
  });
  ```
- Valida se conversa existe

#### 5. Criação da mensagem (Status PENDING)
- Cria registro no banco com `status: 'PENDING'`:
  ```typescript
  {
    companyId,
    conversationId: dto.conversationId,
    direction: 'OUTBOUND',
    type: dto.type || 'TEXT',
    content: dto.content,  // Sem prefixo do agente
    status: 'PENDING',
    sentById: userId
  }
  ```
- **Importante:** O conteúdo salvo no banco é o texto original, sem prefixo do agente

#### 6. Preparação do texto para WhatsApp
- Se `agentName` fornecido, adiciona prefixo:
  ```typescript
  const whatsappText = agentName
    ? `*${agentName}*: ${dto.content}`
    : dto.content;
  ```
- O asterisco `*` cria texto em negrito no WhatsApp

#### 7. Resolução do destinatário
- Extrai `chatId` do metadata da conversa:
  ```typescript
  const meta = conversation.metadata as any;
  const sendTo = meta?.chatId || conversation.customerPhone;
  ```
- **Crítico:** Usa `chatId` (LID original) se disponível, senão usa `customerPhone`
- Isso é necessário porque o WAHA precisa do ID original para rotear corretamente

#### 8. Envio via WhatsApp
- Chama `WhatsappService.sendTextMessage()`:
  ```typescript
  const waResponse = await whatsappService.sendTextMessage(
    conversation.company.whatsappAccessToken,
    conversation.company.whatsappPhoneNumberId,
    sendTo,
    whatsappText
  );
  ```

#### 9. Requisição ao WAHA
- Para WAHA, faz `POST /api/sendText`:
  ```json
  {
    "session": "default",
    "chatId": "5521912345678-1234567890@lid",
    "text": "*João*: Olá, como posso ajudar?"
  }
  ```
- WAHA envia mensagem via WhatsApp Web conectado

#### 10. Resposta do WAHA
- WAHA retorna:
  ```json
  {
    "id": {
      "_serialized": "true_5521912345678-1234567890@lid_3EB0123456789ABCDEF",
      "fromMe": true,
      "remote": "5521912345678-1234567890@lid",
      "id": "3EB0123456789ABCDEF"
    }
  }
  ```
- `WhatsappService` extrai o ID:
  ```typescript
  const messageId = typeof rawId === 'string'
    ? rawId
    : rawId?._serialized || rawId?.id || data?.key?.id || `waha_${Date.now()}`;
  ```

#### 11. Atualização da mensagem (Status SENT)
- Atualiza registro no banco:
  ```typescript
  {
    whatsappMessageId: waMessageId,
    status: 'SENT'
  }
  ```

#### 12. Atualização da conversa
- Atualiza `lastMessageAt` para data atual

#### 13. Emissão WebSocket
- Emite evento para a conversa específica:
  ```typescript
  websocketGateway.emitToConversation(
    dto.conversationId,
    'message-sent',
    updatedMessage
  );
  ```
- Todos os clientes na sala `conversation:{conversationId}` recebem

#### 14. Atualização no Frontend
- Hook `useSocket` recebe `message-sent`
- Chama `addMessage()` para adicionar ao estado local
- Mensagem aparece imediatamente na interface

#### 15. Resposta HTTP
- Controller retorna `updatedMessage`
- Frontend recebe `200 OK` com dados da mensagem

#### 16. Tratamento de Erros
- Se envio falhar:
  - Atualiza `status` para `FAILED`
  - Propaga erro para o frontend
  - Frontend pode mostrar mensagem de erro ao usuário

---

## Comunicação em Tempo Real

### Arquitetura WebSocket

O sistema usa **Socket.IO** para comunicação bidirecional em tempo real.

**Backend:** `@nestjs/websockets` + `socket.io`
**Frontend:** `socket.io-client`

### Salas (Rooms)

O sistema organiza clientes em salas para broadcast eficiente:

1. **`company:{companyId}`**
   - Todos os usuários da empresa entram automaticamente
   - Usado para eventos que afetam toda a empresa
   - Exemplo: `message-received` (nova mensagem de qualquer cliente)

2. **`conversation:{conversationId}`**
   - Clientes entram manualmente via `join-conversation`
   - Usado para eventos específicos de uma conversa
   - Exemplo: `message-sent`, `user-typing`

### Eventos WebSocket

#### Eventos Recebidos pelo Backend (do Cliente)

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `join-conversation` | `conversationId: string` | Cliente entra na sala da conversa |
| `leave-conversation` | `conversationId: string` | Cliente sai da sala |
| `typing-start` | `conversationId: string` | Indica início de digitação |
| `typing-stop` | `conversationId: string` | Indica fim de digitação |

#### Eventos Emitidos pelo Backend (para Cliente)

| Evento | Payload | Sala | Quando |
|--------|---------|------|--------|
| `message-received` | `{ message, conversationId }` | `company:{companyId}` | Nova mensagem recebida do WhatsApp |
| `message-sent` | `message` | `conversation:{conversationId}` | Mensagem enviada com sucesso |
| `message-status-updated` | `{ messageId, status }` | `conversation:{conversationId}` | Status atualizado (DELIVERED, READ) |
| `user-typing` | `{ userId, conversationId, isTyping }` | `conversation:{conversationId}` | Outro usuário está digitando |

### Autenticação WebSocket

**Handshake:**
```typescript
socket = io(url, {
  auth: { token: jwtToken },
  transports: ['websocket', 'polling']
});
```

**Backend valida:**
```typescript
const token = client.handshake.auth?.token || 
              client.handshake.headers?.authorization?.replace('Bearer ', '');

const payload = jwtService.verify(token);
client.data.userId = payload.sub;
client.data.companyId = payload.companyId;

client.join(`company:${payload.companyId}`);
```

### Reconexão Automática

**Frontend configura:**
```typescript
{
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
}
```

- Tenta reconectar até 10 vezes
- Delay de 1 segundo entre tentativas
- Fallback para polling se WebSocket falhar

### Indicador de Digitação

**Fluxo:**

1. Usuário começa a digitar → `emitTypingStart(conversationId)`
2. Backend recebe → `handleTypingStart()`
3. Backend emite → `user-typing` para outros na conversa
4. Outros clientes recebem → Mostram "João está digitando..."
5. Usuário para de digitar → `emitTypingStop(conversationId)`
6. Backend emite → `user-typing` com `isTyping: false`

---

## Resolução de LID (Linked ID)

### O Problema

O WhatsApp usa internamente um formato chamado **LID (Linked ID)** para identificar contatos. Em vez de retornar o número real do telefone (ex: `5511999998888`), o WAHA retorna IDs no formato:

```
5521912345678-1234567890@lid
```

Isso faz com que na interface do sistema apareça esse ID criptográfico em vez do número real do cliente.

### A Solução

A resolução é feita usando o **endpoint `/api/contacts` do WAHA**, que recebe um `contactId` (no formato @lid) e retorna as informações reais do contato, incluindo o número de telefone.

### Implementação

#### 1. Método de Resolução

**Arquivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`

```typescript
async getContactInfo(contactId: string): Promise<{
  number: string;           // Número real do telefone
  pushname: string | null; // Nome que o cliente definiu no WhatsApp
  name: string | null;     // Nome salvo na agenda (se houver)
  isBusiness: boolean;     // Se é conta business
  profilePictureURL: string | null;
} | null>
```

**Fluxo:**
1. Faz `GET /api/contacts?session={s}&contactId={id}`
2. WAHA retorna:
   ```json
   {
     "number": "5511999998888",
     "pushname": "João Silva",
     "name": "João",
     "isBusiness": false
   }
   ```
3. Opcionalmente busca foto de perfil: `GET /api/contacts/profile-picture`
4. Retorna objeto com informações ou `null` se falhar

#### 2. Onde é Chamado

**No Polling (`WahaPollingService.processChat()`):**
```typescript
const contactInfo = await whatsappService.getContactInfo(chatId);
if (contactInfo?.number) {
  customerPhone = contactInfo.number;  // Número real
  contactProfile = {
    pushname: contactInfo.pushname,
    name: contactInfo.name,
    isBusiness: contactInfo.isBusiness,
    profilePictureURL: contactInfo.profilePictureURL
  };
}
```

#### 3. Armazenamento no Banco

**Estratégia:**
- **`customerPhone`**: Sempre armazena o **número real** (resolvido)
- **`metadata.chatId`**: Armazena o **chatId original** (pode ser @lid) para usar ao enviar mensagens de volta

**Exemplo:**
```typescript
{
  customerPhone: "5511999998888",  // Número real - mostrado na UI
  metadata: {
    chatId: "5521912345678-1234567890@lid",  // ID original - usado para enviar
    pushname: "João Silva",
    name: "João",
    isBusiness: false,
    profilePictureURL: "https://..."
  }
}
```

#### 4. Envio de Mensagens

**IMPORTANTE:** Ao enviar mensagem de volta, use o `chatId` original (do metadata), não o número real. O WAHA precisa do ID original para rotear corretamente:

```typescript
const meta = conversation.metadata as any;
const sendTo = meta?.chatId || conversation.customerPhone;

// Se não tem @, adiciona @c.us
const chatId = sendTo.includes('@') ? sendTo : `${sendTo}@c.us`;

await axios.post(`${WAHA_API_URL}/api/sendText`, {
  session: WAHA_SESSION,
  chatId,  // Usa o chatId original (LID)
  text
});
```

#### 5. Migração de Conversas Antigas

Se já existem conversas salvas com o @lid como `customerPhone`, o sistema faz migração automática:

```typescript
// 1. Tenta encontrar por número real
let conversation = await prisma.conversation.findUnique({
  where: { companyId_customerPhone: { companyId, customerPhone } }
});

// 2. Se não achou, tenta pelo chatId antigo (LID salvo como customerPhone)
if (!conversation && chatId && chatId !== customerPhone) {
  conversation = await prisma.conversation.findUnique({
    where: { companyId_customerPhone: { companyId, customerPhone: chatId } }
  });

  // 3. MIGRAR: atualiza o customerPhone antigo (LID) para o número real
  if (conversation) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        customerPhone,  // Agora salva o número real
        metadata: {
          ...(conversation.metadata as any),
          chatId  // Preserva o chatId original no metadata
        }
      }
    });
  }
}
```

### Fallback

Se a resolução falhar (contato não encontrado, WAHA fora do ar), o sistema usa o próprio `chatId` como fallback:

```typescript
let customerPhone = chatId;  // Fallback
const contactInfo = await whatsappService.getContactInfo(chatId);
if (contactInfo?.number) {
  customerPhone = contactInfo.number;  // Número real
}
```

---

## Armazenamento de Dados

### Schema do Banco de Dados (Prisma)

#### Tabela: `Conversation`

```prisma
model Conversation {
  id            String   @id @default(uuid())
  companyId     String
  customerPhone String   // Número real do telefone (ex: "5511999998888")
  customerName  String?  // Nome do cliente
  status        ConversationStatus @default(OPEN)
  unreadCount   Int      @default(0)
  lastMessageAt DateTime?
  metadata      Json?    // { chatId: "...@lid", pushname: "...", ... }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  company       Company      @relation(fields: [companyId], references: [id])
  messages      Message[]
  assignments   Assignment[]

  @@unique([companyId, customerPhone])  // Unique por número real
  @@index([companyId, status])
  @@index([companyId, lastMessageAt])
}
```

**Campos Importantes:**

- **`customerPhone`**: Sempre o número real resolvido (não LID)
- **`metadata.chatId`**: ChatId original do WAHA (pode ser LID) - usado para enviar mensagens
- **`metadata.pushname`**: Nome do WhatsApp do cliente
- **`metadata.name`**: Nome salvo na agenda
- **`metadata.isBusiness`**: Se é conta business
- **`metadata.profilePictureURL`**: URL da foto de perfil

#### Tabela: `Message`

```prisma
model Message {
  id               String   @id @default(uuid())
  companyId        String
  conversationId   String
  whatsappMessageId String? @unique  // ID único do WhatsApp (para idempotência)
  direction        MessageDirection  // INBOUND ou OUTBOUND
  type             MessageType       // TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT
  content          String
  mediaUrl         String?
  status           MessageStatus     // PENDING, SENT, DELIVERED, READ, FAILED
  sentAt           DateTime @default(now())
  deliveredAt      DateTime?
  readAt           DateTime?
  sentById         String?  // ID do usuário que enviou (se OUTBOUND)

  company          Company      @relation(fields: [companyId], references: [id])
  conversation     Conversation @relation(fields: [conversationId], references: [id])
  sentBy           User?        @relation(fields: [sentById], references: [id])

  @@index([conversationId, sentAt])
  @@index([whatsappMessageId])
  @@index([companyId, sentAt])
}
```

**Campos Importantes:**

- **`whatsappMessageId`**: ID único do WhatsApp - usado para idempotência (evita duplicatas)
- **`direction`**: `INBOUND` (do cliente) ou `OUTBOUND` (do atendente)
- **`status`**: 
  - `PENDING`: Criada mas ainda não enviada
  - `SENT`: Enviada com sucesso
  - `DELIVERED`: Entregue ao destinatário
  - `READ`: Lida pelo destinatário
  - `FAILED`: Falha no envio
- **`content`**: Conteúdo da mensagem (sem prefixo do agente para OUTBOUND)
- **`mediaUrl`**: URL da mídia (se tipo não for TEXT)

### Idempotência

O sistema garante que cada mensagem do WhatsApp seja processada apenas uma vez usando `whatsappMessageId` como chave única:

```typescript
// Verificação no polling
const existing = await prisma.message.findUnique({
  where: { whatsappMessageId }
});
if (existing) continue;  // Já processada, pula

// Verificação no handleIncomingMessage (double-check)
const existing = await prisma.message.findUnique({
  where: { whatsappMessageId }
});
if (existing) return existing;  // Já existe, retorna
```

### Índices

**Conversation:**
- `@@unique([companyId, customerPhone])`: Garante uma conversa por cliente por empresa
- `@@index([companyId, status])`: Busca rápida por status
- `@@index([companyId, lastMessageAt])`: Ordenação por última mensagem

**Message:**
- `@@index([conversationId, sentAt])`: Busca mensagens de uma conversa ordenadas
- `@@index([whatsappMessageId])`: Busca rápida para idempotência
- `@@index([companyId, sentAt])`: Busca mensagens da empresa ordenadas

---

## Protocolos e APIs

### WAHA API

**Base URL:** `http://192.168.10.156:3101` (configurável via `WAHA_API_URL`)

**Autenticação:** Header `X-Api-Key` (opcional)

#### Endpoints Utilizados

##### 1. Listar Chats com Não Lidos

```
GET /api/{session}/chats/overview?limit=50
```

**Resposta:**
```json
[
  {
    "id": "5521912345678-1234567890@lid",
    "unreadCount": 3,
    "isGroup": false,
    "name": "João Silva"
  }
]
```

##### 2. Buscar Mensagens de um Chat

```
GET /api/{session}/chats/{chatId}/messages?limit=10&downloadMedia=false
```

**Resposta:**
```json
[
  {
    "id": {
      "_serialized": "false_5521912345678-1234567890@lid_3EB0123456789ABCDEF",
      "fromMe": false,
      "remote": "5521912345678-1234567890@lid",
      "id": "3EB0123456789ABCDEF"
    },
    "body": "Olá, preciso de ajuda",
    "fromMe": false,
    "hasMedia": false,
    "media": null,
    "timestamp": 1705123456
  }
]
```

##### 3. Resolver Contato (LID → Número Real)

```
GET /api/contacts?session={session}&contactId={contactId}
```

**Resposta:**
```json
{
  "number": "5511999998888",
  "pushname": "João Silva",
  "name": "João",
  "shortName": "João",
  "isBusiness": false
}
```

##### 4. Buscar Foto de Perfil

```
GET /api/contacts/profile-picture?session={session}&contactId={contactId}
```

**Resposta:**
```json
{
  "profilePictureURL": "https://..."
}
```

##### 5. Enviar Mensagem de Texto

```
POST /api/sendText
Content-Type: application/json
X-Api-Key: {apiKey}

{
  "session": "default",
  "chatId": "5521912345678-1234567890@lid",
  "text": "Olá, como posso ajudar?"
}
```

**Resposta:**
```json
{
  "id": {
    "_serialized": "true_5521912345678-1234567890@lid_3EB0123456789ABCDEF",
    "fromMe": true,
    "remote": "5521912345678-1234567890@lid",
    "id": "3EB0123456789ABCDEF"
  }
}
```

##### 6. Marcar Mensagens como Lidas

```
POST /api/{session}/chats/{chatId}/messages/read
```

**Resposta:** `200 OK`

### Backend API (NestJS)

**Base URL:** `http://192.168.10.156:4000/api` (configurável via `NEXT_PUBLIC_API_URL`)

**Autenticação:** Header `Authorization: Bearer {jwtToken}`

#### Endpoints Principais

##### 1. Enviar Mensagem

```
POST /api/messages/send
Authorization: Bearer {token}
Content-Type: application/json

{
  "conversationId": "uuid-da-conversa",
  "content": "Olá, como posso ajudar?",
  "type": "TEXT"
}
```

**Resposta:**
```json
{
  "id": "uuid-da-mensagem",
  "conversationId": "uuid-da-conversa",
  "direction": "OUTBOUND",
  "type": "TEXT",
  "content": "Olá, como posso ajudar?",
  "status": "SENT",
  "whatsappMessageId": "3EB0123456789ABCDEF",
  "sentAt": "2024-01-13T10:30:00Z",
  "sentBy": {
    "id": "uuid-do-usuario",
    "name": "João Atendente"
  }
}
```

##### 2. Listar Conversas

```
GET /api/conversations?status=OPEN
Authorization: Bearer {token}
```

**Resposta:**
```json
[
  {
    "id": "uuid-da-conversa",
    "customerPhone": "5511999998888",
    "customerName": "João Silva",
    "status": "OPEN",
    "unreadCount": 3,
    "lastMessageAt": "2024-01-13T10:30:00Z",
    "messages": [
      {
        "id": "uuid-da-mensagem",
        "content": "Última mensagem",
        "direction": "INBOUND",
        "sentAt": "2024-01-13T10:30:00Z"
      }
    ]
  }
]
```

##### 3. Buscar Mensagens de uma Conversa

```
GET /api/conversations/{conversationId}/messages?take=50&cursor={messageId}
Authorization: Bearer {token}
```

**Resposta:**
```json
[
  {
    "id": "uuid-da-mensagem",
    "conversationId": "uuid-da-conversa",
    "direction": "INBOUND",
    "type": "TEXT",
    "content": "Olá",
    "status": "DELIVERED",
    "sentAt": "2024-01-13T10:00:00Z"
  }
]
```

### WebSocket (Socket.IO)

**URL:** `ws://192.168.10.156:4000` (configurável via `NEXT_PUBLIC_WS_URL`)

**Autenticação:** `auth: { token: jwtToken }` no handshake

#### Eventos

**Cliente → Servidor:**

```typescript
socket.emit('join-conversation', conversationId);
socket.emit('leave-conversation', conversationId);
socket.emit('typing-start', conversationId);
socket.emit('typing-stop', conversationId);
```

**Servidor → Cliente:**

```typescript
socket.on('message-received', (data: { message: any; conversationId: string }) => {});
socket.on('message-sent', (message: any) => {});
socket.on('message-status-updated', (data: { messageId: string; status: string }) => {});
socket.on('user-typing', (data: { userId: string; conversationId: string; isTyping: boolean }) => {});
```

---

## Diagramas de Sequência

### Fluxo Completo: Recebimento de Mensagem

```
┌─────────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
│   Cliente   │  │   WAHA   │  │WahaPolling  │  │WhatsappService│  │Messages  │  │ Database │  │Websocket     │  │ Frontend │
│  WhatsApp   │  │  Server  │  │  Service    │  │               │  │ Service  │  │          │  │  Gateway     │  │          │
└──────┬──────┘  └────┬─────┘  └──────┬───────┘  └───────┬────────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └────┬─────┘
       │              │               │                  │                │             │               │               │
       │── Mensagem ─►│               │                  │                │             │               │               │
       │              │               │                  │                │             │               │               │
       │              │               │◄── Poll (5s) ────│                │             │               │               │
       │              │               │                  │                │             │               │               │
       │              │── GET /chats/overview ──────────►│                │             │               │               │
       │              │◄── [{chatId, unreadCount}] ─────│                │             │               │               │
       │              │               │                  │                │             │               │               │
       │              │── GET /chats/{chatId}/messages ─►│                │             │               │               │
       │              │◄── [{id, body, fromMe, ...}] ────│                │             │               │               │
       │              │               │                  │                │             │               │               │
       │              │               │── getContactInfo(chatId) ──────────►│             │               │               │
       │              │               │                  │                │             │               │               │
       │              │── GET /contacts?contactId={id} ─►│                │             │               │               │
       │              │◄── {number, pushname, ...} ──────│                │             │               │               │
       │              │               │                  │                │             │               │               │
       │              │               │◄── {number, ...} ─│                │             │               │               │
       │              │               │                  │                │             │               │               │
       │              │               │── handleIncomingMessage(...) ──────►│             │               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │── findUnique(whatsappMessageId) ──►│               │               │
       │              │               │                  │◄── null ────────────────────────│               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │── findUnique(companyId_customerPhone) ──►│               │               │
       │              │               │                  │◄── conversation ou null ──────────────│               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │── create/update conversation ──────►│               │               │
       │              │               │                  │◄── conversation ────────────────────│               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │── create message ──────────────────►│               │               │
       │              │               │                  │◄── message ────────────────────────│               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │── update conversation (unreadCount++) ──►│               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │── emitToCompany('message-received') ────►│               │               │
       │              │               │                  │                │             │               │               │
       │              │               │                  │                │             │── message-received ────────────►│
       │              │               │                  │                │             │               │               │
       │              │               │                  │                │             │               │◄── addMessage() ──│
       │              │               │                  │                │             │               │◄── invalidateQueries() ──│
       │              │               │                  │                │             │               │               │
       │              │               │── POST /chats/{chatId}/messages/read ──────────►│             │               │               │
       │              │               │◄── OK ─────────────────────────────────────────│             │               │               │
```

### Fluxo Completo: Envio de Mensagem

```
┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
│ Frontend │  │API Client│  │Messages      │  │Messages     │  │Whatsapp     │  │   WAHA   │  │ Database │  │Websocket     │  │ Frontend │
│          │  │          │  │Controller    │  │Service      │  │Service      │  │  Server  │  │          │  │  Gateway     │  │          │
└────┬─────┘  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └────┬─────┘
     │             │                │                 │                │               │             │               │               │
     │── POST /messages/send ────────►│                 │                │               │             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │── sendMessage() ─►│                │               │             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │── findUnique(conversationId) ────►│             │               │               │
     │             │                │                 │◄── conversation ──────────────────│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │── create message (PENDING) ─────►│             │               │               │
     │             │                │                 │◄── message ───────────────────────│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │── sendTextMessage(...) ───────────►│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │                │── POST /api/sendText ──►│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │                │               │── Envia via WhatsApp Web ──►│               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │                │◄── {id: messageId} ────│             │               │               │
     │             │                │                 │◄── {messages: [{id}]} ────────────│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │── update message (SENT) ───────────►│             │               │               │
     │             │                │                 │◄── updatedMessage ────────────────│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │── update conversation (lastMessageAt) ──►│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │── emitToConversation('message-sent') ────►│             │               │               │
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │                │               │             │── message-sent ────────────►│
     │             │                │                 │                │               │             │               │               │
     │             │                │                 │                │               │             │               │◄── addMessage() ──│
     │             │                │                 │                │               │             │               │               │
     │◄── 200 OK ───│◄───────────────│◄────────────────│                 │               │             │               │               │
```

---

## Considerações Técnicas Importantes

### 1. Idempotência

O sistema garante que cada mensagem do WhatsApp seja processada apenas uma vez através de:
- Verificação de `whatsappMessageId` antes de processar
- Constraint `@@unique` no campo `whatsappMessageId` no banco
- Double-check no `handleIncomingMessage()`

### 2. Resolução de LID

- **Armazenamento:** `customerPhone` sempre número real, `metadata.chatId` sempre o ID original
- **Envio:** Sempre usa `metadata.chatId` se disponível (fallback para `customerPhone`)
- **Migração:** Conversas antigas são migradas automaticamente quando detectadas

### 3. Polling vs Webhooks

O sistema atual usa **polling** (a cada 5 segundos) para buscar novas mensagens. Alternativa seria usar webhooks do WAHA, mas o polling oferece:
- Controle total sobre quando buscar
- Não depende de configuração de webhook externo
- Mais simples de debugar

### 4. Status de Mensagens

- **PENDING:** Criada mas ainda não enviada (apenas OUTBOUND)
- **SENT:** Enviada com sucesso
- **DELIVERED:** Entregue ao destinatário (apenas INBOUND)
- **READ:** Lida pelo destinatário (apenas INBOUND)
- **FAILED:** Falha no envio

### 5. Prefixo do Agente

Mensagens OUTBOUND são enviadas com prefixo do agente no WhatsApp:
```
*João Atendente*: Olá, como posso ajudar?
```

Mas o conteúdo salvo no banco é sem o prefixo:
```
Olá, como posso ajudar?
```

### 6. WebSocket Rooms

- **`company:{companyId}`:** Todos os usuários da empresa (entrada automática)
- **`conversation:{conversationId}`:** Usuários específicos da conversa (entrada manual)

### 7. Tratamento de Erros

- Resolução de LID falha → Usa `chatId` como fallback
- Envio de mensagem falha → Atualiza status para `FAILED`, propaga erro
- WebSocket desconecta → Reconexão automática (até 10 tentativas)

### 8. Performance

- **Polling:** 5 segundos é um bom equilíbrio entre latência e carga
- **Índices:** Banco otimizado com índices em campos frequentemente consultados
- **WebSocket:** Broadcast eficiente usando salas (rooms)

---

## Variáveis de Ambiente

### Backend

```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# WAHA
WAHA_API_URL=http://192.168.10.156:3101
WAHA_API_KEY=wpp_waha_dev_key_2024
WAHA_SESSION=default
WHATSAPP_PROVIDER=WAHA  # ou META

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_256bits
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://192.168.10.156:3100

# Port
PORT=4000
```

### Frontend

```env
NEXT_PUBLIC_API_URL=http://192.168.10.156:4000/api
NEXT_PUBLIC_WS_URL=ws://192.168.10.156:4000
```

---

## Conclusão

Este documento descreve detalhadamente o fluxo completo de conversas desde o WhatsApp até o painel dos atendentes, incluindo:

1. **Arquitetura:** Componentes e suas responsabilidades
2. **Fluxo de Recebimento:** Como mensagens chegam do WhatsApp
3. **Fluxo de Envio:** Como mensagens são enviadas aos clientes
4. **Comunicação em Tempo Real:** WebSocket e eventos
5. **Resolução de LID:** Como números são resolvidos
6. **Armazenamento:** Schema do banco de dados
7. **APIs:** Endpoints e protocolos utilizados
8. **Diagramas:** Sequências visuais dos fluxos

O sistema é robusto, com idempotência, tratamento de erros, migração automática e comunicação em tempo real eficiente.
