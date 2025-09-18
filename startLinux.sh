#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para log com timestamp
log() {
    echo -e "${CYAN}[$(date +'%H:%M:%S')]${NC} $1"
}

# Header
clear
echo -e "${PURPLE}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                    🚗 AutoPeças Chatbot                      ║"
echo "  ║                   Sistema de Inicialização                   ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar Node.js
log "🔍 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    log "${RED}❌ Node.js não encontrado!${NC}"
    log "${YELLOW}💡 Instale o Node.js em: https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
log "${GREEN}✅ Node.js detectado: $NODE_VERSION${NC}"

# Verificar npm
if ! command -v npm &> /dev/null; then
    log "${RED}❌ npm não encontrado!${NC}"
    exit 1
fi

# Verificar dependências
log "📦 Verificando dependências..."
if [ ! -d "node_modules" ]; then
    log "${YELLOW}📥 Instalando dependências...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        log "${RED}❌ Erro ao instalar dependências!${NC}"
        exit 1
    fi
fi

log "${GREEN}✅ Dependências OK!${NC}"

# Verificar se a porta 3000 está disponível
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    log "${YELLOW}⚠️ Porta 3000 já está em uso!${NC}"
    read -p "Deseja parar o processo existente? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "🛑 Parando processo na porta 3000..."
        lsof -ti:3000 | xargs kill -9
        sleep 2
    else
        log "${RED}❌ Cancelado pelo usuário${NC}"
        exit 1
    fi
fi

# Criar arquivo de PID para controle
PID_FILE="autopecas.pid"

# Função para cleanup
cleanup() {
    log "${YELLOW}🛑 Parando servidor...${NC}"
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        kill $PID 2>/dev/null
        rm -f "$PID_FILE"
    fi
    log "${GREEN}✅ Servidor parado!${NC}"
    exit 0
}

# Capturar Ctrl+C
trap cleanup SIGINT SIGTERM

log "${BLUE}🚀 Iniciando servidor...${NC}"
echo
echo -e "${GREEN}  ┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}  │  🎮 O Painel de Controle abrirá automaticamente em 5s      │${NC}"
echo -e "${GREEN}  │  📱 WhatsApp: Escaneie o QR Code quando aparecer           │${NC}"
echo -e "${GREEN}  │  🔗 URL: http://localhost:3000/control                     │${NC}"
echo -e "${GREEN}  │  ⚙️  Admin: http://localhost:3000/admin                     │${NC}"
echo -e "${GREEN}  └─────────────────────────────────────────────────────────────┘${NC}"
echo

# Iniciar servidor em background
node src/app.js &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

# Aguardar servidor iniciar
log "⏳ Aguardando servidor inicializar..."
sleep 5

# Verificar se o servidor está rodando
if ! kill -0 $SERVER_PID 2>/dev/null; then
    log "${RED}❌ Falha ao iniciar o servidor!${NC}"
    rm -f "$PID_FILE"
    exit 1
fi

# Abrir navegador
log "🌐 Abrindo painel de controle..."

# Detectar sistema operacional e abrir navegador apropriado
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3000/control
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000/control
    elif command -v firefox &> /dev/null; then
        firefox http://localhost:3000/control &
    elif command -v google-chrome &> /dev/null; then
        google-chrome http://localhost:3000/control &
    else
        log "${YELLOW}⚠️ Abra manualmente: http://localhost:3000/control${NC}"
    fi
else
    log "${YELLOW}⚠️ Abra manualmente: http://localhost:3000/control${NC}"
fi

log "${GREEN}✅ Sistema iniciado com sucesso!${NC}"
log "${YELLOW}💡 Para parar o servidor: Ctrl+C${NC}"
log "${BLUE}📊 Monitorando logs...${NC}"
echo

# Mostrar logs do servidor
tail -f /dev/null &
wait $SERVER_PID