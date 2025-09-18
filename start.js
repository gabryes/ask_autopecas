#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class AutoPecasLauncher {
    constructor() {
        this.platform = os.platform();
        this.serverProcess = null;
        this.pidFile = 'autopecas.pid';
        
        console.log('🚗 AutoPeças Chatbot Launcher');
        console.log('═'.repeat(50));
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const emoji = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            loading: '⏳'
        };
        
        console.log(`[${timestamp}] ${emoji[type] || 'ℹ️'} ${message}`);
    }

    async checkNodeJs() {
        return new Promise((resolve) => {
            exec('node --version', (error, stdout) => {
                if (error) {
                    this.log('Node.js não encontrado!', 'error');
                    this.log('Instale em: https://nodejs.org', 'warning');
                    process.exit(1);
                } else {
                    this.log(`Node.js detectado: ${stdout.trim()}`, 'success');
                    resolve();
                }
            });
        });
    }

    async checkDependencies() {
        this.log('Verificando dependências...', 'loading');
        
        if (!fs.existsSync('node_modules')) {
            this.log('Instalando dependências...', 'loading');
            
            return new Promise((resolve, reject) => {
                const npm = spawn('npm', ['install'], { stdio: 'inherit' });
                
                npm.on('close', (code) => {
                    if (code === 0) {
                        this.log('Dependências instaladas!', 'success');
                        resolve();
                    } else {
                        this.log('Erro ao instalar dependências!', 'error');
                        reject(new Error('npm install failed'));
                    }
                });
            });
        } else {
            this.log('Dependências OK!', 'success');
        }
    }

    async checkPort() {
        return new Promise((resolve) => {
            exec('lsof -i :3000', (error) => {
                if (!error) {
                    this.log('Porta 3000 já está em uso!', 'warning');
                    // Para o processo existente
                    exec('lsof -ti:3000 | xargs kill -9', () => {
                        this.log('Processo anterior finalizado', 'info');
                        setTimeout(resolve, 2000);
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    async startServer() {
        this.log('Iniciando servidor...', 'loading');
        
        return new Promise((resolve, reject) => {
            const serverPath = path.join(__dirname, 'src', 'app.js');
            
            if (!fs.existsSync(serverPath)) {
                this.log('Arquivo src/app.js não encontrado!', 'error');
                reject(new Error('Server file not found'));
                return;
            }

            this.serverProcess = spawn('node', [serverPath], {
                stdio: ['inherit', 'pipe', 'pipe']
            });

            // Salvar PID
            fs.writeFileSync(this.pidFile, this.serverProcess.pid.toString());

            // Logs do servidor
            this.serverProcess.stdout.on('data', (data) => {
                process.stdout.write(data);
            });

            this.serverProcess.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            this.serverProcess.on('close', (code) => {
                this.log(`Servidor encerrado com código ${code}`, 'warning');
                this.cleanup();
            });

            // Aguardar servidor inicializar
            setTimeout(() => {
                this.log('Servidor iniciado!', 'success');
                resolve();
            }, 5000);
        });
    }

    async openBrowser() {
        this.log('Abrindo painel de controle...', 'loading');
        
        const url = 'http://localhost:3000/control';
        let command;

        switch (this.platform) {
            case 'darwin': // macOS
                command = `open "${url}"`;
                break;
            case 'win32': // Windows
                command = `start "${url}"`;
                break;
            default: // Linux
                command = `xdg-open "${url}" || firefox "${url}" || google-chrome "${url}"`;
        }

        exec(command, (error) => {
            if (error) {
                this.log(`Abra manualmente: ${url}`, 'warning');
            } else {
                this.log('Painel de controle aberto!', 'success');
            }
        });
    }

    showInstructions() {
        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│  🎮 Painel de Controle: http://localhost:3000/control      │');
        console.log('│  ⚙️  Admin: http://localhost:3000/admin                     │');
        console.log('│  📊 Dashboard: http://localhost:3000                       │');
        console.log('│  🧪 Teste: http://localhost:3000/test-chat                 │');
        console.log('└─────────────────────────────────────────────────────────────┘');
        console.log('\n💡 Para parar o servidor: Ctrl+C');
        console.log('📱 WhatsApp: Escaneie o QR Code quando aparecer\n');
    }

    cleanup() {
        if (fs.existsSync(this.pidFile)) {
            fs.unlinkSync(this.pidFile);
        }
    }

    setupSignalHandlers() {
        const shutdown = () => {
            this.log('Parando servidor...', 'warning');
            
            if (this.serverProcess) {
                this.serverProcess.kill('SIGTERM');
            }
            
            this.cleanup();
            this.log('Sistema parado!', 'success');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    async launch() {
        try {
            console.clear();
            this.log('Iniciando AutoPeças Chatbot...', 'loading');
            
            await this.checkNodeJs();
            await this.checkDependencies();
            await this.checkPort();
            
            this.setupSignalHandlers();
            
            await this.startServer();
            await this.openBrowser();
            
            this.showInstructions();
            
            // Manter o processo vivo
            process.stdin.resume();
            
        } catch (error) {
            this.log(`Erro fatal: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Executar launcher
const launcher = new AutoPecasLauncher();
launcher.launch();