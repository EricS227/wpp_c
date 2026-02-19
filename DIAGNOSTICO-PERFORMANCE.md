# 🔍 Diagnóstico de Performance e Erros - WPPConnector

## Problemas Identificados

### 1. ❌ WebSocket Connection Error "xhr poll error"

**Causas Raízes:**
- Timeout muito alto (20s) fazendo cliente esperar demais
- Reconnection strategy ineficiente
- Falta de configuração explícita de transports e ping/pong
- possível backend lento ou não respondendo

**Soluções Implementadas:**
- ✅ Reduzido timeout de 20s para 10s
- ✅ Aumentado reconnectionAttempts de 10 para 20
- ✅ Reduzido reconnectionDelay de 1000ms para 500ms (com backoff máximo de 5s)
- ✅ Adicionado pingInterval (25s) e pingTimeout (60s)
- ✅ Alterado order de transports: `['websocket', 'polling']` (websocket prioridade)
- ✅ Melhorado logging para debug

### 2. 🐢 Sistema Lento

**Possíveis Gargalos:**
- Queries ao banco de dados em handleConnection
- Heartbeat causando queries desnecessárias
- Falta de índices no banco de dados
- Conexões de pool do banco esgotadas
- Memory leaks em listeners de WebSocket

**Próximas Otimizações Necessárias:**
1. Adicionar cache para dados de usuário/departamento
2. Otimizar heartbeat para não fazer query se não necessário
3. Adicionar índices nas tabelas principais
4. Implementar connection pooling adequado
5. Monitorar memory usage

---

## ✅ Checklist de Verificação

### Backend
- [ ] Backend está rodando em http://192.168.10.156:4000
- [ ] Ligs não mostram erros críticos
- [ ] Conexão PostgreSQL está estável
- [ ] Redis está respondendo
- [ ] Sem memory leaks detectados

### Frontend
- [ ] Console não mostra "xhr poll error"
- [ ] WebSocket conecta em menos de 5s
- [ ] Reconexão automática funciona
- [ ] Sem erros de CORS

### Nginx
- [ ] /socket.io/ proxy está funcionando
- [ ] Headers de WebSocket estão corretos
- [ ] Timeouts de websocket (7d) estão aplicados

---

## 📊 Comandos de Diagnóstico

### Verificar se backend está rodando:
```bash
curl -v http://192.168.10.156:4000/api/health
```

### Verificar WebSocket:
```bash
curl -v http://192.168.10.156:4000/socket.io/?EIO=4&transport=polling
```

### Verificar logs do backend:
```bash
docker logs wpp-backend --tail=100 -f
```

### Verificar logs do nginx:
```bash
docker logs wpp-nginx --tail=50 -f
```

### Verificar conexões Redis:
```bash
docker exec wpp-redis redis-cli PING
```

### Verificar conexões PostgreSQL:
```bash
docker exec wpp-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT count(*) as connections FROM pg_stat_activity;"
```

---

## 🚀 Plano de Ação - Performance

### Fase 1: Monitoramento (Imediato)
1. Ativar logs detalhados no backend (`LOG_LEVEL=debug`)
2. Monitorar requisições HTTP/WebSocket
3. Colher métricas de resposta

### Fase 2: Otimização (Curto Prazo)
1. Cache de autenticação no Redis
2. lazy-load de relacionamentos no Prisma
3. Índices no banco de dados
4. Connection pooling otimizado

### Fase 3: Escalabilidade (Médio Prazo)
1. Load balancing
2. Caching de dados com Redis
3. Message queue para tarefas pesadas
4. Monitoramento com Prometheus/Grafana

---

## 📝 Configurações Aplicadas

### Frontend - socket.ts
```typescript
socket = io(serverUrl, {
  auth: { token },
  transports: ['websocket', 'polling'],      // websocket prioritário
  reconnection: true,
  reconnectionAttempts: 20,                   // mais tentativas
  reconnectionDelay: 500,                     // delay menor
  reconnectionDelayMax: 5000,                 // backoff máximo
  timeout: 10000,                             // timeout menor
  pingInterval: 25000,                        // heartbeat do cliente
  pingTimeout: 60000,                         // espera resposta do ping
  forceNew: false,
  autoConnect: true,
});
```

### Backend - websocket.gateway.ts
```typescript
@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
  transports: ['websocket', 'polling'],       // websocket prioritário
  pingInterval: 25000,                        // heartbeat do servidor
  pingTimeout: 60000,                         // timeout de ping
  maxHttpBufferSize: 1e6,                     // 1MB buffer
})
```

---

## 💡 Troubleshooting

### Se ainda receber "xhr poll error":
1. Verificar se backend está respondendo: `curl http://192.168.10.156:4000/socket.io/`
2. Verificar CORS: Network tab do DevTools → socket.io request
3. Verificar firewall: `telnet 192.168.10.156 4000`

### Se reconexão é muito lenta:
1. Reduzir `reconnectionDelay` inicial
2. Verificar latência de rede: `ping 192.168.10.156`
3. Verificar CPU/memoria do backend

### Se usuários desconectam frequentemente:
1. Aumentar `pingTimeout`
2. Verificar possíveis crashes do Node.js
3. Monitorar memory leaks
