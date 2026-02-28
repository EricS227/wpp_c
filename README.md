# WPPConnector

Plataforma de atendimento ao cliente via WhatsApp com roteamento inteligente por departamentos, dashboard em tempo real e analytics.

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Banco de Dados](#4-banco-de-dados)
5. [Backend — Módulos e APIs](#5-backend--módulos-e-apis)
6. [Frontend — Páginas e Componentes](#6-frontend--páginas-e-componentes)
7. [Fluxos Principais](#7-fluxos-principais)
8. [WebSocket — Eventos em Tempo Real](#8-websocket--eventos-em-tempo-real)
9. [Configuração e Variáveis de Ambiente](#9-configuração-e-variáveis-de-ambiente)
10. [Docker e Deploy](#10-docker-e-deploy)
11. [Comandos de Desenvolvimento](#11-comandos-de-desenvolvimento)
12. [Segurança e Controle de Acesso](#12-segurança-e-controle-de-acesso)
13. [Bugs Conhecidos](#13-bugs-conhecidos)
14. [Diagrama de Arquitetura](#14-diagrama-de-arquitetura)

---

## 1. Visão Geral

O WPPConnector centraliza atendimentos do WhatsApp Business em um dashboard multi-agente. Os clientes são recebidos com uma saudação automática, escolhem o departamento via menu e são encaminhados ao agente disponível. Toda a comunicação é bidirecional e em tempo real via Socket.IO.

**Funcionalidades principais:**
- Roteamento automático de clientes para departamentos via menu interativo
- Reconhecimento de clientes que retornam com sugestão do último departamento atendido
- Dashboard com fila de conversas, janela de chat e painel de informações do cliente
- Suporte a texto, imagem, áudio, vídeo e documentos
- Rastreamento de status de mensagens (pendente → enviado → entregue → lido → falha)
- Notas internas por conversa (não enviadas ao cliente)
- Respostas rápidas (templates pré-definidos)
- Analytics e métricas de atendimento
- Log de auditoria completo
- Controle de acesso por papel (ADMIN / AGENT)

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| Backend | NestJS | 11.x |
| ORM | Prisma | 6.x |
| Banco de Dados | PostgreSQL | 15 |
| Cache / Fila | Redis | 7 |
| Frontend | Next.js (App Router) | 16.x |
| UI | React | 19.x |
| State | Zustand | 5.x |
| Data Fetching | TanStack Query | 5.x |
| Real-time | Socket.IO | 4.x |
| Estilização | Tailwind CSS | 4 |
| Componentes | shadcn/ui + Radix UI | — |
| WhatsApp Dev | WAHA | — |
| WhatsApp Prod | Meta Cloud API | — |
| Containers | Docker Compose | — |

---

## 3. Estrutura de Diretórios

```
wppconnector/
├── backend/
│   ├── src/
│   │   ├── main.ts                        # Entrypoint
│   │   ├── app.module.ts                  # Módulo raiz
│   │   └── modules/
│   │       ├── auth/                      # Autenticação JWT
│   │       ├── users/                     # Gestão de usuários
│   │       ├── conversations/             # Roteamento e ciclo de vida
│   │       ├── messages/                  # Envio e recebimento de mensagens
│   │       ├── departments/               # Departamentos e filas
│   │       ├── whatsapp/                  # Integração WhatsApp (WAHA / Meta)
│   │       │   ├── whatsapp.service.ts
│   │       │   ├── waha-webhook.controller.ts
│   │       │   ├── waha-polling.service.ts
│   │       │   ├── waha-files.controller.ts
│   │       │   ├── webhook.controller.ts  # Meta Cloud API
│   │       │   └── flow-engine.service.ts
│   │       ├── websocket/                 # Gateway Socket.IO
│   │       ├── audit/                     # Log de auditoria
│   │       ├── notifications/             # Notificações em tempo real
│   │       ├── metrics/                   # Analytics e KPIs
│   │       ├── quick-replies/             # Templates de resposta rápida
│   │       ├── settings/                  # Configurações do sistema
│   │       ├── health/                    # Health check
│   │       └── common/                    # Guards, filtros, decoradores compartilhados
│   └── prisma/
│       ├── schema.prisma
│       └── seeds/
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── login/
│       │   └── dashboard/
│       │       ├── page.tsx               # Interface principal (chat)
│       │       ├── contacts/
│       │       ├── audit/
│       │       ├── metrics/
│       │       ├── users/
│       │       └── settings/
│       ├── components/
│       │   ├── chat/
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── MessageInput.tsx
│       │   │   ├── ChatWindow.tsx
│       │   │   ├── ConversationList.tsx
│       │   │   ├── CustomerInfo.tsx
│       │   │   ├── QuickRepliesPanel.tsx
│       │   │   ├── ConversationNotes.tsx
│       │   │   └── CustomAudioPlayer.tsx
│       │   ├── layout/
│       │   ├── contacts/
│       │   └── ui/                        # shadcn/ui
│       ├── stores/
│       │   ├── authStore.ts
│       │   ├── chatStore.ts
│       │   └── notificationStore.ts
│       ├── hooks/
│       │   ├── useConversations.ts
│       │   ├── useMessages.ts
│       │   ├── useSocket.ts
│       │   ├── useMetrics.ts
│       │   ├── useAudit.ts
│       │   └── useUsers.ts
│       ├── lib/
│       │   ├── api-client.ts              # Axios com interceptors JWT
│       │   └── socket.ts                  # Socket.IO client
│       └── types/
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── nginx/
└── scripts/
```

---

## 4. Banco de Dados

**Provider:** PostgreSQL 15 via Prisma ORM

### Modelos

#### Company
Suporte multi-tenant. Cada empresa tem suas credenciais WhatsApp e configurações de atendimento.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String (CUID) | PK |
| name | String | Nome da empresa |
| whatsappPhoneNumberId | String? | ID do número (Meta API) |
| whatsappAccessToken | String? | Token de acesso |
| webhookVerifyToken | String? | Token de verificação webhook |
| greetingMessage | String? | Mensagem de boas-vindas |
| outOfOfficeMessage | String? | Mensagem fora do expediente |
| autoAssignEnabled | Boolean | Atribuição automática de agentes |
| businessHoursEnabled | Boolean | Controle de horário comercial |
| businessHoursStart | String? | Horário de início (ex: "08:00") |
| businessHoursEnd | String? | Horário de fim (ex: "18:00") |
| businessDays | Int[] | Dias da semana (0=Dom … 6=Sáb) |

#### Department
Unidades organizacionais para roteamento.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String | PK |
| companyId | String | FK Company |
| name | String | Nome exibível |
| slug | String | Identificador único (ex: "comercial") |
| description | String? | Descrição |
| color | String? | Cor para UI |
| isRoot | Boolean | Departamento raiz (recebe overflow) |
| isActive | Boolean | Ativo/inativo |
| responseTimeoutMinutes | Int | Timeout antes de escalar |
| maxAgents | Int? | Limite de agentes simultâneos |

#### User
Agentes e administradores.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String | PK |
| companyId | String | FK Company |
| departmentId | String? | FK Department |
| email | String | E-mail único por empresa |
| passwordHash | String | Bcrypt 10 rounds |
| name | String | Nome de exibição |
| role | Enum | ADMIN \| AGENT |
| isActive | Boolean | Ativo/inativo |

#### Conversation
Conversa de um cliente. Mantém o estado do fluxo de roteamento.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String | PK |
| companyId | String | FK Company |
| customerPhone | String | Telefone do cliente |
| customerName | String? | Nome do cliente |
| status | Enum | OPEN \| ASSIGNED \| RESOLVED \| ARCHIVED |
| flowState | Enum | GREETING \| DEPARTMENT_SELECTED \| ASSIGNED \| AWAITING_ROUTING_CONFIRMATION \| TIMEOUT_REDIRECT \| RESOLVED |
| departmentId | String? | FK Department |
| assignedUserId | String? | FK User (agente atual) |
| lastMessageAt | DateTime? | Timestamp da última mensagem |
| greetingSentAt | DateTime? | Timestamp do greeting enviado |
| timeoutAt | DateTime? | Prazo de timeout para escalonamento |
| unreadCount | Int | Mensagens não lidas pelo agente |
| metadata | Json? | Dados extras (ex: suggestedDepartmentId) |

#### Message
Mensagem individual em uma conversa.

| Campo | Tipo | Descrição |
|---|---|---|
| id | String | PK |
| conversationId | String | FK Conversation |
| whatsappMessageId | String? | ID do WhatsApp (idempotência) |
| direction | Enum | INBOUND \| OUTBOUND |
| type | Enum | TEXT \| IMAGE \| DOCUMENT \| AUDIO \| VIDEO |
| content | String? | Conteúdo textual |
| mediaUrl | String? | URL do arquivo de mídia |
| status | Enum | PENDING \| SENT \| DELIVERED \| READ \| FAILED |
| isBot | Boolean | Mensagem automática do bot |
| sentById | String? | FK User (agente remetente) |
| sentAt | DateTime? | Enviado em |
| deliveredAt | DateTime? | Entregue em |
| readAt | DateTime? | Lido em |
| metadata | Json? | Dados extras |

#### Outros Modelos
- **Assignment** — histórico de atribuições agente↔conversa
- **QuickReply** — templates de resposta rápida por empresa
- **ConversationNote** — notas internas por conversa
- **AuditLog** — log de todas as ações do sistema
- **PasswordResetRequest** — solicitações de reset de senha

---

## 5. Backend — Módulos e APIs

### Auth Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login com e-mail e senha |
| POST | `/api/auth/register` | Cadastro de novo usuário |

**Serviços:**
- `login()` — valida credenciais, retorna JWT
- `register()` — cria usuário com senha hasheada (bcrypt 10)
- JWT expira em 7 dias por padrão

---

### Conversations Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversations` | Listar conversas (filtrado por papel) |
| GET | `/api/conversations/:id` | Detalhe da conversa |
| PATCH | `/api/conversations/:id/status` | Atualizar status |
| POST | `/api/conversations/:id/assign` | Atribuir agente |
| POST | `/api/conversations/:id/transfer` | Transferir para departamento |

**ConversationRoutingService:**
- `checkAndSuggestPreviousRouting()` — detecta clientes que retornam e sugere último departamento
- Transições de estado do fluxo com guards para evitar regressão

**Filtragem por papel:**
- ADMIN vê todas as conversas da empresa
- AGENT vê apenas conversas do seu departamento + fila raiz não atribuída

---

### Messages Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/conversations/:id/messages` | Listar mensagens |
| POST | `/api/messages/send` | Enviar mensagem de texto |
| POST | `/api/messages/send-media` | Enviar arquivo/imagem |

**MessagesService:**
- `handleIncomingMessage()` — processa mensagem recebida com idempotência via `whatsappMessageId`
- `sendMessage()` — cria registro PENDING → envia → atualiza para SENT
- `updateMessageStatus()` — atualiza status via webhook (entregue/lido/falha)
- Mensagens saídas incluem prefixo: `*Nome do Agente - Departamento*: mensagem`

---

### WhatsApp Module

#### WhatsappService
- `sendTextMessage()` — envia texto via WAHA ou Meta API
- `sendMediaMessage()` — envia mídia via WAHA ou Meta API
- `markAsRead()` — marca mensagem como lida no WhatsApp
- `resolveLid()` — resolve LID (Linked ID) para número de telefone com múltiplos fallbacks

#### WahaWebhookController (`/api/waha/webhook`)
- Recebe eventos de mensagem do WAHA
- Processa ACK (status de entrega/leitura)
- Converte URLs de mídia para proxy interno

#### WahaPollingService
- Polling a cada 5 segundos no WAHA
- Processa mensagens não lidas
- Marca chats como lidos após processamento
- Idempotência via `whatsappMessageId`

#### FlowEngineService
- Envia saudação automática na primeira mensagem
- Processa escolha do menu (1–4 ou texto do departamento)
- Normaliza entrada do cliente (acentos, maiúsculas, sinônimos)

**Mapeamento do menu:**
```
1 → Laboratório   (lab, laudo, analise, qualidade, tecnico)
2 → Comercial     (vendas, pedido, cotacao, compra, preco)
3 → Financeiro    (boleto, nota, nf, pagamento, fatura, cobranca)
4 → Administrativo (adm, admin, rh, recursos humanos, fornecedor, geral)
```

---

### Departments Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/departments` | Listar departamentos |
| POST | `/api/departments` | Criar departamento |
| PATCH | `/api/departments/:id` | Atualizar departamento |
| GET | `/api/departments/:id/queue` | Fila do departamento |

**DepartmentRoutingService:**
- Balanceamento de carga round-robin na atribuição de agentes
- Cálculo de timeout por conversa
- `DepartmentRoutingCron` — verifica timeouts a cada 30 segundos e escala para departamento raiz

---

### Audit Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/audit-logs` | Consultar logs (ADMIN) |

**Filtros disponíveis:** userId, action, entity, data inicial/final
**Paginação:** cursor-based

---

### Metrics Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/metrics/dashboard` | Métricas gerais |
| GET | `/api/metrics/conversations` | Métricas de conversas |
| GET | `/api/metrics/agents` | Performance de agentes (ADMIN) |

**Métricas disponíveis:**
- Contagem de conversas por status
- Volume de mensagens (entrada/saída)
- Tempo médio de primeira resposta
- Distribuição de carga por agente
- Tamanho da fila por departamento

---

### Users Module

**Endpoints:**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/users` | Listar usuários |
| POST | `/api/users` | Criar usuário (ADMIN) |
| PATCH | `/api/users/:id` | Atualizar usuário (ADMIN) |

---

## 6. Frontend — Páginas e Componentes

### Páginas

| Rota | Acesso | Descrição |
|---|---|---|
| `/login` | Público | Login com e-mail e senha |
| `/dashboard` | ADMIN + AGENT | Dashboard principal (chat) |
| `/dashboard/contacts` | ADMIN + AGENT | Gestão de contatos |
| `/dashboard/metrics` | ADMIN + AGENT | Analytics e KPIs |
| `/dashboard/audit` | ADMIN | Log de auditoria |
| `/dashboard/users` | ADMIN | Gestão de usuários |
| `/dashboard/settings` | ADMIN | Configurações do sistema |

### Componentes de Chat

**MessageBubble.tsx**
Renderiza cada mensagem na janela de chat.
- Tipos: texto, imagem, áudio (CustomAudioPlayer), vídeo, documento
- Indicadores de status (clock, check simples, check duplo, check azul, X vermelho)
- Estilo diferenciado: bot, agente saída, cliente entrada

**MessageInput.tsx**
Campo de entrada do agente.
- Textarea auto-expansível
- Upload de arquivos (imagens, documentos, áudio, vídeo) — limite 10MB
- Botão de respostas rápidas
- Emite evento de typing via Socket.IO

**ChatWindow.tsx**
Container da lista de mensagens com auto-scroll.

**ConversationList.tsx**
Lista de conversas ordenadas por `lastMessageAt`.
- Badge de não lidas
- Indicador de cor do departamento
- Campo de busca

**CustomerInfo.tsx**
Painel lateral direito com dados do cliente, agente atribuído e histórico.

**QuickRepliesPanel.tsx**
Templates de resposta pré-definidos com busca.

**ConversationNotes.tsx**
Notas internas por conversa com autor e timestamp.

---

### State Management (Zustand)

**authStore:**
```typescript
{ user, token, setAuth(), logout(), hydrate() }
```

**chatStore:**
```typescript
{
  conversations, selectedConversationId, messages,
  typingUsers,
  setConversations(), selectConversation(),
  setMessages(), addMessage(), updateMessageStatus(),
  updateConversation(), incrementUnread(), resetUnread(),
  setTyping(), clearTyping()
}
```

**notificationStore:**
Fila de notificações toast com auto-dismiss.

---

### API Client

`lib/api-client.ts` — Axios com:
- `baseURL`: `NEXT_PUBLIC_API_URL` (padrão: `http://192.168.10.156:4000/api`)
- Interceptor de request: injeta `Authorization: Bearer <token>`
- Interceptor de response: no 401, limpa auth e redireciona para `/login`

---

## 7. Fluxos Principais

### 7.1 Mensagem Recebida (Inbound)

```
Cliente envia mensagem no WhatsApp
        ↓
WAHA recebe e dispara webhook (ou polling 5s)
        ↓
WahaWebhookController / WahaPollingService
        ↓
WhatsappService.resolveLid()    ← resolve LID para telefone
        ↓
MessagesService.handleIncomingMessage()
   ├─ Verifica idempotência por whatsappMessageId
   ├─ Upsert na tabela Conversation
   ├─ Cria registro Message
   └─ Determina próximo estado:
       ├─ Cliente novo         → FlowEngineService.sendGreeting()
       ├─ Cliente que retorna  → checkAndSuggestPreviousRouting()
       └─ Departamento já sel. → DepartmentRoutingService.routeToDepartment()
        ↓
WebsocketGateway emite 'new-message'
        ↓
Frontend atualiza chatStore → UI re-renderiza
```

### 7.2 Mensagem Enviada (Outbound)

```
Agente digita e envia no MessageInput
        ↓
useSendMessage() → chatStore.addMessage() [PENDING] ← atualização otimista
        ↓
POST /api/messages/send
        ↓
MessagesService.sendMessage()
   ├─ Cria Message [PENDING]
   ├─ Monta texto: "*Agente - Depto*: mensagem"
   └─ WhatsappService.sendTextMessage()
        ↓
Atualiza Message para SENT
        ↓
WebSocket emite 'message-status-update' para sala da conversa
```

### 7.3 Roteamento de Cliente Novo

```
Nova mensagem → Conversa em estado GREETING
        ↓
FlowEngineService envia menu de departamentos
        ↓
Cliente responde ("1", "Comercial", "vendas", etc.)
        ↓
FlowEngineService.processMenuChoice()
   └─ Normaliza entrada → mapeia para slug de departamento
        ↓
DepartmentRoutingService.routeToDepartment()
   ├─ Set conversation.departmentId
   ├─ Set flowState = DEPARTMENT_SELECTED
   ├─ Calcula timeoutAt = now + responseTimeoutMinutes
   ├─ WebSocket: 'conversation-queued' para o departamento
   └─ Tenta atribuir agente disponível
       ├─ Se disponível → Assignment criado, flowState = ASSIGNED
       └─ WebSocket: 'conversation-assigned' para o agente
```

### 7.4 Cliente que Retorna

```
Conversa existente → checkAndSuggestPreviousRouting()
        ↓
Query: última conversa resolvida com lastAttendedAt
   ├─ Encontrou:
   │  ├─ flowState = AWAITING_ROUTING_CONFIRMATION
   │  ├─ metadata.suggestedDepartmentId = id do depto
   │  └─ Envia: "Vimos que você foi atendido por [Setor]. Confirmar? SIM/NÃO"
   │
   └─ Não encontrou: retorna false → fluxo normal de saudação
        ↓
Cliente responde SIM / 1 / Y → aceita roteamento
Cliente responde NÃO / 0 / N → limpa sugestão, exibe menu
```

---

## 8. WebSocket — Eventos em Tempo Real

### Configuração
- Ping interval: 25s / Ping timeout: 60s
- Transports: WebSocket com fallback para polling
- Autenticação via JWT no handshake
- Reconexão automática (até 20 tentativas, backoff exponencial 500ms–5s)

### Salas (Rooms)
```
company:{companyId}          — todos da empresa
department:{departmentId}    — agentes do departamento
user:{userId}                — usuário individual
conversation:{conversationId} — participantes da conversa
```

### Eventos Emitidos pelo Backend

| Evento | Sala | Payload |
|---|---|---|
| `new-message` | conversation | `{ message }` |
| `message-status-update` | conversation | `{ messageId, status }` |
| `conversation-queued` | department | `{ conversation }` |
| `conversation-assigned` | user | `{ conversation, assignment }` |
| `conversation-transferred` | department | `{ conversation }` |
| `user-typing` | conversation | `{ userId, userName, isTyping }` |

### Eventos Emitidos pelo Frontend

| Evento | Descrição |
|---|---|
| `join-conversation` | Subscreve a uma conversa |
| `leave-conversation` | Cancela subscrição |
| `user-typing` | Indica que o agente está digitando |

---

## 9. Configuração e Variáveis de Ambiente

### `.env` (Desenvolvimento)

```env
# Banco de dados
DATABASE_URL=postgresql://whatsapp:dev_password@192.168.10.156:5434/whatsapp_db

# Redis
REDIS_URL=redis://192.168.10.156:6380

# Backend
PORT=4000
NODE_ENV=development
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_256bits
JWT_EXPIRES_IN=7d

# WAHA (desenvolvimento)
WAHA_API_URL=http://192.168.10.156:3101
WAHA_API_KEY=wpp_waha_dev_key_2024
WAHA_SESSION=default

# Frontend
FRONTEND_URL=http://192.168.10.156:3100
NEXT_PUBLIC_API_URL=http://192.168.10.156:4000/api
NEXT_PUBLIC_WS_URL=ws://192.168.10.156:4000

# Logs
LOG_LEVEL=debug
```

### `.env.production.example` (Produção)
Substitui WAHA pelas credenciais da Meta Cloud API. Todas as URLs devem usar HTTPS.

---

## 10. Docker e Deploy

### Serviços (docker-compose.yml)

| Serviço | Imagem | Porta | Volume |
|---|---|---|---|
| PostgreSQL | postgres:15 | 5434 | postgres_data |
| Redis | redis:7 | 6380 | redis_data |
| WAHA | devlikeapro/waha | 3101 | waha_sessions |

Rede: `wpp-network` (bridge)

### Produção
- `docker-compose.prod.yml` — configuração de produção
- `nginx/nginx.conf` — reverse proxy com SSL/TLS
- Backend pode ser escalado horizontalmente
- Recomendado: PostgreSQL e Redis gerenciados (RDS, ElastiCache, etc.)
- Meta Cloud API em vez de WAHA

### Portas padrão

| Serviço | Porta |
|---|---|
| Frontend (Next.js) | 3100 |
| Backend (NestJS) | 4000 |
| WAHA | 3101 |
| PostgreSQL | 5434 |
| Redis | 6380 |
| Prisma Studio | 5555 |

---

## 11. Comandos de Desenvolvimento

### Backend

```bash
cd backend

# Desenvolvimento (hot reload)
npm run start:dev

# Build
npm run build

# Testes
npm run test
npm run test:cov
npm run test:e2e

# Prisma
npm run prisma:migrate        # Criar e aplicar migração
npm run prisma:migrate:deploy # Aplicar migrações em produção
npm run prisma:generate       # Regenerar cliente Prisma
npm run prisma:studio         # Abrir Prisma Studio (localhost:5555)
npm run prisma:seed           # Executar seed padrão
npm run prisma:seed:setup     # Setup inicial SIM Estearina
npm run prisma:reset:passwords # Resetar senhas de todos os usuários
```

### Frontend

```bash
cd frontend

# Desenvolvimento (hot reload, porta 3100)
npm run dev

# Build de produção
npm run build

# Iniciar build produção
npm run start
```

---

## 12. Segurança e Controle de Acesso

### Papéis

| Papel | Permissões |
|---|---|
| **ADMIN** | Acesso total: users, audit, settings, metrics, todas as conversas |
| **AGENT** | Apenas conversas do próprio departamento + fila raiz não atribuída |

### Proteções

- Senhas com bcrypt (10 rounds)
- JWT com expiração de 7 dias
- `JwtAuthGuard` global (exceto rotas marcadas com `@Public()`)
- `RolesGuard` com decorator `@Roles('ADMIN')` nas rotas restritas
- Rate limiting: 60 requisições / 60 segundos (global)
- CORS restrito à URL do frontend
- `ValidationPipe` com `whitelist: true` e `forbidNonWhitelisted: true`

---

## 13. Bugs Conhecidos

### BUG-1: Mensagem de Boas-vindas Duplicada
**Prioridade:** Alta
**Status:** Existe, sem correção

- **Causa:** Webhook + Polling processam o mesmo fluxo em paralelo.
  `checkAndSuggestPreviousRouting()` envia uma mensagem e `sendGreeting()` envia outra — sem mutex/lock.
- **Solução necessária:**
  Adicionar lock/mutex no processamento por `customerPhone+companyId` e checar `greetingSentAt` antes de enviar.

---

### BUG-2: Reply/Citação Não Exibida no Dashboard
**Prioridade:** Alta
**Status:** Não implementado

- **Causa:** O schema Prisma não tem campos para dados de reply; o webhook handler não extrai `contextInfo`/`replyMessage` do payload WAHA; o `MessageBubble.tsx` não tem UI de citação.
- **Solução necessária:**
  1. Migração no schema: adicionar `repliedToMessageId` e `quotedMessageContent` em `Message`
  2. Parsing no webhook: extrair `contextInfo` do payload
  3. Componente de quote no `MessageBubble.tsx`

---

### BUG-3: Tamanho de Imagens/Documentos Inconsistente
**Prioridade:** Média
**Status:** Parcial (funcional, sem padronização)

- **Causa:** Imagens não têm `max-width`/`max-height` no `MessageBubble`; proxy de arquivos serve sem compressão; sem geração de thumbnails.
- **Solução necessária:**
  1. Adicionar `max-w-xs max-h-64 object-contain` nas imagens do `MessageBubble`
  2. Server-side resize com Sharp
  3. Geração de thumbnails no upload

---

## 14. Diagrama de Arquitetura

```
Clientes WhatsApp
        │
        ▼
┌─────────────────────────────────────────┐
│         WAHA / Meta Cloud API           │
│         (Integração WhatsApp)           │
└─────────────────────────────────────────┘
        │  webhook / polling (5s)
        ▼
┌────────────────────────────────────────────────────────────┐
│                  BACKEND — NestJS (porta 4000)             │
│                                                            │
│  REST API  +  Socket.IO Gateway                           │
│                                                            │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │   Auth   │  │Conversations│  │     WhatsApp         │   │
│  │  (JWT)   │  │ (Routing)  │  │  (WAHA + Meta)       │   │
│  └──────────┘  └────────────┘  └─────────────────────┘   │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │ Messages │  │Departments │  │  Flow Engine         │   │
│  └──────────┘  └────────────┘  └─────────────────────┘   │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────────┐   │
│  │  Audit   │  │  Metrics   │  │  WebSocket Gateway   │   │
│  └──────────┘  └────────────┘  └─────────────────────┘   │
│                                                            │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │  PostgreSQL 15          │  │  Redis 7             │   │
│  │  (Dados persistentes)   │  │  (Fila + Cache)      │   │
│  └─────────────────────────┘  └──────────────────────┘   │
└────────────────────────────────────────────────────────────┘
        │  REST (HTTP/JSON)  +  Socket.IO
        ▼
┌────────────────────────────────────────────────────────────┐
│             FRONTEND — Next.js 16 (porta 3100)             │
│                                                            │
│  Dashboard (Chat)  │  Contacts  │  Metrics  │  Settings   │
│  Audit  │  Users   │  Login                               │
│                                                            │
│  Zustand (state)  │  TanStack Query (data)               │
│  Socket.IO client (real-time)  │  Tailwind + shadcn/ui   │
└────────────────────────────────────────────────────────────┘
        │
        ▼
  Agentes e Administradores
```

---

*Documento gerado em 27/02/2026 — WPPConnector*
