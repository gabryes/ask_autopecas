// src/server.js
require('dotenv').config();

const App = require('./app');
const DatabaseService = require('./services/databaseService');
const WhatsAppService = require('./services/whatsappService');
const MessageController = require('./controllers/messageController');
const CatalogService = require('./services/catalogService');
const AIService = require('./services/aiService'); // NOVO: Importar AIService
const ServiceManager = require('./services/serviceManager');

class Server {
    constructor() {
        this.app = null;
        this.services = {};
    }

    async start() {
        try {
            console.log('🚀 Iniciando servidor AutoPeças...');

            // 1. Criar instância da aplicação
            this.app = new App();
            console.log('✅ App criado');

            // 2. Conectar ao banco de dados
            console.log('🔗 Conectando ao banco de dados...');
            this.services.database = new DatabaseService();
            await this.services.database.connect();
            this.app.setDbConnection(this.services.database.getConnection());

            // 3. Inicializar CatalogService
            console.log('📦 Inicializando CatalogService...');
            this.services.catalog = new CatalogService();
            // CHAMA O MÉTODO initialize() DO CATALOGSERVICE
            await this.services.catalog.initialize(); // AGORA CHAMA initialize()
            this.app.setCatalogService(this.services.catalog);

            // 4. Inicializar AIService
            console.log('🧠 Inicializando AIService...');
            this.services.ai = new AIService(); 
            // Não precisa de initialize() aqui, pois o construtor do AIService já lida com a chave da API.

            // 5. Inicializar MessageController (AGORA RECEBE aiService)
            console.log('🤖 Inicializando MessageController...');
            this.services.messageController = new MessageController(this.services.catalog, this.services.ai);
            this.app.setMessageController(this.services.messageController);

            // 6. Inicializar WhatsAppService
            console.log('📱 Inicializando WhatsAppService...');
            // O WhatsAppService no seu código original não recebia messageController no construtor.
            // Se ele for configurado para receber o messageController, então passe aqui.
            // Por enquanto, mantenho a forma como ele era chamado, mas o messageController precisa ser setado nele.
            this.services.whatsapp = new WhatsAppService(); 
            // Adicionar um método no WhatsAppService para setar o messageController, se ele não for passado no construtor
            if (this.services.whatsapp.setMessageController) {
                 this.services.whatsapp.setMessageController(this.services.messageController);
            }
            this.app.setWhatsAppService(this.services.whatsapp);

            // 7. Inicializar ServiceManager
            console.log('⚙️ Inicializando ServiceManager...');
            // ServiceManager agora gerencia a inicialização e status de todos os serviços
            this.services.serviceManager = new ServiceManager(this.app.getApp());
            this.app.setServiceManager(this.services.serviceManager);
            // Passar referências essenciais para o ServiceManager
            this.services.serviceManager.setServices({
                database: this.services.database,
                catalog: this.services.catalog,
                ai: this.services.ai,
                whatsapp: this.services.whatsapp,
                messageController: this.services.messageController // Passar controller para serviceManager poder verificar
            });


            // 8. Iniciar servidor HTTP
            console.log('🌐 Iniciando servidor HTTP...');
            const server = await this.app.start();

            // 9. Configurar WebSocket para ServiceManager
            if (this.services.serviceManager.setupWebSocket) {
                this.services.serviceManager.setupWebSocket(server);
            }

            // 10. Iniciar monitoramento do ServiceManager (agora também inicia os serviços controlados)
            if (this.services.serviceManager.startMonitoring) {
                this.services.serviceManager.startMonitoring();
            }

            // 11. Inicializar WhatsApp (opcional - agora via ServiceManager ou aqui)
            // A inicialização do WhatsApp pode ser controlada pelo ServiceManager para centralizar
            // Ou, se quiser manter a opção AUTO_START_WHATSAPP, o initialize() precisa estar lá.
            if (process.env.AUTO_START_WHATSAPP === 'true') {
                console.log('📱 Iniciando WhatsApp automaticamente...');
                setTimeout(() => {
                    this.services.whatsapp.initialize();
                }, 3000);
            }

            console.log('🎉 Servidor iniciado com sucesso!');
            console.log('📊 Dashboard: http://localhost:3000/');
            console.log('🎮 Controle: http://localhost:3000/control');

            // Testar busca de produtos (após CatalogService estar pronto)
            console.log('🔍 Testando busca de produtos...');
            try {
                const testSearch = await this.services.catalog.searchProducts('pastilha');
                console.log(`🧪 Teste de busca: encontrados ${testSearch.length} produtos para "pastilha"`);
            } catch (error) {
                console.log('⚠️ Erro no teste de busca:', error.message);
            }
            
            // Debug da estrutura (opcional)
            if (this.services.catalog.getAllProducts().length > 0) { // Se CatalogService carregou produtos
                await this.services.catalog.debugProductStructure();
            }

            // Configurar graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            console.error('❌ Erro ao iniciar servidor:', error);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Recebido sinal ${signal}. Encerrando servidor...`);
            
            try {
                // Parar WhatsApp
                if (this.services.whatsapp && this.services.whatsapp.destroy) {
                    console.log('📱 Encerrando WhatsApp...');
                    await this.services.whatsapp.destroy();
                }

                // Parar servidor HTTP
                if (this.app && this.app.stop) {
                    console.log('🌐 Encerrando servidor HTTP...');
                    await this.app.stop();
                }

                // Desconectar banco
                if (this.services.database && this.services.database.disconnect) {
                    console.log('🔗 Desconectando banco de dados...');
                    await this.services.database.disconnect();
                }

                console.log('✅ Servidor encerrado com sucesso');
                process.exit(0);
            } catch (error) {
                console.error('❌ Erro ao encerrar servidor:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Para nodemon
    }
}

// Iniciar servidor se executado diretamente
if (require.main === module) {
    const server = new Server();
    server.start();
}

module.exports = Server;