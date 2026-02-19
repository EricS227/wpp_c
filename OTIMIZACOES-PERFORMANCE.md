# 🚀 Guia de Otimizações de Performance - WPPConnector

## Problema Identificado: Sistema Lento

O erro de WebSocket pode estar relacionado ao backend estar lento respondendo.

---

## 1. Verificar Performance do Backend

### Habilitar Debug Logging
Edite `.env`:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

Reinicie o backend:
```bash
docker restart wpp-backend
```

### Verificar Tempo de Resposta
```bash
# Teste simples
time curl http://192.168.10.156:4000/api/health

# Teste com timing detalhado
curl -w "@curl-format.txt" -o /dev/null -s http://192.168.10.156:4000/api/health
```

---

## 2. Otimizações de Banco de Dados

### 2.1 Adicionar Índices Essenciais

Conecte ao PostgreSQL:
```bash
docker exec -it wpp-postgres psql -U postgres -d wppconnector
```

Execute:
```sql
-- Índices para melhorar queries
CREATE INDEX IF NOT EXISTS idx_users_company_id ON "users"("companyId");
CREATE INDEX IF NOT EXISTS idx_conversations_company_on_line ON "conversations"("companyId", "status");
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON "conversations"("assignedToUserId");
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON "messages"("conversationId");
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON "messages"("sentAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_timestamp ON "auditLogs"("companyId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_heartbeat ON "users"("lastHeartbeatAt");

-- Analisar plano de query
ANALYZE;

-- Verificar índices criados
SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
```

### 2.2 Otimizar Configurações PostgreSQL

Edite `docker-compose.yml` - seção PostgreSQL:
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: ${POSTGRES_DB}
  command:
    - "postgres"
    - "-c"
    - "shared_buffers=256MB"       # Aumentar memória compartilhada
    - "-c"
    - "max_connections=200"        # Suportar mais conexões
    - "-c"
    - "effective_cache_size=1024MB"
    - "-c"
    - "work_mem=16MB"
    - "-c"
    - "maintenance_work_mem=64MB"
```

Reinicie:
```bash
docker compose restart postgres
```

---

## 3. Otimizações de Aplicação

### 3.1 Disable Heartbeat Desnecessário

Se o heartbeat está causando queries:

**Arquivo**: `backend/src/modules/websocket/websocket.gateway.ts`

```typescript
@SubscribeMessage('heartbeat')
async handleHeartbeat(@ConnectedSocket() client: Socket) {
  const userId = client.data.userId;
  if (userId) {
    // OTIMIZAÇÃO: Chamar heartbeat apenas a cada 30 segundos
    const now = Date.now();
    if (!client.data.lastHeartbeatCheck) {
      client.data.lastHeartbeatCheck = now;
      await this.agentStatusService.heartbeat(userId);
    } else if (now - client.data.lastHeartbeatCheck > 30000) {
      client.data.lastHeartbeatCheck = now;
      await this.agentStatusService.heartbeat(userId);
    }
  }
}
```

### 3.2 Lazy Load Relacionamentos

**Arquivo**: `backend/src/modules/messages/messages.service.ts`

```typescript
// ANTES (carrega tudo)
const conversation = await this.prisma.conversation.findUnique({
  where: { id },
  include: {
    assignedTo: true,
    department: true,
    company: true,
    messages: true,
    customFields: true,
  }
});

// DEPOIS (carrega só o necessário)
const conversation = await this.prisma.conversation.findUnique({
  where: { id },
  include: {
    assignedTo: { select: { id: true, name: true, email: true } },
    department: { select: { id: true, name: true } },
    company: { select: { id: true, name: true } },
    // NÃO carrega messages aqui!
  }
});

// Carregar messages separadamente se necessário
if (needMessages) {
  const messages = await this.prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { sentAt: 'desc' },
    take: 50,
  });
}
```

### 3.3 Implementar Caching Redis

**Arquivo**: `backend/src/modules/users/agent-status.service.ts`

```typescript
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AgentStatusService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async heartbeat(userId: string) {
    // OTIMIZAÇÃO: Check cache antes de query
    const lastHeartbeat = await this.cacheManager.get(`heartbeat:${userId}`);
    
    if (lastHeartbeat) {
      // Dentro de 10 segundos, não atualiza
      return;
    }

    // Update no banco
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastHeartbeatAt: new Date() },
    });

    // Armazenar em cache por 10 segundos
    await this.cacheManager.set(`heartbeat:${userId}`, true, 10000);
  }
}
```

---

## 4. Otimizações Frontend

### 4.1 Implementar Backoff Exponencial

**Arquivo**: `frontend/src/lib/socket.ts` (já implementado)

```typescript
reconnectionDelay: 500,              // Começa em 500ms
reconnectionDelayMax: 5000,          // Máximo de 5 segundos
```

### 4.2 Implementar Healthcheck

```typescript
// Adicionar após conectSocket()
export function setupHealthCheck(socket: Socket) {
  setInterval(() => {
    socket.emit('check-health', {}, (response) => {
      if (!response.ok) {
        console.warn('[Health] Backend está lentoaquire');
      }
    });
  }, 30000); // A cada 30 segundos
}
```

---

## 5. Monitoramento em Tempo Real

### 5.1 Habilitar Prometheus

Instale a extensão Prometheus no backend:

```bash
npm install @willsoto/nestjs-prometheus prom-client
```

### 5.2 Criar Dashboard Grafana

```json
{
  "dashboard": {
    "title": "WPPConnector Performance",
    "panels": [
      {
        "title": "API Response Time",
        "targets": ["histogram_quantile(0.95, rate(http_request_duration_ms[5m]))"]
      },
      {
        "title": "WebSocket Connections",
        "targets": ["socket_io_connected_sockets"]
      },
      {
        "title": "Database Pool",
        "targets": ["prisma_db_pool_idle"]
      }
    ]
  }
}
```

---

## 6. Checklist de Otimização

- [ ] Índices PostgreSQL criados
- [ ] Configuração PostgreSQL otimizada
- [ ] Lazy loading implementado
- [ ] Heartbeat throttling implementado
- [ ] Caching Redis configurado
- [ ] Logs debug habilitados
- [ ] Monitoramento ativo
- [ ] Performance abaixo de 200ms

---

## 7. Benchmarking

Teste performance antes e depois:

```bash
# Ferramentas recomendadas
npm install -g autocannon  # Teste de carga
npm install -g clinic      # Profiling de performance

# Teste WebSocket simples
autocannon -c 10 -d 30 http://192.168.10.156:4000/api/health

# Profiling detalhado
clinic doctor -- npm start
```

---

## 🔧 Próximas Ações

1. **Imediato**: Adicionar índices ao banco de dados
2. **Curto Prazo**: Implementar lazy loading e heartbeat throttling
3. **Médio Prazo**: Adicionar redis caching
4. **Longo Prazo**: Implementar monitoramento com Prometheus/Grafana
