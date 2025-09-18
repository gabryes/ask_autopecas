#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

class AutoPecasInstaller {
    constructor() {
        this.platform = os.platform();
        console.log('🚗 AutoPeças Chatbot - Configuração Inicial');
        console.log('═'.repeat(50));
    }

    log(message, type = 'info') {
        const emoji = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        console.log(`${emoji[type]} ${message}`);
    }

    createDesktopShortcut() {
        const projectPath = process.cwd();
        
        if (this.platform === 'win32') {
            // Windows - criar .bat
            const batContent = `@echo off
cd /d "${projectPath}"
node start.js
pause`;
            
            fs.writeFileSync('AutoPeças.bat', batContent);
            this.log('Atalho criado: AutoPeças.bat', 'success');
            
        } else if (this.platform === 'darwin') {
            // macOS - criar .command
            const commandContent = `#!/bin/bash
cd "${projectPath}"
node start.js`;
            
            fs.writeFileSync('AutoPeças.command', commandContent);
            fs.chmodSync('AutoPeças.command', '755');
            this.log('Atalho criado: AutoPeças.command', 'success');
            
        } else {
            // Linux - criar .desktop
            const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=AutoPeças Chatbot
Comment=Sistema de Chatbot para AutoPeças
Exec=node "${projectPath}/start.js"
Icon=${projectPath}/icon.png
Path=${projectPath}
Terminal=true
Categories=Development;`;
            
            fs.writeFileSync('AutoPeças.desktop', desktopContent);
            fs.chmodSync('AutoPeças.desktop', '755');
            this.log('Atalho criado: AutoPeças.desktop', 'success');
        }
    }

    createEnvFile() {
        if (!fs.existsSync('.env')) {
            const envContent = `# AutoPeças Chatbot - Configurações
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/chatbot-autopecas

# OpenAI (opcional)
# OPENAI_API_KEY=sua_chave_aqui

# WhatsApp (configurado automaticamente)
WHATSAPP_SESSION_NAME=autopecas-session
`;
            
            fs.writeFileSync('.env', envContent);
            this.log('Arquivo .env criado', 'success');
        } else {
            this.log('Arquivo .env já existe', 'info');
        }
    }

    createStartupScripts() {
        // Tornar scripts executáveis
        if (fs.existsSync('start.sh')) {
            fs.chmodSync('start.sh', '755');
        }
        
        if (fs.existsSync('start.command')) {
            fs.chmodSync('start.command', '755');
        }
        
        this.log('Scripts de inicialização configurados', 'success');
    }

    showInstructions() {
        console.log('\n🎉 Instalação concluída!');
        console.log('\n📋 Como usar:');
        
        if (this.platform === 'win32') {
            console.log('   • Clique duplo em: AutoPeças.bat');
            console.log('   • Ou execute: start.bat');
        } else if (this.platform === 'darwin') {
            console.log('   • Clique duplo em: AutoPeças.command');
            console.log('   • Ou execute: ./start.sh');
        } else {
            console.log('   • Clique duplo em: AutoPeças.desktop');
            console.log('   • Ou execute: ./start.sh');
        }
        
        console.log('   • Ou execute: node start.js');
        
        console.log('\n🔗 URLs importantes:');
        console.log('   • Painel de Controle: http://localhost:3000/control');
        console.log('   • Admin: http://localhost:3000/admin');
        console.log('   • Dashboard: http://localhost:3000');
        
        console.log('\n💡 Dicas:');
        console.log('   • Configure o .env se necessário');
        console.log('   • Instale MongoDB se usar local');
        console.log('   • Configure OPENAI_API_KEY para IA real');
    }

    install() {
        this.log('Configurando AutoPeças Chatbot...', 'info');
        
        this.createEnvFile();
        this.createStartupScripts();
        this.createDesktopShortcut();
        
        this.showInstructions();
    }
}

const installer = new AutoPecasInstaller();
installer.install();