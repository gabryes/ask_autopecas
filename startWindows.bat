@echo off
title AutoPeças - Chatbot Control Panel
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║                    🚗 AutoPeças Chatbot                      ║
echo  ║                   Sistema de Inicialização                   ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

echo [%time%] 🔍 Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [%time%] ❌ Node.js não encontrado!
    echo [%time%] 💡 Instale o Node.js em: https://nodejs.org
    pause
    exit /b 1
)

echo [%time%] ✅ Node.js detectado!
echo [%time%] 📦 Verificando dependências...

if not exist "node_modules" (
    echo [%time%] 📥 Instalando dependências...
    npm install
    if %errorlevel% neq 0 (
        echo [%time%] ❌ Erro ao instalar dependências!
        pause
        exit /b 1
    )
)

echo [%time%] ✅ Dependências OK!
echo [%time%] 🚀 Iniciando servidor...
echo.
echo  ┌─────────────────────────────────────────────────────────────┐
echo  │  🎮 O Painel de Controle abrirá automaticamente em 5s      │
echo  │  📱 WhatsApp: Escaneie o QR Code quando aparecer           │
echo  │  🔗 URL: http://localhost:3000/control                     │
echo  │  ⚙️  Admin: http://localhost:3000/admin                     │
echo  └─────────────────────────────────────────────────────────────┘
echo.

REM Iniciar o servidor em background
start /B node src/app.js

REM Aguardar 5 segundos para o servidor iniciar
timeout /t 5 /nobreak >nul

REM Abrir o painel de controle no navegador
echo [%time%] 🌐 Abrindo painel de controle...
start http://localhost:3000/control

echo [%time%] ✅ Sistema iniciado com sucesso!
echo [%time%] 💡 Mantenha esta janela aberta para ver os logs
echo [%time%] 🛑 Para parar: Ctrl+C ou feche esta janela
echo.

REM Manter a janela aberta para mostrar logs
pause >nul