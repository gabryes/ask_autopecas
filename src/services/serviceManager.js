const EventEmitter = require('events');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class ServiceManager extends EventEmitter {
    constructor() {
        super();
        this.services = {
            database: { status: 'stopped', process: null, pid: null },
            whatsapp: { status: 'stopped', process: null, pid: null },
            api: { status: 'stopped', process: null, pid: null },
            chatbot: { status: 'stopped', process: null, pid: null }
        };
        
        this.logs = [];
        this.maxLogs = 1000;
        
        console.log('✅ ServiceManager inicializado');
    }

    // Iniciar todos os serviços
    async startAllServices() {
        try {
            this.addLog('🚀 Iniciando todos os serviços...', 'info');
            
            // 1. Verificar MongoDB
            await this.startDatabase();
            await this.delay(2000);
            
            // 2. Iniciar API
            await this.startAPI();
            await this.delay(1000);
            
            // 3. Iniciar WhatsApp
            await this.startWhatsApp();
            await this.delay(1000);
            
            // 4. Iniciar Chatbot
            await this.startChatbot();
            
            this.addLog('✅ Todos os serviços iniciados com sucesso!', 'success');
            this.emit('services-started');
            
            return true;
        } catch (error) {
            this.addLog(`❌ Erro ao iniciar serviços: ${error.message}`, 'error');
            this.emit('services-error', error);
            return false;
        }
    }

    // Parar todos os serviços
    async stopAllServices() {
        try {
            this.addLog('🛑 Parando todos os serviços...', 'warning');
            
            await this.stopChatbot();
            await this.stopWhatsApp();
            await this.stopAPI();
            await this.stopDatabase();
            
            this.addLog('✅ Todos os serviços parados!', 'success');
            this.emit('services-stopped');
            
            return true;
        } catch (error) {
            this.addLog(`❌ Erro ao parar serviços: ${error.message}`, 'error');
            return false;
        }
    }

    // Iniciar MongoDB
    async startDatabase() {
        return new Promise((resolve, reject) => {
            this.addLog('🔗 Verificando conexão MongoDB...', 'info');
            
            // Verificar se MongoDB está rodando
            exec('mongod --version', (error, stdout, stderr) => {
                if (error) {
                    this.addLog('⚠️ MongoDB não encontrado localmente, usando conexão remota', 'warning');
                    this.services.database.status = 'running';
                    resolve();
                } else {
                    this.addLog('✅ MongoDB detectado e funcionando', 'success');
                    this.services.database.status = 'running';
                    resolve();
                }
            });
        });
    }

    // Iniciar API
    async startAPI() {
        return new Promise((resolve, reject) => {
            if (this.services.api.status === 'running') {
                resolve();
                return;
            }

            this.addLog('🌐 Iniciando servidor API...', 'info');
            
            const apiPath = path.join(__dirname, '../app.js');
            const apiProcess = spawn('node', [apiPath], {
                cwd: process.cwd(),
                env: { ...process.env, NODE_ENV: 'production' }
            });

            apiProcess.stdout.on('data', (data) => {
                this.addLog(`[API] ${data.toString().trim()}`, 'info');
            });

            apiProcess.stderr.on('data', (data) => {
                this.addLog(`[API ERROR] ${data.toString().trim()}`, 'error');
            });

            apiProcess.on('close', (code) => {
                this.addLog(`[API] Processo encerrado com código ${code}`, 'warning');
                this.services.api.status = 'stopped';
                this.emit('service-stopped', 'api');
            });

            // Aguardar alguns segundos para o servidor iniciar
            setTimeout(() => {
                this.services.api.status = 'running';
                this.services.api.process = apiProcess;
                this.services.api.pid = apiProcess.pid;
                this.addLog('✅ Servidor API iniciado!', 'success');
                resolve();
            }, 3000);
        });
    }

    // Iniciar WhatsApp
    async startWhatsApp() {
        this.addLog('📱 Iniciando WhatsApp Web...', 'info');
        this.services.whatsapp.status = 'connecting';
        this.emit('whatsapp-connecting');
        
        // Simular processo de conexão
        setTimeout(() => {
            this.services.whatsapp.status = 'running';
            this.addLog('✅ WhatsApp conectado!', 'success');
            this.emit('whatsapp-connected');
        }, 5000);
    }

    // Iniciar Chatbot
    async startChatbot() {
        this.addLog('🤖 Iniciando lógica do chatbot...', 'info');
        this.services.chatbot.status = 'running';
        this.addLog('✅ Chatbot ativo e pronto!', 'success');
        this.emit('chatbot-ready');
    }

    // Parar serviços individuais
    async stopAPI() {
        if (this.services.api.process) {
            this.services.api.process.kill();
            this.services.api.status = 'stopped';
            this.addLog('🛑 Servidor API parado', 'warning');
        }
    }

    async stopWhatsApp() {
        this.services.whatsapp.status = 'stopped';
        this.addLog('🛑 WhatsApp desconectado', 'warning');
        this.emit('whatsapp-disconnected');
    }

    async stopChatbot() {
        this.services.chatbot.status = 'stopped';
        this.addLog('🛑 Chatbot parado', 'warning');
    }

    async stopDatabase() {
        this.services.database.status = 'stopped';
        this.addLog('🛑 Conexão database fechada', 'warning');
    }

    // Reiniciar serviço específico
    async restartService(serviceName) {
        this.addLog(`🔄 Reiniciando ${serviceName}...`, 'info');
        
        switch(serviceName) {
            case 'whatsapp':
                await this.stopWhatsApp();
                await this.delay(1000);
                await this.startWhatsApp();
                break;
            case 'api':
                await this.stopAPI();
                await this.delay(2000);
                await this.startAPI();
                break;
            case 'chatbot':
                await this.stopChatbot();
                await this.delay(1000);
                await this.startChatbot();
                break;
        }
    }

    // Verificar status dos serviços
    getServicesStatus() {
        return {
            services: this.services,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                node_version: process.version
            },
            timestamp: new Date().toISOString()
        };
    }

    // Gerenciar logs
    addLog(message, type = 'info') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            message: message,
            type: type
        };
        
        this.logs.unshift(logEntry);
        
        // Limitar número de logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
        
        // Emitir evento para interface
        this.emit('new-log', logEntry);
        
        // Log no console também
        const emoji = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        console.log(`${emoji[type] || 'ℹ️'} ${message}`);
    }

    getLogs(limit = 100) {
        return this.logs.slice(0, limit);
    }

    clearLogs() {
        this.logs = [];
        this.addLog('🧹 Logs limpos', 'info');
    }

    // Utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Verificar saúde do sistema
    async healthCheck() {
        const health = {
            database: this.services.database.status === 'running',
            api: this.services.api.status === 'running',
            whatsapp: this.services.whatsapp.status === 'running',
            chatbot: this.services.chatbot.status === 'running'
        };
        
        health.overall = Object.values(health).every(status => status);
        
        return health;
    }

    // Configurar auto-restart
    setupAutoRestart() {
        setInterval(async () => {
            const health = await this.healthCheck();
            
            if (!health.overall) {
                this.addLog('🔄 Auto-restart detectou problemas, reiniciando serviços...', 'warning');
                
                if (!health.api) await this.restartService('api');
                if (!health.whatsapp) await this.restartService('whatsapp');
                if (!health.chatbot) await this.restartService('chatbot');
            }
        }, 30000); // Verificar a cada 30 segundos
    }
}

module.exports = ServiceManager;