# ✅ Sistema de Roteamento Automático - Implementação Completa

## 🎯 Resumo do Que Foi Entregue

O sistema de **roteamento automático por departamento** **já estava implementado**. O que foi feito agora:

### ✨ O Que Já Existe (Implementado)

1. **FlowEngineService** - Detecta a intenção do cliente
   - Menu Choice Detection: Reconhece números (1,2,3,4) e textos
   - Normalização: Remove acentos e transforma para lowercase
   - Alias Mapping: Conhece variações ("laboratorio", "lab", "análise", etc.)

2. **DepartmentRoutingService** - Roteia para o departamento correto
   - routeToDepartment: Atribui conversa ao setor
   - assignToAgent: Load balancing (menos carregado)
   - redirectToAdmin: Fallback automático

3. **Database Schema** - Estrutura pronta
   - 4 Departamentos: Laboratorio, Administrativo, Comercial, Financeiro
   - Estados de Flow: GREETING → DEPARTMENT_SELECTED → ASSIGNED → RESOLVED
   - Suporte a múltiplas empresas

### 🆕 O Que Foi Criado Agora (Testes)

1. **Seed de Clientes de Teste** (`prisma/seeds/create-test-clients.ts`)
   - 16 clientes (4 por departamento)
   - Números de WhatsApp realistas
   - Primeiras mensagens rastreáveis

2. **Testes E2E Completos** (`test/routing.e2e-spec.ts`)
   - Validação de detecção de intenção
   - Validação de roteamento para cada setor
   - Teste de fallback
   - Teste de load balancing
   - Teste de fluxo completo

3. **Simulador de Mensagens** (`scripts/simulate-routing.ts`)
   - Menu interativo
   - Teste automático
   - Teste por departamento
   - Verificação de status

4. **Guia Completo de Teste** (`TESTE-ROTEAMENTO-DEP.md`)
   - Instruções passo a passo
   - Credentials de teste
   - Cases de teste
   - Troubleshooting

---

## 🚀 Como Usar

### 1️⃣ Criar Clientes de Teste

```bash
cd backend

# Criar 16 clientes de teste (4 por departamento)
npm run prisma:seed:clients
```

Isto criará:
- **Laboratório**: João, Maria, Pedro, Ana
- **Administrativo**: Carlos, Beatriz, Fernando, Lucia
- **Comercial**: Roberto, Fernanda, Gustavo, Patricia
- **Financeiro**: Marcelo, Gabriela, Diego, Mariana

### 2️⃣ Executar Testes Automatizados

```bash
# Testes de roteamento
npm run test:routing

# Testes E2E
npm run test:e2e -- test/routing.e2e-spec.ts

# Com coverage
npm run test:cov -- test/routing.e2e-spec.ts
```

### 3️⃣ Simular Mensagens (Interactive)

```bash
npm run simulate:routing
```

Opções:
- Teste automático (todos os clientes)
- Teste por departamento
- Enviar mensagem personalizada
- Verificar status

### 4️⃣ Testar via Dashboard

1. Acesse: `http://192.168.10.156:3100`
2. Login com agente: `lab1@simestearina.com.br` / `Sim@2024`
3. Você deve ver as conversas de teste roteadas
4. Verifique cada departamento (Lab, Admin, Comercial, Financeiro)

---

## 📊 Fluxo de Roteamento

```
Cliente envia mensagem
│
├─ Sistema recebe via WAHA (ou simula)
│
├─ Cria/atualiza Conversation (status=OPEN, flowState=GREETING)
│
├─ Detecta intenção via FlowEngineService
│  ├─ "1" → laboratorio
│  ├─ "2" → administrativo
│  ├─ "3" → comercial
│  ├─ "4" → financeiro
│  └─ "analise", "boleto", etc. → aliases
│
├─ Roteia para Departamento via DepartmentRoutingService
│  ├─ Busca agentes ONLINE no setor
│  ├─ Load balance (menos carregado)
│  └─ Se nenhum disponível → fallback para Admin
│
├─ Atribui a Agente
│  ├─ Conversa status=ASSIGNED
│  ├─ Conversa flowState=ASSIGNED
│  ├─ Agente notificado via WebSocket
│  └─ Cliente recebe confirmação
│
└─ Done! ✅
```

---

## 🎯 Departamentos e Menu Choices

| Menu | Slug | Departamento | Aliases |
|------|------|---|---|
| **1** | laboratorio | Laboratório | lab, laboratorio, laboratório, análise, laudo, qualidade, técnico |
| **2** | administrativo | Administrativo | adm, admin, administrativo, rh, recursos humanos, fornecedor, geral |
| **3** | comercial | Comercial | comercial, vendas, venda, pedido, cotação, compra, preço |
| **4** | financeiro | Financeiro | financeiro, financ, boleto, nota, nf, pagamento, fatura, cobrança |

---

## 👥 Credenciais de Teste

### Agentes (senha: `Sim@2024`)

```yaml
Laboratório:
  lab1@simestearina.com.br (Técnico Lab 1)
  lab2@simestearina.com.br (Técnico Lab 2)

Administrativo:
  admin1@simestearina.com.br (RH Admin 1)
  admin2@simestearina.com.br (RH Admin 2)

Comercial:
  comercial1@simestearina.com.br (Vendedor 1)
  comercial2@simestearina.com.br (Vendedor 2)

Financeiro:
  financeiro1@simestearina.com.br (Analista Fin 1)
  financeiro2@simestearina.com.br (Analista Fin 2)

Admin (Fallback):
  admin@empresa.com (Administrador)
```

### Clientes de Teste (Números WhatsApp)

```yaml
Laboratório:
  5541987010101 - João Silva - Lab (mensagem: "1")
  5541987010102 - Maria Costa - Lab (mensagem: "laboratorio")
  5541987010103 - Pedro Oliveira - Lab (mensagem: "análise de qualidade")
  5541987010104 - Ana Santos - Lab (mensagem: "laudo técnico")

Administrativo:
  5541987020201 - Carlos Mendes - ADM (mensagem: "2")
  5541987020202 - Beatriz Lima - ADM (mensagem: "administrativo")
  5541987020203 - Fernando Dias - ADM (mensagem: "recursos humanos")
  5541987020204 - Lucia Nogueira - ADM (mensagem: "fornecedor")

Comercial:
  5541987030301 - Roberto Gomes - COM (mensagem: "3")
  5541987030302 - Fernanda Costa - COM (mensagem: "comercial")
  5541987030303 - Gustavo Alves - COM (mensagem: "fazer um pedido")
  5541987030304 - Patricia Ribeiro - COM (mensagem: "cotação de preço")

Financeiro:
  5541987040401 - Marcelo Ferreira - FIN (mensagem: "4")
  5541987040402 - Gabriela Teixeira - FIN (mensagem: "financeiro")
  5541987040403 - Diego Martins - FIN (mensagem: "boleto vencido")
  5541987040404 - Mariana Rocha - FIN (mensagem: "nota fiscal")
```

---

## 🔍 Verificar Roteamento

### Via Prisma Studio

```bash
npm run prisma:studio
```

Acesse `http://localhost:5555` e verifique tabelas:
- `conversations` - Veja departmentId, assignedUserId
- `departments` - Veja estrutura dos setores
- `users` - Veja agentes de cada departamento

### Via SQL

```bash
# Conectar ao PostgreSQL
docker exec -it wpp-postgres psql -U postgres -d wppconnector

# Ver conversas roteadas
SELECT 
  c.customerName,
  c.customerPhone,
  d.name as departamento,
  u.name as agente_atribuido,
  c.flowState,
  c.status
FROM conversations c
LEFT JOIN departments d ON c.departmentId = d.id
LEFT JOIN "users" u ON c.assignedUserId = u.id
ORDER BY c.customerName;

# Ver agentes por departamento
SELECT 
  d.name as departamento,
  COUNT(u.id) as total_agentes,
  SUM(CASE WHEN u.onlineStatus = 'ONLINE' THEN 1 ELSE 0 END) as online
FROM departments d
LEFT JOIN "users" u ON d.id = u.departmentId
WHERE u.role = 'AGENT'
GROUP BY d.id, d.name;
```

---

## ✅ Checklist de Validação

- [ ] Clientes de teste criados (`npm run prisma:seed:clients`)
- [ ] Agentes podem fazer login
- [ ] Agentes aparecem como ONLINE no dashboard
- [ ] Cliente "1" vai para Laboratório
- [ ] Cliente "2" vai para Administrativo
- [ ] Cliente "3" vai para Comercial
- [ ] Cliente "4" vai para Financeiro
- [ ] Cliente "análise" vai para Laboratório (alias)
- [ ] Cliente "boleto" vai para Financeiro (alias)
- [ ] Conversa passa por estados corretos
- [ ] Agente recebe notificação de conversa
- [ ] Load balancing funciona (agente menos carregado)
- [ ] Fallback para Admin quando setor offline
- [ ] Testes E2E passam

---

## 📚 Arquivos Criados/Modificados

### Criados:
- `prisma/seeds/create-test-clients.ts` - Seed de clientes de teste
- `test/routing.e2e-spec.ts` - Testes E2E
- `scripts/simulate-routing.ts` - Simulador interativo
- `TESTE-ROTEAMENTO-DEP.md` - Guia completo
- `SUMMARY-ROTEAMENTO.md` - Este arquivo

### Modificados:
- `package.json` - Added scripts for testing

### Existentes (Já Implementados):
- `src/modules/whatsapp/flow-engine.service.ts`
- `src/modules/departments/department-routing.service.ts`
- `prisma/seed-departments.ts`
- `prisma/seed.ts`
- `test/routing.e2e-spec.ts` (atualizado)

---

## 🚨 Troubleshooting

### Se os clientes não aparecerem:
```bash
npm run prisma:seed:clients
```

### Se os testes falharem:
```bash
npm run test:routing
npm run test:e2e -- test/routing.e2e-spec.ts
```

### Se não conseguir conectar ao backend:
```bash
docker logs wpp-backend -f
curl -v http://localhost:4000/api/health
```

### Se os agentes não estiverem online:
```bash
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
UPDATE "users" SET onlineStatus = 'ONLINE' WHERE role = 'AGENT';
SQL
```

---

## 📖 Documentação Relacionada

- [TESTE-ROTEAMENTO-DEP.md](TESTE-ROTEAMENTO-DEP.md) - Guia detalhado de teste
- [backend/src/modules/whatsapp/flow-engine.service.ts](backend/src/modules/whatsapp/flow-engine.service.ts) - Detecção de intenção
- [backend/src/modules/departments/department-routing.service.ts](backend/src/modules/departments/department-routing.service.ts) - Lógica de roteamento
- [backend/prisma/schema.prisma](backend/prisma/schema.prisma) - Schema do banco

---

## 🎉 Próximos Steps

1. ✅ Executar `npm run prisma:seed:clients` para criar clientes de teste
2. ✅ Executar `npm run test:routing` para validar sistema
3. ✅ Acessar dashboard e verificar roteamento
4. ✅ Simular mensagens com `npm run simulate:routing`
5. ✅ Confirmar que cada cliente vai para setor correto

Sistema está pronto para homologação! 🚀
