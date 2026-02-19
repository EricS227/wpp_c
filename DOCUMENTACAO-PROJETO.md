# WPPConnector — Documentação Completa do Projeto

Este documento descreve o projeto **WPPConnector** de ponta a ponta: objetivo, arquitetura, componentes, fluxos e operação.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Arquitetura do Sistema](#4-arquitetura-do-sistema)
5. [Backend (NestJS)](#5-backend-nestjs)
6. [Frontend (Next.js)](#6-frontend-nextjs)
7. [Integração WhatsApp](#7-integração-whatsapp)
8. [WebSocket e Tempo Real](#8-websocket-e-tempo-real)
9. [Banco de Dados](#9-banco-de-dados)
10. [Docker e Infraestrutura](#10-docker-e-infraestrutura)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Scripts e Operação](#12-scripts-e-operação)
13. [Segurança](#13-segurança)
14. [Documentos Relacionados](#14-documentos-relacionados)

---

## 1. Visão Geral

### O que é o WPPConnector

O **WPPConnector** é um sistema de **atendimento multicanal** que conecta o **WhatsApp** a um **painel web** para atendentes. Clientes enviam mensagens pelo WhatsApp; atendentes respondem pelo navegador em tempo real.

### Objetivos principais

- Receber mensagens do WhatsApp (texto, imagem, áudio, vídeo, documento) e exibi-las no painel.
- Permitir que atendentes respondam pelo painel; as respostas são enviadas pelo WhatsApp.
- Atribuir conversas a atendentes, controlar status (aberta, em atendimento, resolvida, arquivada) e manter histórico.
- Oferecer métricas, auditoria, respostas rápidas e suporte a múltiplos usuários (admin e atendente).

### Modos de integração WhatsApp

O projeto suporta dois provedores:

- **WAHA (WhatsApp HTTP API):** servidor que mantém uma sessão WhatsApp Web; o backend faz **polling** ou recebe **webhooks** para novas mensagens.
- **Meta Cloud API (WhatsApp Business API):** API oficial da Meta; o backend recebe eventos via **webhook** e envia mensagens via API REST.

---

## 2. Stack Tecnológica

| Camada        | Tecnologia |
|---------------|------------|
| **Backend**   | NestJS 11, Node.js, TypeScript |
| **ORM / DB**  | Prisma, PostgreSQL 15 |
| **Cache**     | Redis 7 |
| **Autenticação** | JWT (Passport), bcrypt |
| **WebSocket** | Socket.IO (@nestjs/websockets, socket.io-client) |
| **Frontend**  | Next.js 16, React 19, TypeScript |
| **Estado / API no frontend** | Zustand, TanStack Query (React Query), Axios |
| **UI**        | Tailwind CSS 4, Radix UI, shadcn/ui, Lucide React |
| **WhatsApp**  | WAHA (devlikeapro/waha) e/ou Meta Cloud API |
| **Infra**     | Docker, Docker Compose, Nginx (produção) |

---

## 3. Estrutura do Projeto

```
wppconnector/
├── backend/                    # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos e enums do banco
│   │   └── seed.ts             # Dados iniciais (empresa, admin, atendentes)
│   ├── src/
│   │   ├── main.ts             # Bootstrap da aplicação
│   │   ├── app.module.ts       # Módulo raiz
│   │   ├── prisma/             # Serviço Prisma
│   │   ├── common/             # Filtros, guards, decorators
│   │   └── modules/
│   │       ├── auth/           # Login, JWT
│   │       ├── users/          # CRUD usuários
│   │       ├── conversations/  # Conversas, atribuição, status
│   │       ├── messages/       # Envio e histórico de mensagens
│   │       ├── whatsapp/       # WAHA (polling/webhook) e Meta
│   │       ├── websocket/      # Gateway Socket.IO
│   │       ├── health/         # Health check
│   │       ├── metrics/        # Dashboard e métricas
│   │       ├── audit/           # Logs de auditoria
│   │       ├── quick-replies/  # Respostas rápidas
│   │       └── system/         # Endpoints de sistema
│   ├── test/                   # Testes e2e
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # Aplicação Next.js
│   ├── src/
│   │   ├── app/                # Rotas (App Router)
│   │   │   ├── page.tsx        # Página inicial
│   │   │   ├── login/          # Login
│   │   │   └── dashboard/      # Chat, usuários, métricas, auditoria, settings
│   │   ├── components/         # Layout, chat, auth, UI (shadcn)
│   │   ├── hooks/              # useAuth, useSocket, useConversations, etc.
│   │   ├── lib/                # api-client, socket, utils
│   │   ├── stores/             # authStore, chatStore (Zustand)
│   │   └── types/              # user, conversation, message
│   ├── Dockerfile
│   └── package.json
│
├── scripts/
│   ├── backup.sh               # Backup PostgreSQL e Redis
│   ├── setup-ssl.sh            # SSL Let's Encrypt
│   ├── deploy.sh               # Deploy
│   └── setup-vm.sh             # Preparação da VM
│
├── docker-compose.yml          # Desenvolvimento: Postgres, Redis, WAHA
├── docker-compose.prod.yml     # Produção: + backend, frontend, nginx
├── .env.example                # Exemplo env desenvolvimento
├── .env.production.example     # Exemplo env produção
├── CHECKLIST.md                # Checklist de homologação e deploy
├── COMO-RODAR.md               # Como rodar localmente (Windows/Manual)
├── ANALISE-TECNICA-FLUXO-CONVERSA.md  # Fluxos detalhados WhatsApp ↔ Painel
├── GUIA-RESOLUCAO-LID-WAHA.md  # Resolução de LID com WAHA
└── DOCUMENTACAO-PROJETO.md     # Este documento
```

---

## 4. Arquitetura do Sistema

### Diagrama de alto nível

```
                    WhatsApp (cliente)
                           │
                           ▼
              ┌────────────────────────┐
              │  WAHA ou Meta Cloud API │
              └────────────┬───────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐      ┌──────────┐     ┌──────────┐
   │ Postgres │      │  Backend │     │  Redis   │
   │          │◄────►│  NestJS  │     │ (cache)  │
   └──────────┘      └────┬─────┘     └──────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        REST API   WebSocket   Webhooks
              │          │          │
              └──────────┼──────────┘
                         ▼
                  ┌──────────────┐
                  │   Frontend   │
                  │   Next.js    │
                  └──────────────┘
```

### Fluxo resumido

1. **Mensagem recebida:** WhatsApp → WAHA/Meta → Backend (polling ou webhook) → persistência e WebSocket → Frontend atualiza em tempo real.
2. **Mensagem enviada:** Atendente envia no painel → Backend → WAHA/Meta → WhatsApp do cliente; backend emite evento WebSocket para atualizar a tela.

Detalhes completos dos fluxos estão em **ANALISE-TECNICA-FLUXO-CONVERSA.md**.

---

## 5. Backend (NestJS)

### 5.1 Entrada da aplicação

- **Arquivo:** `backend/src/main.ts`
- **Prefixo global da API:** `/api` (exceto `webhooks/whatsapp` e `webhooks/waha`).
- **Configurações globais:** CORS (origem do frontend), `ValidationPipe` (whitelist, transform), filtro de exceções, Throttler (rate limit).
- **Porta:** 4000 (ou `PORT`).

### 5.2 Módulos principais

| Módulo           | Responsabilidade |
|------------------|------------------|
| **AuthModule**   | Login (email/senha), emissão e validação de JWT, estratégia Passport JWT. |
| **UsersModule**  | CRUD de usuários da empresa; perfis ADMIN e AGENT; senha nunca retornada. |
| **ConversationsModule** | Listar/buscar conversas, detalhe, mensagens paginadas, atribuir/desatribuir, alterar status, marcar como lida. |
| **MessagesModule** | Enviar mensagem (POST), buscar mensagens da conversa, busca global de mensagens. |
| **WhatsappModule** | Integração com WAHA (polling + webhook) e/ou Meta; resolução de LID; envio de texto e marcação de leitura. |
| **WebsocketModule** | Gateway Socket.IO: salas por empresa e por conversa; eventos message-received, message-sent, typing, etc. |
| **HealthModule**  | Health check (ex.: `/api/health`) com verificação de conexão ao banco. |
| **MetricsModule** | Métricas para dashboard (totais por status, mensagens, tempo de resposta, performance por atendente). |
| **AuditModule**   | Logs de auditoria (ação, entidade, usuário, data); apenas ADMIN. |
| **QuickRepliesModule** | CRUD de respostas rápidas por empresa. |
| **SystemModule**  | Endpoints auxiliares de sistema. |

### 5.3 Autenticação e autorização

- **Login:** `POST /api/auth/login` (email, senha) → retorna JWT.
- **Usuário atual:** `GET /api/auth/me` (header `Authorization: Bearer <token>`).
- **Roles:** `ADMIN` (acesso total, inclusive usuários e auditoria) e `AGENT` (chat, métricas, respostas rápidas; sem usuários/auditoria).
- **Guards:** `JwtAuthGuard` e `RolesGuard`; decorators `@Roles()`, `@CurrentUser()`.

### 5.4 Principais endpoints da API

- **Auth:** `POST /api/auth/login`, `GET /api/auth/me`
- **Users:** `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` (admin)
- **Conversations:** `GET /api/conversations`, `GET /api/conversations/:id`, `GET /api/conversations/:id/messages`, `POST .../assign`, `POST .../unassign`, `PATCH .../status`, `POST .../read`
- **Messages:** `POST /api/messages/send`, `GET /api/messages/search`
- **Metrics:** `GET /api/metrics/dashboard`, `.../conversations`, `.../agents`
- **Audit:** `GET /api/audit` (admin)
- **Quick-replies:** `GET/POST /api/quick-replies`, `PATCH/DELETE /api/quick-replies/:id`
- **Health:** `GET /api/health`
- **Webhooks:** `GET/POST /webhooks/whatsapp` (Meta), `POST /webhooks/waha` (WAHA) — fora do prefixo `/api`

---

## 6. Frontend (Next.js)

### 6.1 Rotas (App Router)

- **`/`** — Página inicial (redireciona ou landing).
- **`/login`** — Formulário de login; após sucesso redireciona para o dashboard.
- **`/dashboard`** — Chat: lista de conversas + janela de mensagens + painel do cliente (CustomerInfo).
- **`/dashboard/users`** — Gestão de usuários (admin).
- **`/dashboard/metrics`** — Dashboard de métricas.
- **`/dashboard/audit`** — Logs de auditoria (admin).
- **`/dashboard/settings`** — Configurações.

### 6.2 Estado e dados

- **Zustand:** `authStore` (token, usuário, login/logout), `chatStore` (conversas, mensagens, conversa selecionada, não lidas).
- **TanStack Query:** chamadas à API (conversations, messages, users, metrics, audit, quick-replies) com cache e invalidação.
- **API HTTP:** `src/lib/api-client.ts` (Axios, baseURL, interceptor com JWT e redirecionamento em 401).

### 6.3 WebSocket no frontend

- **Conexão:** `src/lib/socket.ts` + hook `useSocket.ts`; URL em `NEXT_PUBLIC_WS_URL`; autenticação via `auth.token` (JWT).
- **Eventos tratados:** `message-received`, `message-sent`, `message-status-updated`, `user-typing`.
- **Ações:** entrar/sair de sala de conversa (`join-conversation`, `leave-conversation`), emitir `typing-start` / `typing-stop`.

### 6.4 Componentes principais

- **Layout:** Sidebar, Header.
- **Chat:** ConversationList, ChatWindow, MessageBubble, MessageInput, CustomerInfo.
- **Auth:** LoginForm.
- **UI:** Componentes shadcn (Button, Card, Dialog, Input, Table, etc.).

---

## 7. Integração WhatsApp

### 7.1 WAHA (WhatsApp HTTP API)

- **Container:** `devlikeapro/waha`; porta 3101 (dev).
- **Uso:** Sessão WhatsApp Web (ex.: `default`); o backend pode usar **polling** (ex.: a cada 5s) em `/api/{session}/chats/overview` e em seguida buscar mensagens por chat, ou receber eventos via **webhook** configurado no WAHA.
- **Endpoints WAHA usados (exemplos):** chats/overview, chats/{chatId}/messages, contacts (resolução LID), sendText, marcar como lida.
- **Resolução LID:** O WhatsApp pode devolver IDs no formato `@lid`. O backend chama `/api/contacts` do WAHA para obter o número real e armazena: número real em `customerPhone`, ID original em `metadata.chatId` para envio. Ver **GUIA-RESOLUCAO-LID-WAHA.md** e **ANALISE-TECNICA-FLUXO-CONVERSA.md**.

### 7.2 Meta Cloud API (WhatsApp Business API)

- **Configuração:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WEBHOOK_VERIFY_TOKEN`.
- **Webhook:** URL configurada no Meta Developer Portal (ex.: `https://dominio.com/webhooks/whatsapp`); verificação GET (verify token) e recebimento de eventos POST (messages, message_deliveries, message_reads).
- **Envio:** POST para Graph API (`/v21.0/{phoneNumberId}/messages`) com Bearer token.

### 7.3 Escolha do provedor

- Definida por variável/flag no backend (ex.: `WHATSAPP_PROVIDER=WAHA` ou `META`); o mesmo backend pode ter código para ambos e alternar por configuração.

---

## 8. WebSocket e Tempo Real

- **Biblioteca:** Socket.IO (backend: `@nestjs/websockets` + `socket.io`; frontend: `socket.io-client`).
- **Autenticação:** JWT no handshake (`auth.token` ou header `Authorization`); o servidor associa `userId` e `companyId` e coloca o cliente na sala `company:{companyId}`.
- **Salas:** `company:{companyId}` (entrada automática); `conversation:{conversationId}` (entrada ao abrir a conversa).
- **Eventos servidor → cliente:** `message-received`, `message-sent`, `message-status-updated`, `user-typing`.
- **Eventos cliente → servidor:** `join-conversation`, `leave-conversation`, `typing-start`, `typing-stop`.
- **Reconexão:** Configurada no cliente (ex.: reconexão automática com limite de tentativas).

---

## 9. Banco de Dados

### 9.1 Prisma e PostgreSQL

- **Schema:** `backend/prisma/schema.prisma`.
- **Principais modelos:**
  - **Company:** nome, credenciais WhatsApp (phoneNumberId, accessToken, webhookVerifyToken).
  - **User:** email, passwordHash, name, role (ADMIN/AGENT), companyId.
  - **Conversation:** companyId, customerPhone, customerName, status (OPEN, ASSIGNED, RESOLVED, ARCHIVED), unreadCount, lastMessageAt, metadata (ex.: chatId, pushname para LID).
  - **Assignment:** conversa ↔ usuário (atribuição).
  - **Message:** conversationId, direction (INBOUND/OUTBOUND), type (TEXT, IMAGE, AUDIO, VIDEO, DOCUMENT), content, mediaUrl, status (PENDING, SENT, DELIVERED, READ, FAILED), whatsappMessageId (único, para idempotência), sentById.
  - **QuickReply:** companyId, title, content, shortcut.
  - **AuditLog:** companyId, userId, action, entity, entityId, metadata, timestamp.

### 9.2 Migrações e seed

- **Migrações:** `npx prisma migrate dev` (dev), `prisma migrate deploy` (produção).
- **Seed:** `npx prisma db seed` (ou `ts-node prisma/seed.ts`); cria a empresa `SIM Estearina Indústria e Comércio Ltda`, usuário admin (ex.: admin@empresa.com / admin123) e atendentes (ex.: atendente@empresa.com / agent123). **Importante:** trocar credenciais e senhas em produção.

---

## 10. Docker e Infraestrutura

### 10.1 Desenvolvimento (`docker-compose.yml`)

- **postgres:** PostgreSQL 15, porta 5434, volume `postgres_data`.
- **redis:** Redis 7, porta 6380, volume `redis_data`.
- **waha:** WAHA, porta 3101, volume para sessões; variáveis como `WAHA_API_KEY`, `WHATSAPP_HOOK_URL` (webhook do backend), `WHATSAPP_HOOK_EVENTS`, `WHATSAPP_START_SESSION=default`.

Backend e frontend costumam rodar no host (`npm run start:dev` e `npm run dev`) apontando para esses serviços. Ver **COMO-RODAR.md**.

### 10.2 Produção (`docker-compose.prod.yml`)

- **postgres**, **redis:** sem portas expostas para fora; rede interna.
- **backend:** build do Dockerfile do backend; variáveis de ambiente (DB, Redis, JWT, WhatsApp, FRONTEND_URL, etc.); depende de postgres e redis.
- **frontend:** build do Dockerfile do frontend; `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`.
- **nginx:** reverse proxy (ex.: porta 8180); serve frontend e proxy para API e WebSocket; em produção real pode usar 80/443 e certificado SSL (ex.: script `setup-ssl.sh` com certbot).

---

## 11. Variáveis de Ambiente

### 11.1 Desenvolvimento (raiz ou backend)

- **Banco:** `DATABASE_URL=postgresql://whatsapp:dev_password@HOST:5434/whatsapp_db`
- **Redis:** `REDIS_URL=redis://HOST:6380`
- **Backend:** `PORT=4000`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`, `FRONTEND_URL=http://...:3100`
- **WhatsApp (Meta):** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WEBHOOK_VERIFY_TOKEN`
- **WAHA:** `WAHA_API_URL=http://...:3101`, `WAHA_API_KEY`, `WAHA_SESSION`

### 11.2 Frontend

- `NEXT_PUBLIC_API_URL=http://...:4000/api`
- `NEXT_PUBLIC_WS_URL=ws://...:4000` (ou `wss://` em produção)

### 11.3 Produção

- Usar `.env.production.example` como base; definir senhas fortes, `JWT_SECRET` aleatório, URLs públicas (API, WS, FRONTEND_URL) e credenciais WhatsApp. Nunca commitar `.env` ou `.env.production`.

---

## 12. Scripts e Operação

- **`scripts/backup.sh`:** Backup do PostgreSQL (pg_dump + gzip) e do Redis (dump.rdb); remove backups com mais de 7 dias; pensado para execução em cron (ex.: diário às 2h).
- **`scripts/setup-ssl.sh`:** Geração de certificado Let's Encrypt para um domínio e recarregar Nginx (uso típico após deploy com domínio).
- **`scripts/deploy.sh`** / **`scripts/setup-vm.sh`:** Automatização de deploy e preparação de VM (consultar conteúdo para detalhes).

Em Windows, **COMO-RODAR.md** cita scripts como `start.bat` e `stop.bat` para subir/parar frontend e backend; Docker (Postgres, Redis, WAHA) pode continuar rodando separadamente.

---

## 13. Segurança

- **Senhas:** bcrypt (ex.: 10 rounds); nunca retornar `passwordHash` na API.
- **JWT:** assinatura com `JWT_SECRET` forte; expiração (ex.: 7 dias).
- **Rate limiting:** Throttler (ex.: 60 requisições/minuto por IP); webhooks podem ser excluídos do throttle.
- **Validação:** ValidationPipe com whitelist e forbidNonWhitelisted nos DTOs.
- **CORS:** restrito à origem do frontend (desenvolvimento e produção).
- **HTTPS:** em produção; HTTP pode redirecionar para HTTPS (Nginx + certbot).
- **Secrets:** todas as chaves e senhas em variáveis de ambiente; `.env` no `.gitignore`.

---

## 14. Documentos Relacionados

| Documento | Conteúdo |
|-----------|----------|
| **CHECKLIST.md** | Checklist de homologação e deploy: pré-requisitos, build, SSL, testes funcionais (API e frontend), integração WhatsApp, WebSocket, backup, performance e segurança. |
| **COMO-RODAR.md** | Como parar a aplicação; opção com script único (ex.: `start.bat`) e passo a passo manual (Docker, backend, frontend) e troubleshooting. |
| **ANALISE-TECNICA-FLUXO-CONVERSA.md** | Análise técnica detalhada: arquitetura, fluxo de recebimento e envio de mensagens, WebSocket, resolução de LID, armazenamento, APIs (WAHA e backend), diagramas de sequência. |
| **GUIA-RESOLUCAO-LID-WAHA.md** | Guia prático para resolver @lid para número real usando o endpoint `/api/contacts` do WAHA e onde armazenar número vs. chatId. |

---

**Versão do documento:** 1.0  
**Projeto:** WPPConnector (MVP 1.0)  
**Data:** Fevereiro 2025
