const EventEmitter = require('events');
const WebSocket = require('ws');
const os = require('os'); // Para informações do sistema

class ServiceManager extends EventEmitter {
    constructor(app) {
        super();
        this.app = app; // Instância do Express App
        this.services = {
            database: { status: 'unknown', details: 'Aguardando verificação' },
            whatsapp: { status: 'stopped', details: 'Desconectado' },
            api: { status: 'running', details: 'Online' }, // API deve estar sempre rodando se o manager está ativo
            chatbot: { status: 'stopped', details: 'Inativo' },
            catalog: { status: 'stopped', details: 'Não carregado' },
            ai: { status: 'stopped', details: 'Não configurado' }
        };
        
        this.logs = [];
        this.maxLogs = 1000; // Limite de logs em memória
        this.wsClients = new Set(); // Clientes WebSocket conectados
        this.monitoringInterval = null; // Para o setInterval do monitoramento

        // Referências para os serviços reais (serão setadas via `setServices`)
        this.realServices = {}; 
        
        console.log('✅ ServiceManager inicializado');
        
        // Iniciar monitoramento após um curto delay para que outros serviços possam inicializar
        setTimeout(() => {
            this.startMonitoring();
        }, 5000); // Inicia monitoramento após 5 segundos
    }

    /**
     * Seta as referências para as instâncias reais dos outros serviços.
     * @param {object} services Objeto com referências dos serviços (database, whatsapp, etc.).
     */
    setServices(services) {
        this.realServices = services;
        console.log('✅ Referências dos serviços reais configuradas no ServiceManager.');
        // Forçar uma verificação de status inicial após as referências estarem setadas
        this.checkRealStatus();
    }

    /**
     * Verifica o status real de todos os serviços.
     */
    async checkRealStatus() {
        console.log('🔄 Verificando status real dos serviços...');
        try {
            // Verificar Database
            if (this.realServices.database) {
                const dbStatus = await this.realServices.database.isConnectionActive();
                this.services.database.status = dbStatus ? 'running' : 'stopped';
                this.services.database.details = dbStatus ? 'Conectado ao MongoDB' : 'Desconectado do MongoDB';
            }

            // Verificar CatalogService
            if (this.realServices.catalog) {
                // Supondo que CatalogService tem um método `isInitialized()` ou `products` array
                const isCatalogReady = this.realServices.catalog.isInitialized && this.realServices.catalog.products.length > 0;
                this.services.catalog.status = isCatalogReady ? 'running' : 'stopped';
                this.services.catalog.details = isCatalogReady ? `${this.realServices.catalog.products.length} produtos carregados` : 'Produtos não carregados';
                // Broadcast contagem de produtos para o painel de controle
                this.broadcast({
                    type: 'products-count',
                    data: { count: this.realServices.catalog.products.length }
                });
            }

            // Verificar AIService
            if (this.realServices.ai) {
                // Supondo que AIService tem uma propriedade `openai` que indica se está configurado
                this.services.ai.status = this.realServices.ai.openai ? 'running' : 'stopped';
                this.services.ai.details = this.realServices.ai.openai ? 'API OpenAI conectada' : 'Modo simulação';
            }

            // Verificar WhatsAppService
            if (this.realServices.whatsapp) {
                const isWhatsAppReady = this.realServices.whatsapp.isReady();
                this.services.whatsapp.status = isWhatsAppReady ? 'running' : 'stopped';
                this.services.whatsapp.details = isWhatsAppReady ? `Conectado (${this.realServices.whatsapp.getConnectedNumber() || 'número não descoberto'})` : 'Desconectado';
                // Broadcast status específico do WhatsApp para o painel de controle
                this.broadcast({
                    type: 'whatsapp-status',
                    data: { 
                        status: this.services.whatsapp.status === 'running' ? 'connected' : 'disconnected',
                        number: this.realServices.whatsapp.getConnectedNumber(),
                        progress: this.services.whatsapp.status === 'connecting' ? 50 : (this.services.whatsapp.status === 'running' ? 100 : 0)
                    }
                });
            }

            // Verificar Chatbot (MessageController)
            if (this.realServices.messageController) {
                this.services.chatbot.status = 'running'; // Se o controller existe, ele está apto a funcionar
                this.services.chatbot.details = 'Pronto para processar mensagens';
            } else {
                this.services.chatbot.status = 'stopped';
                this.services.chatbot.details = 'MessageController não disponível';
            }

            // API sempre rodando se o manager está ativo
            this.services.api.status = 'running';
            this.services.api.details = 'Servidor API online';

            this.broadcastStatus(); // Envia o status atualizado para todos os clientes WebSocket
            
        } catch (error) {
            this.addLog(`⚠️ Erro durante a verificação de status: ${error.message}`, 'warning');
        }
    }

    /**
     * Configura o servidor WebSocket para broadcast de logs e status.
     * @param {object} server Instância do servidor HTTP.
     */
    setupWebSocket(server) {
        try {
            this.wss = new WebSocket.Server({ server });
            
            this.wss.on('connection', (ws) => {
                this.wsClients.add(ws);
                this.addLog('🔗 Cliente WebSocket conectado', 'info');
                
                // Enviar status atual e logs existentes para o novo cliente
                ws.send(JSON.stringify({ type: 'services-status', data: this.getServicesStatus() }));
                ws.send(JSON.stringify({ type: 'logs', data: this.logs.slice(0, 50) })); // Envia os 50 logs mais recentes
                
                ws.on('close', () => {
                    this.wsClients.delete(ws);
                    this.addLog('📴 Cliente WebSocket desconectado', 'info');
                });
                ws.on('error', (error) => {
                    this.addLog(`❌ Erro no WebSocket do cliente: ${error.message}`, 'error');
                });
            });
            
            this.addLog('📡 WebSocket configurado com sucesso para Painel de Controle', 'success');
        } catch (error) {
            this.addLog(`❌ Erro ao configurar WebSocket: ${error.message}`, 'error');
        }
    }

    /**
     * Envia uma mensagem para todos os clientes WebSocket conectados.
     * @param {object} data Dados a serem enviados.
     */
    broadcast(data) {
        const message = JSON.stringify(data);
        this.wsClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    console.error('Erro ao enviar mensagem WebSocket:', error);
                }
            }
        });
    }

    /**
     * Envia o status atual de todos os serviços para os clientes WebSocket.
     */
    broadcastStatus() {
        this.broadcast({
            type: 'services-status',
            data: this.getServicesStatus()
        });
    }

    /**
     * Inicia todos os serviços controlados pelo ServiceManager.
     * Esta é uma função de controle para o painel.
     */
    async startAllServices() {
        this.addLog('🚀 Iniciando todos os serviços controlados...', 'info');
        try {
            // A ordem pode ser importante aqui
            if (this.realServices.database && typeof this.realServices.database.connect === 'function') {
                await this.realServices.database.connect();
            }
            if (this.realServices.catalog && typeof this.realServices.catalog.initialize === 'function') {
                await this.realServices.catalog.initialize();
            }
            // IA já deve estar inicializada via construtor
            if (this.realServices.whatsapp && typeof this.realServices.whatsapp.initialize === 'function') {
                await this.realServices.whatsapp.initialize();
            }
            // O chatbot (MessageController) deve estar pronto se seus serviços base estão
            
            this.addLog('✅ Todos os serviços controlados verificados/iniciados!', 'success');
            this.checkRealStatus(); // Atualiza o status completo
            return true;
        } catch (error) {
            this.addLog(`❌ Erro ao iniciar serviços controlados: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Para todos os serviços controlados.
     * Esta é uma função de controle para o painel.
     */
    async stopAllServices() {
        this.addLog('🛑 Parando todos os serviços controlados...', 'warning');
        try {
            if (this.realServices.whatsapp && typeof this.realServices.whatsapp.destroy === 'function') {
                await this.realServices.whatsapp.destroy();
            }
            // Outros serviços como DB, API, AI e Catalog geralmente ficam rodando ou não têm um 'stop' simples para apps web.
            // Poderia adicionar lógica para 'desativar' o chatbot se ele for um módulo separável.

            this.addLog('✅ Serviços controlados parados (WhatsApp desconectado).', 'success');
            this.checkRealStatus(); // Atualiza o status completo
            return true;
        } catch (error) {
            this.addLog(`❌ Erro ao parar serviços controlados: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Reinicia um serviço específico ou todos.
     * @param {string} serviceName Nome do serviço ('all', 'whatsapp', 'chatbot', etc.).
     */
    async restartService(serviceName) {
        this.addLog(`🔄 Reiniciando ${serviceName}...`, 'info');
        
        try {
            if (serviceName === 'all') {
                await this.stopAllServices();
                await this.delay(2000); // Pequeno delay
                await this.startAllServices();
            } else {
                switch(serviceName) {
                    case 'whatsapp':
                        if (this.realServices.whatsapp && typeof this.realServices.whatsapp.destroy === 'function') await this.realServices.whatsapp.destroy();
                        if (this.realServices.whatsapp && typeof this.realServices.whatsapp.initialize === 'function') await this.realServices.whatsapp.initialize();
                        break;
                    case 'catalog': // Forçar recarga do catálogo
                        if (this.realServices.catalog && typeof this.realServices.catalog.initialize === 'function') {
                            this.realServices.catalog.isInitialized = false; // Força recarregar
                            await this.realServices.catalog.initialize();
                        }
                        break;
                    // Adicione mais casos conforme a necessidade de reiniciar serviços individuais
                    default:
                        this.addLog(`Serviço '${serviceName}' não tem uma rotina de reinício definida.`, 'warning');
                        break;
                }
            }
            this.addLog(`✅ Reinício de ${serviceName} concluído!`, 'success');
            this.checkRealStatus(); // Atualiza o status completo
            return true;
        } catch (error) {
            this.addLog(`❌ Erro ao reiniciar ${serviceName}: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Obtém o status atual de todos os serviços e informações do sistema.
     * @returns {object} Objeto com status dos serviços e info do sistema.
     */
    getServicesStatus() {
        const uptimeSeconds = process.uptime();
        const uptimeHours = Math.floor(uptimeSeconds / 3600);
        const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

        return {
            services: this.services,
            system: {
                uptime: `${uptimeHours}h ${uptimeMinutes}m`,
                memory: process.memoryUsage(),
                cpu: os.loadavg(), // Carga média do CPU
                platform: os.platform(),
                node_version: process.version,
                pid: process.pid,
                arch: os.arch(),
                totalmem: os.totalmem(),
                freemem: os.freemem(),
                cpus: os.cpus().length // Número de cores
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Adiciona uma entrada de log e a transmite para os clientes WebSocket.
     * @param {string} message Mensagem do log.
     * @param {string} type Tipo do log ('info', 'success', 'warning', 'error').
     */
    addLog(message, type = 'info') {
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            message: message,
            type: type
        };
        
        this.logs.unshift(logEntry); // Adiciona no início
        
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs); // Limita o tamanho do array de logs
        }
        
        // Broadcast para clientes WebSocket
        this.broadcast({
            type: 'new-log',
            data: logEntry
        });
        
        const emoji = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        
        console.log(`${emoji[type] || 'ℹ️'} [${new Date().toLocaleTimeString()}] ${message}`);
    }

    /**
     * Retorna os logs armazenados.
     * @param {number} limit Limite de logs a retornar.
     * @returns {Array} Lista de logs.
     */
    getLogs(limit = 100) {
        return this.logs.slice(0, limit);
    }

    /**
     * Limpa todos os logs armazenados e notifica os clientes.
     */
    clearLogs() {
        this.logs = [];
        this.addLog('🧹 Logs limpos', 'info');
        this.broadcast({ type: 'logs-cleared', data: true });
    }

    /**
     * Simula a geração de um QR Code (para o painel de controle do WhatsApp).
     * @returns {string} QR Code ASCII simulado.
     */
    generateQRCode() {
        this.addLog('📷 Gerando QR Code (simulado)...', 'info');
        const qrAscii = `
██████████████  ██  ██████████████
██          ██    ██  ██          ██
██  ██████  ██  ████  ██  ██████  ██
██  ██████  ██    ██  ██  ██████  ██
██  ██████  ██  ████  ██  ██████  ██
██          ██  ██    ██          ██
██████████████  ██  ██████████████
                ██
██████████████  ██  ██████████████
                ██                
██  ████  ██████    ██████  ██  ██
    ██      ██  ██████    ██████  
██████  ██████████    ██████████  
  ██  ██    ██  ██████  ██    ████
██████████  ██████  ██████████    
                ██                
██████████████    ██████    ██████
██          ██  ████  ██████  ██  
██  ██████  ██    ██████    ██████
██  ██████  ██  ██  ██  ██████    
██  ██████  ██  ████████    ██████
██          ██    ██  ██████  ████
██████████████  ██████    ████████
        `;
        
        this.broadcast({ type: 'qr-code', data: { qr: qrAscii } });
        return qrAscii;
    }

    /**
     * Executa testes de sanidade no sistema.
     * @returns {Promise<Array>} Lista de resultados dos testes.
     */
    async runSystemTest() {
        this.addLog('🧪 Executando teste completo do sistema...', 'info');
        
        const tests = [
            { name: 'Conexão DB', status: this.services.database.status === 'running' ? 'PASS' : 'FAIL', details: this.services.database.details },
            { name: 'Catálogo de Produtos', status: this.services.catalog.status === 'running' ? 'PASS' : 'FAIL', details: this.services.catalog.details },
            { name: 'Serviço de IA', status: this.services.ai.status === 'running' ? 'PASS' : 'FAIL', details: this.services.ai.details },
            { name: 'API HTTP', status: this.services.api.status === 'running' ? 'PASS' : 'FAIL', details: this.services.api.details },
            { name: 'Chatbot Core', status: this.services.chatbot.status === 'running' ? 'PASS' : 'FAIL', details: this.services.chatbot.details }
        ];
        
        // Simular teste de envio/recebimento de mensagem via WhatsAppService
        try {
            if (this.realServices.whatsapp && this.realServices.whatsapp.isReady()) {
                const testChatId = '5511999999999@c.us'; // Número de teste
                const testMessage = 'Olá, sou um teste de sistema.';
                this.addLog('Simulando envio de mensagem de teste...', 'info');
                const sent = await this.realServices.whatsapp.sendMessage(testChatId, testMessage);
                if (sent) {
                    tests.push({ name: 'Envio WhatsApp', status: 'PASS', details: 'Mensagem de teste simulada enviada.' });
                    // Poderia adicionar um mock de MessageController para "responder" a essa mensagem de teste
                } else {
                    tests.push({ name: 'Envio WhatsApp', status: 'FAIL', details: 'Falha ao simular envio de mensagem.' });
                }
            } else {
                tests.push({ name: 'Envio WhatsApp', status: 'SKIP', details: 'WhatsApp não está pronto para testes.' });
            }
        } catch (error) {
            tests.push({ name: 'Envio WhatsApp', status: 'FAIL', details: `Erro no teste de mensagem: ${error.message}` });
        }
        
        tests.forEach(test => this.addLog(`Resultado: ${test.name} - ${test.status} (${test.details})`, test.status === 'PASS' ? 'success' : 'error'));
        return tests;
    }

    /**
     * Cria um atraso assíncrono.
     * @param {number} ms Milissegundos para atrasar.
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Inicia o monitoramento periódico do status dos serviços.
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.monitoringInterval = setInterval(() => {
            this.checkRealStatus();
        }, 10000); // Verifica a cada 10 segundos
        
        this.addLog('🔄 Monitoramento contínuo iniciado', 'info');
    }

    /**
     * Para o monitoramento periódico.
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            this.addLog('🛑 Monitoramento contínuo parado', 'warning');
        }
    }
}

module.exports = ServiceManager;