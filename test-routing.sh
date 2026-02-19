#!/bin/bash

# 🧪 Script Quick Start - Testes de Roteamento
# Execute este script para fazer setup rápido e testar roteamento

set -e

echo "=================================="
echo "🧪 QUICK START - Testes de Roteamento"
echo "=================================="
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função auxiliar
step() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Verificar se backend está rodando
check_backend() {
  if ! curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Backend não está rodando!${NC}"
    echo "Inicie com: docker compose up -d"
    exit 1
  fi
  echo -e "${GREEN}✓ Backend está rodando${NC}"
}

# Menu principal
show_menu() {
  echo ""
  echo "Escolha uma opção:"
  echo ""
  echo "  1 - Criar clientes de teste (16 clientes, 4 por dept)"
  echo "  2 - Executar testes de roteamento"
  echo "  3 - Executar testes E2E"
  echo "  4 - Simular mensagens (interativo)"
  echo "  5 - Verificar status do roteamento"
  echo "  6 - Reset clientes (deletar todos da teste)"
  echo "  7 - Dashboard"
  echo "  0 - Sair"
  echo ""
  read -p "Opção (0-7): " choice
}

# Criar clientes de teste
create_clients() {
  step "Criando Clientes de Teste"
  
  cd backend
  npm run prisma:seed:clients
  
  echo ""
  echo -e "${GREEN}✓ 16 clientes criados!${NC}"
  echo ""
  echo "Clientes por departamento:"
  echo "  Laboratório: João, Maria, Pedro, Ana"
  echo "  Administrativo: Carlos, Beatriz, Fernando, Lucia"
  echo "  Comercial: Roberto, Fernanda, Gustavo, Patricia"
  echo "  Financeiro: Marcelo, Gabriela, Diego, Mariana"
  cd ..
}

# Executar testes
run_tests() {
  step "Executando Testes de Roteamento"
  
  cd backend
  npm run test:routing
  cd ..
  
  echo ""
  echo -e "${GREEN}✓ Testes de roteamento executados!${NC}"
}

# Executar testes E2E
run_e2e() {
  step "Executando Testes E2E"
  
  cd backend
  npm run test:e2e -- test/routing.e2e-spec.ts
  cd ..
  
  echo ""
  echo -e "${GREEN}✓ Testes E2E executados!${NC}"
}

# Simular mensagens
simulate_messages() {
  step "Simulador de Mensagens"
  
  cd backend
  npm run simulate:routing
  cd ..
}

# Verificar status
check_status() {
  step "Verificando Status do Roteamento"
  
  echo "Conversas por departamento:"
  echo ""
  
  docker exec wpp-postgres psql -U postgres -d wppconnector -c "
  SELECT 
    d.name as departamento,
    COUNT(c.id) as total_conversas,
    SUM(CASE WHEN c.status = 'ASSIGNED' THEN 1 ELSE 0 END) as atribuidas,
    SUM(CASE WHEN c.assignedUserId IS NOT NULL THEN 1 ELSE 0 END) as com_agente
  FROM conversations c
  LEFT JOIN departments d ON c.departmentId = d.id
  WHERE c.companyId = (SELECT id FROM companies LIMIT 1)
  GROUP BY d.id, d.name
  ORDER BY d.name;
  " 2>/dev/null || echo "❌ Não conseguiu conectar ao banco"
  
  echo ""
  echo "Agentes online por departamento:"
  echo ""
  
  docker exec wpp-postgres psql -U postgres -d wppconnector -c "
  SELECT 
    d.name as departamento,
    COUNT(u.id) as total_agentes,
    SUM(CASE WHEN u.onlineStatus = 'ONLINE' THEN 1 ELSE 0 END) as online,
    STRING_AGG(u.name || ' (' || u.onlineStatus || ')', ', ') as agentes
  FROM departments d
  LEFT JOIN \"users\" u ON d.id = u.departmentId AND u.role = 'AGENT'
  WHERE d.companyId = (SELECT id FROM companies LIMIT 1)
  GROUP BY d.id, d.name
  ORDER BY d.name;
  " 2>/dev/null || echo "❌ Não conseguiu conectar ao banco"
}

# Reset de clientes
reset_clients() {
  step "ATENÇÃO: DELETAR TODOS OS CLIENTES DE TESTE"
  
  read -p "Tem certeza? (S/n): " confirm
  
  if [ "$confirm" != "S" ] && [ "$confirm" != "s" ]; then
    echo "Cancelado."
    return
  fi
  
  echo "Deletando conversas de teste..."
  
  docker exec wpp-postgres psql -U postgres -d wppconnector -c "
  DELETE FROM conversations 
  WHERE companyId = (SELECT id FROM companies LIMIT 1)
  AND customerPhone LIKE '5541987%';
  " 2>/dev/null && echo -e "${GREEN}✓ Clientes deletados${NC}" || echo "❌ Erro ao deletar"
}

# Abrir dashboard
open_dashboard() {
  step "Abrindo Dashboard"
  
  echo "Abrindo http://192.168.10.156:3100"
  echo ""
  echo "Credenciais de teste:"
  echo "  Lab:       lab1@simestearina.com.br / Sim@2024"
  echo "  Admin:     admin1@simestearina.com.br / Sim@2024"
  echo "  Comercial: comercial1@simestearina.com.br / Sim@2024"
  echo "  Financeiro: financeiro1@simestearina.com.br / Sim@2024"
  echo ""
  
  # Tentar abrir no navegador se disponível
  if command -v xdg-open &> /dev/null; then
    xdg-open http://192.168.10.156:3100
  elif command -v open &> /dev/null; then
    open http://192.168.10.156:3100
  fi
}

# Menu loop
while true; do
  check_backend
  show_menu
  
  case $choice in
    1) create_clients ;;
    2) run_tests ;;
    3) run_e2e ;;
    4) simulate_messages ;;
    5) check_status ;;
    6) reset_clients ;;
    7) open_dashboard ;;
    0)
      echo ""
      echo "👋 Saindo..."
      echo ""
      exit 0
      ;;
    *)
      echo -e "${YELLOW}❌ Opção inválida${NC}"
      ;;
  esac
done
