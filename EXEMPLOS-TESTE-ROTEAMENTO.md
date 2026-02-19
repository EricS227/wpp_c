# 🎓 Exemplos Práticos de Teste - Roteamento Automático

## 📱 Fluxo de Teste Exemplo 1: Cliente Laboratório

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE: João Silva (Laboratório)                           │
│ Número: 5541987010101                                       │
│ Primeira Mensagem: "1"                                      │
└─────────────────────────────────────────────────────────────┘

1. Cliente envia "1" via WhatsApp
   ↓
2. Sistema recebe mensagem
   → Conversa criada em status GREETING
   → customerPhone: 5541987010101
   → flowState: GREETING
   ↓
3. FlowEngineService.processMenuChoice("1")
   → Detecta: "laboratorio"
   ↓
4. DepartmentRoutingService.routeToDepartment("laboratorio")
   → Encontra departamento Laboratório
   → Busca agentes ONLINE do Lab
   → Encontra lab1 (2 conversas) e lab2 (1 conversa)
   → Escolhe lab2 (menos carregado)
   ↓
5. Conversa atualizada:
   → departmentId: <lab_dept_id>
   → assignedUserId: <lab2_user_id>
   → flowState: ASSIGNED
   → status: ASSIGNED
   ↓
6. Notifications:
   → lab2 recebe notificação via WebSocket
   → Conversa aparece no dashboard de lab2
   → "João Silva aguardando..." (nova conversa)
   ↓
7. cliente recebe mensagem de confirmação:
   "Conectando com atendente do setor Laboratório... Aguarde um momento. 😊"
   ↓
✅ SUCESSO! Conversa roteada para Laboratório, agente lab2
```

---

## 📝 Fluxo de Teste Exemplo 2: Cliente com Alias

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENTE: Diego Martins (Financeiro)                         │
│ Número: 5541987040403                                       │
│ Primeira Mensagem: "boleto vencido"                         │
└─────────────────────────────────────────────────────────────┘

1. Cliente envia "boleto vencido" via WhatsApp
   ↓
2. FlowEngineService normaliza entrada:
   "boleto vencido"
   ↓ (normalize: lowercase, trim, remove diacritics)
   "boleto vencido"
   ↓
3. FlowEngineService.processMenuChoice("boleto vencido")
   → Busca em MENU_ALIASES
   → Encontra "boleto" → "financeiro"
   → Detecta: "financeiro"
   ↓
4. DepartmentRoutingService.routeToDepartment("financeiro")
   → Roteia para Financeiro
   → Atribui a financeiro1 (menos carregado)
   ↓
5. Conversa atualizada:
   → departmentId: <fin_dept_id>
   → assignedUserId: <fin1_user_id>
   → flowState: ASSIGNED
   ↓
✅ SUCESSO! "boleto vencido" detectado como Financeiro
```

---

## ⚠️ Fluxo de Teste Exemplo 3: Setor Offline (Fallback)

```
┌─────────────────────────────────────────────────────────────┐
│ CENÁRIO: Comercial está OFFLINE (sem agentes)               │
│ CLIENTE: Patricia (tentando accessar Comercial)             │
│ Numero: 5541987030304                                       │
│ Mensagem: "3" (Comercial)                                   │
└─────────────────────────────────────────────────────────────┘

1. Cliente envia "3" (Comercial)
   ↓
2. Sistema detecta: "comercial"
   ↓
3. DepartmentRoutingService tenta rotear para Comercial
   → Busca agentes ONLINE em Comercial
   → Nenhum agente online! ❌
   ↓
4. FALLBACK AUTOMÁTICO para Administrativo (root)
   ↓
5. Conversa atualizada:
   → departmentId: <admin_dept_id> (não comercial!)
   → assignedUserId: <admin_user_id>
   → Mensagem: "Nosso setor de Comercial está offline no momento.
               Redirecionando para Administrativo..."
   ↓
✅ SUCESSO! Cliente roteado para Admin como fallback
```

---

## 🔄 Fluxo de Teste Exemplo 4: Load Balancing

```
┌─────────────────────────────────────────────────────────────┐
│ CENÁRIO: Load Balancing em Laboratório                      │
│ lab1 tem 5 conversas ativas                                  │
│ lab2 tem 1 conversa ativa                                    │
│ Novo cliente chega: "análise de qualidade"                  │
└─────────────────────────────────────────────────────────────┘

1. Novo cliente envia "análise de qualidade"
   ↓
2. Sistema detecta: "laboratorio" (alias para "analise")
   ↓
3. DepartmentRoutingService.assignToAgent(laboratorio)
   → Busca agentes ONLINE em Lab
   → Encontra:
     • lab1: 5 conversas ativas
     • lab2: 1 conversa ativa
   ↓
4. Algoritmo de load balancing:
   → Ordena por menor número de conversas
   → Escolhe: lab2 (1 conversa)
   ↓
5. Conversa atribuída a lab2
   ↓
✅ SUCESSO! Load balancing funcionou
   novo cliente vai para agente menos ocupado
```

---

## 🧪 Como Testar - Passo a Passo

### Teste 1: Numérico (Menu Choice)

```bash
# Terminal 1: Monitorar logs
docker logs wpp-backend -f | grep -i "processMenuChoice\|routeToDepartment"

# Terminal 2: Simular cliente
cd backend
npm run simulate:routing

# Escolher opção 3 (enviar personalizada)
# Selecionar cliente 1 (João Silva Lab)
# Enviar mensagem: "1"

# Esperado:
# - Lab agent recebe conversa
# - Conversa aparece em "Laboratório"
```

### Teste 2: Alias (Text Matching)

```bash
cd backend
npm run simulate:routing

# Escolher opção 3
# Selecionar cliente 3 (Pedro Oliveira Lab)
# Enviar mensagem: "análise de qualidade"

# Esperado:
# - Sistema normaliza "análise" → "analise"
# - Detecta alias "analise" → "laboratorio"
# - Roteia para Lab
```

### Teste 3: Fallback

```bash
# Marcar agentes de Comercial como OFFLINE
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
UPDATE "users" 
SET onlineStatus = 'OFFLINE' 
WHERE departmentId = (
  SELECT id FROM departments WHERE slug = 'comercial' LIMIT 1
);
SQL

cd backend
npm run simulate:routing

# Enviar mensagem para cliente Comercial: "3"

# Esperado:
# - Admin recebe (não Comercial)
# - Cliente recebe aviso de fallback
```

### Teste 4: Load Balancing

```bash
# Criar várias conversas para lab1
cd backend
npm run simulate:routing --dept laboratorio

# Enviar mensagem para todos os 4 clientes Lab

# Verificar distribuição:
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT 
  u.name as agente,
  COUNT(c.id) as conversas
FROM "users" u
LEFT JOIN conversations c ON u.id = c.assignedUserId
WHERE u.departmentId = (
  SELECT id FROM departments WHERE slug = 'laboratorio' LIMIT 1
)
GROUP BY u.id, u.name;
SQL

# Esperado:
# - Conversas distribuídas entre lab1 e lab2
# - Não todas concentradas em um
```

---

## 📊 Verificação Via Dashboard

### Login e Verificação

1. **Abrir Dashboard**
   ```
   URL: http://192.168.10.156:3100
   Email: lab1@simestearina.com.br
   Senha: Sim@2024
   ```

2. **Verificar Conversas no Dashboard**
   ```
   Conversas → Departamento: Laboratório
   ↓
   Deve aparecer:
   • João Silva (5541987010101) - Atribuido a lab1/lab2
   • Maria Costa (5541987010102)
   • Pedro Oliveira (5541987010103)
   • Ana Santos (5541987010104)
   ```

3. **Clicar em uma Conversa**
   ```
   Deve mostrar:
   ✓ Nome: João Silva
   ✓ Número: 5541987010101
   ✓ Departamento: Laboratório
   ✓ Agente Atribuído: lab1 ou lab2
   ✓ Status: ASSIGNED
   ✓ Primeira mensagem: "1"
   ```

4. **Trocar Para Outro Setor**
   ```
   Sidebar → Administrativo
   ↓
   Deve aparecer clientes de Admin:
   • Carlos Mendes
   • Beatriz Lima
   • Fernando Dias
   • Lucia Nogueira
   ```

---

## 🔍 Debugging - Comandos Úteis

### Ver Todas as Conversas Criadas

```bash
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT 
  c.customerPhone,
  c.customerName,
  d.name as departamento,
  u.name as agente,
  c.flowState,
  c.status
FROM conversations c
LEFT JOIN departments d ON c.departmentId = d.id
LEFT JOIN "users" u ON c.assignedUserId = u.id
WHERE c.customerPhone LIKE '5541987%'
ORDER BY c.customerName;
SQL
```

### Ver Histórico de Detecção

```bash
docker logs wpp-backend -f | grep -E "processMenuChoice|routeToDepartment|assignToAgent"
```

### Ver Mensagens de Cliente Específico

```bash
docker exec wpp-postgres psql -U postgres -d wppconnector << 'SQL'
SELECT 
  m.direction,
  m.content,
  m.createdAt,
  u.name as from_user
FROM messages m
LEFT JOIN "users" u ON m.sentById = u.id
WHERE m.conversationId = (
  SELECT id FROM conversations 
  WHERE customerPhone = '5541987010101' LIMIT 1
)
ORDER BY m.createdAt;
SQL
```

---

## ✅ Checklist Final de Validação

- [ ] 1. Criar clientes: `npm run prisma:seed:clients`
- [ ] 2. Teste Lab com "1" → vai para Laboratório
- [ ] 3. Teste Admin com "2" → vai para Administrativo
- [ ] 4. Teste Com com "3" → vai para Comercial
- [ ] 5. Teste Fin com "4" → vai para Financeiro
- [ ] 6. Teste alias: "análise" → Laboratório
- [ ] 7. Teste alias: "boleto" → Financeiro
- [ ] 8. Teste fallback: setor offline → Admin
- [ ] 9. Teste load balance: múltiplas conversas
- [ ] 10. Verificar no dashboard cada departamento
- [ ] 11. Confirmar agentes atribuídos corretamente
- [ ] 12. Executar testes E2E: `npm run test:e2e`

---

## 📚 Referências

- [Guia Completo](TESTE-ROTEAMENTO-DEP.md)
- [Resumo do Sistema](SUMMARY-ROTEAMENTO.md)
- FlowEngineService: `backend/src/modules/whatsapp/flow-engine.service.ts`
- DepartmentRoutingService: `backend/src/modules/departments/department-routing.service.ts`

---

## 🎓 Conceitos Importantes

### MENU_ALIASES
Mapa que reconhece texto do usuário e converte para departamento:
```
"1", "lab", "LAB", "laboratorio", "análise" → "laboratorio"
"2", "adm", "RH", "administrativo" → "administrativo"
"3", "vendas", "pedido", "comercial" → "comercial"
"4", "boleto", "NF", "financeiro" → "financeiro"
```

### FlowState
Estados que conversa passa:
- `GREETING` - Cliente novo, não escolheu departamento
- `DEPARTMENT_SELECTED` - Cliente escolheu, roteando
- `ASSIGNED` - Atribuída a agente, sendo atendida
- `RESOLVED` - Conversa finalizada

### Load Balancing
Algoritmo que distribui conversas:
```
agent_score = número_de_conversas_ativas
agent_with_lowest_score = chosen_agent
```

Garante distribuição uniforme de carga.

---

## 🚀 Próximo Passo

Estará **pronto para homologação** quando:
1. ✅ Todos os 16 clientes roteados corretamente
2. ✅ Fallback funcionando para setor offline
3. ✅ Load balancing distribuindo conversas
4. ✅ Todos os testes E2E passando
5. ✅ Dashboard mostrando conversas em setores corretos
