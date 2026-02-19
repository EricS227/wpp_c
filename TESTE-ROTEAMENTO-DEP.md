# 🧪 Guia de Teste - Roteamento Automático por Departamento

## 📋 Visão Geral

O sistema detecta automaticamente qual departamento o cliente quer e o roteia para o agente correto:

```
Cliente envia mensagem
    ↓
Sistema detecta intenção (menu choice: 1, 2, 3, 4)
    ↓
Conversa é roteada ao departamento
    ↓
Agente disponível é atribuído
    ↓
Cliente recebe confirmação
```

## 🎯 Departamentos e Menu Choices

| Menu | Departamento | Aliases |
|------|---|---|
| **1** | Laboratório | lab, laboratorio, laboratório, análise, laudo, qualidade |
| **2** | Administrativo | adm, admin, administrativo, rh, recursos humanos, fornecedor |
| **3** | Comercial | comercial, vendas, venda, pedido, cotação, compra, preço |
| **4** | Financeiro | financeiro, financ, boleto, nota, nf, pagamento, fatura, cobrança |

## 🚀 Executar Testes

### 1. Criar Clientes de Teste

```bash
cd backend

# Criar 16 clientes de teste (4 por departamento)
npx ts-node prisma/seeds/create-test-clients.ts
```

Este script criará:
- **4 clientes Laboratório**: João, Maria, Pedro, Ana
- **4 clientes Administrativo**: Carlos, Beatriz, Fernando, Lucia  
- **4 clientes Comercial**: Roberto, Fernanda, Gustavo, Patricia
- **4 clientes Financeiro**: Marcelo, Gabriela, Diego, Mariana

### 2. Verificar Agentes de Teste

Os agentes já foram criados no seed principal:

```bash
# Lab
lab1@simestearina.com.br (Técnico Lab 1)
lab2@simestearina.com.br (Técnico Lab 2)

# Administrativo  
admin1@simestearina.com.br (RH Administrativo 1)
admin2@simestearina.com.br (RH Administrativo 2)

# Comercial
comercial1@simestearina.com.br (Vendedor 1)
comercial2@simestearina.com.br (Vendedor 2)

# Financeiro
financeiro1@simestearina.com.br (Analista Financeiro 1)
financeiro2@simestearina.com.br (Analista Financeiro 2)

# Admin (para fallback)
admin@empresa.com (Administrador - root)
```

Senha de todos: `Sim@2024`

### 3. Executar Testes de Roteamento

```bash
cd backend

# Testes de roteamento básicos
npm run test:routing

# Testes E2E completos
npm run test:e2e -- test/routing.e2e-spec.ts

# Com coverage
npm run test:cov -- test/routing.e2e-spec.ts
```

## 🧪 Testar Manualmente via Dashboard

### 1. Login de Agentes

```yaml
Laboratório:
  email: lab1@simestearina.com.br
  password: Sim@2024

Administrativo:
  email: admin1@simestearina.com.br
  password: Sim@2024

Comercial:
  email: comercial1@simestearina.com.br
  password: Sim@2024

Financeiro:
  email: financeiro1@simestearina.com.br
  password: Sim@2024
```

### 2. Marcar Agentes como ONLINE

1. Faça login de cada agente
2. Na página de dashboard, o sistema marcará automaticamente como ONLINE
3. Verifique em "Agentes Ativos" se todos aparecem

### 3. Simular Mensagens de Clientes

Se o WAHA estiver configurado:

```bash
# Exemplos de números de teste
curl -X POST http://localhost:8005/api/sendText \
  -H "Content-Type: application/json" \
  -d '{
    "session": "default",
    "chatId": "5541987010101",
    "body": "1"
  }'
```

Ou usar um simulador se WAHA não estiver rodando:

```bash
# Script manual (posteriomente implementaremos)
npm run test:simulate:routing
```

### 4. Verificar Roteamento no Dashboard

Acesse `http://192.168.10.156:3100/` e verifique:

1. **Conversas**:
   - Filtre por departamento
   - Verifique se conversa aparece no setor correto

2. **Cada Setor**:
   - Laboratório: Deve ter clientes de Lab
   - Administrativo: Deve ter clientes de Admin
   - Comercial: Deve ter clientes de Comercial
   - Financeiro: Deve ter clientes de Financeiro

3. **Agente Atribuído**:
   - Clique na conversa
   - Verifique o agente atribuído está no departamento correto

## 📊 Cases de Teste

### Caso 1: Cliente envia opção numérica "1"
```
Cliente: "1"
↓
Detectado: Laboratório
↓
Roteado: Laboratório
↓
Atribuído: lab1 ou lab2 (menos ocupado)
```

### Caso 2: Cliente escreve "comercial"
```
Cliente: "comercial"
↓
Detectado: Comercial
↓
Roteado: Comercial
↓
Atribuído: comercial1 ou comercial2
```

### Caso 3: Cliente escreve "análise" (com acento)
```
Cliente: "análise"
↓
Normalizado: "analise"
↓
Detectado: Laboratório (alias para 'analise')
↓
Roteado: Laboratório
↓
Atribuído: lab1 ou lab2
```

### Caso 4: Setor offline (fallback)
```
Cliente faz escolha: "3" (Comercial)
Comercial offline (sem agentes ONLINE)
↓
Fallback automático: Administrativo (root)
↓
Atribuído: admin ou admin1
```

### Caso 5: Load balancing
```
lab1 tem 3 conversas
lab2 tem 0 conversas
↓
Novo cliente entra
↓
Atribuído: lab2 (menos carregado)
```

## 🔍 Comandos de Diagnóstico

### Verificar clientes criados

```bash
# Via psql
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT 
  c.customerPhone,
  c.customerName,
  d.name as departamento,
  u.name as agente_atribuido,
  c.flowState,
  c.status
FROM conversations c
LEFT JOIN departments d ON c.departmentId = d.id
LEFT JOIN "users" u ON c.assignedUserId = u.id
ORDER BY c.customerPhone;
SQL
```

### Verificar roteamento de um cliente específico

```bash
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT 
  c.id,
  c.customerPhone,
  c.customerName,
  d.name as departamento,
  c.flowState,
  c.status,
  m.content as ultima_mensagem,
  m.direction
FROM conversations c
LEFT JOIN departments d ON c.departmentId = d.id
LEFT JOIN messages m ON c.id = m.conversationId
WHERE c.customerPhone = '5541987010101'
ORDER BY m.sentAt DESC
LIMIT 10;
SQL
```

### Verificar agentes por departamento

```bash
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT 
  d.name as departamento,
  COUNT(u.id) as total_agentes,
  SUM(CASE WHEN u.onlineStatus = 'ONLINE' THEN 1 ELSE 0 END) as online,
  STRING_AGG(u.name || ' (' || u.onlineStatus || ')', ', ') as agentes
FROM departments d
LEFT JOIN "users" u ON d.id = u.departmentId
WHERE u.role = 'AGENT'
GROUP BY d.id, d.name
ORDER BY d.name;
SQL
```

## ✅ Checklist de Validação

- [ ] Clientes de teste criados (4 por departamento)
- [ ] Agentes de teste têm login funcionando
- [ ] Agentes conseguem fazer login e aparecem como ONLINE
- [ ] Cliente envia "1" → vai para Laboratório
- [ ] Cliente envia "2" → vai para Administrativo  
- [ ] Cliente envia "3" → vai para Comercial
- [ ] Cliente envia "4" → vai para Financeiro
- [ ] Cliente envia "laboratorio" → vai para Laboratório
- [ ] Cliente envia "análise" (com acento) → vai para Laboratório
- [ ] Cliente envia intenção inválida → recebe mensagem de erro
- [ ] Load balancing funciona (agente menos carregado recebe)
- [ ] Fallback para Admin quando setor está offline
- [ ] Conversa passa por estados: GREETING → DEPARTMENT_SELECTED → ASSIGNED
- [ ] Agente recebe notificação de conversa atribuída
- [ ] Cliente recebe confirmação de conexão

## 🐛 Troubleshooting

### Clientes não aparecem nas conversas

```bash
# Verificar se foram criados
docker logs wpp-backend | grep "Clientes criados"

# Re-executar seed
npx ts-node prisma/seeds/create-test-clients.ts
```

### Agentes não aparecem online

```bash
# Verificar status dos agentes
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT name, onlineStatus FROM "users" WHERE role = 'AGENT' LIMIT 10;
SQL

# Marcar como ONLINE manualmente
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
UPDATE "users" SET onlineStatus = 'ONLINE' WHERE role = 'AGENT';
SQL
```

### Não está roteando para o departamento correto

```bash
# Verificar logs do backend
docker logs wpp-backend -f | grep -i "routing\|departamento"

# Verificar se FlowEngineService está detectando corretamente
docker logs wpp-backend -f | grep -i "processMenuChoice"
```

### Conversa fica em estado GREETING

```bash
# Verificar se a conversa tem departamento atribuído
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT customerName, flowState, departmentId FROM conversations 
WHERE customerPhone = 'seu_numero';
SQL

# Verificar logs de roteamento
docker logs wpp-backend | grep "routeToDepartment"
```

## 📚 Referências

- [FlowEngineService](../backend/src/modules/whatsapp/flow-engine.service.ts)
- [DepartmentRoutingService](../backend/src/modules/departments/department-routing.service.ts)
- [Test Cases](../backend/prisma/seeds/test-routing.ts)
- [E2E Tests](../backend/test/routing.e2e-spec.ts)
