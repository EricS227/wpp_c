#!/bin/bash
# 🔧 Script de Diagnóstico e Otimização - WPPConnector
# Execute este script para diagnosticar problemas de performance

set -e

echo "================================"
echo "🔍 WPPConnector - Diagnóstico"
echo "================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para testar conectividade
test_connection() {
  local host=$1
  local port=$2
  local name=$3
  
  if nc -z -w 5 "$host" "$port" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $name está respondendo em $host:$port"
    return 0
  else
    echo -e "${RED}✗${NC} $name NÃO está respondendo em $host:$port"
    return 1
  fi
}

# Função para testar resposta HTTP
test_http() {
  local url=$1
  local name=$2
  
  if curl -s -m 5 "$url" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} $name respondendo"
    return 0
  else
    echo -e "${RED}✗${NC} $name NÃO respondendo"
    return 1
  fi
}

echo "1️⃣ TESTANDO CONECTIVIDADE"
echo "------------------------"

test_connection "192.168.10.156" 4000 "Backend (4000)" || true
test_connection "192.168.10.156" 3100 "Frontend (3100)" || true
test_connection "192.168.10.156" 5432 "PostgreSQL (5432)" || true
test_connection "192.168.10.156" 6379 "Redis (6379)" || true

echo ""
echo "2️⃣ TESTANDO HTTP/API"
echo "--------------------"

test_http "http://192.168.10.156:4000/api/health" "Health Check" || true
test_http "http://192.168.10.156:4000/socket.io/?EIO=4&transport=polling" "WebSocket Polling" || true

echo ""
echo "3️⃣ ESTADO DO DOCKER"
echo "-------------------"

if command -v docker &> /dev/null; then
  echo "Containers em execução:"
  docker ps --format "table {{.Names}}\t{{.Status}}" | grep wpp- || echo -e "${YELLOW}⚠${NC} Nenhum container wpp em execução"
  
  echo ""
  echo "Verificando logs de erro (últimas 10 linhas de wpp-backend):"
  docker logs wpp-backend --tail 10 2>&1 | grep -i "error\|exception\|failed\|connection" || echo "Sem erros detectados"
else
  echo -e "${YELLOW}⚠${NC} Docker não disponível neste terminal"
fi

echo ""
echo "4️⃣ ESTATÍSTICAS DE REDE"
echo "----------------------"

# Latência para o backend
echo "Latência para backend:"
ping -c 3 192.168.10.156 | tail -1

echo ""
echo "5️⃣ RECOMENDAÇÕES"
echo "----------------"

echo ""
echo "Se o WebSocket ainda tiver problemas:"
echo "1. Verificar logs do backend:"
echo "   docker logs wpp-backend --tail 50 -f"
echo ""
echo "2. Reiniciar backend:"
echo "   docker restart wpp-backend"
echo ""
echo "3. Verificar se porta 4000 não está em uso:"
echo "   netstat -tuln | grep 4000"
echo ""
echo "4. Se tudo falhar, reconstruir containers:"
echo "   docker compose down"
echo "   docker compose up -d"
echo ""

echo "================================"
echo "✅ Diagnóstico Concluído"
echo "================================"
