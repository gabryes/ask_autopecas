const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');

// Modelos de dados para buscar informações reais para o Dashboard e APIs
const Product = require('./models/Product');
const Conversation = require('./models/Conversation');
const Lead = require('./models/Lead');
const MessageCategory = require('./models/MessageCategory');
const MessageTemplate = require('./models/MessageTemplate');

class App {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.port = process.env.PORT || 3000;
        
        this.setupMiddleware();
        this.setupStaticFiles();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Configuração de CORS para permitir requisições do frontend
        this.app.use(cors({
            origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
            credentials: true
        }));

        // Parse de JSON e URL-encoded bodies com limite de 10MB
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Headers de segurança básicos
        this.app.use((req, res, next) => {
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('X-XSS-Protection', '1; mode=block');
            next();
        });

        console.log('✅ Middleware configurado');
    }

    setupStaticFiles() {
        // Serve arquivos estáticos da pasta 'public'
        this.app.use(express.static(path.join(__dirname, '../public')));
        console.log('✅ Arquivos estáticos configurados');
    }

    setupRoutes() {
        // Rota padrão - Dashboard principal
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/dashboard.html'));
        });

        // Rota de informações da API
        this.app.get('/api', (req, res) => {
            res.json({
                message: 'Chatbot AutoPeças API',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    stats: '/api/stats',
                    conversations_recent: '/api/conversations/recent',
                    analytics_activity: '/api/analytics/activity',
                    analytics_categories: '/api/analytics/categories',
                    test_message: 'POST /api/test-message',
                    test_page: '/test-chat',
                    control_panel: '/control',
                    admin_panel: '/admin',
                    debug_mongodb: '/api/debug-mongodb',
                    debug_catalog_service: '/api/debug-catalog-service',
                    debug_products_full: '/api/debug-products-full'
                }
            });
        });

        // Rota de estatísticas para o Dashboard (COM DADOS REAIS E FALLBACKS)
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = {
                    catalog: { total_products: 0, categories: 0, brands: 0 },
                    conversations: { total: 0, active: 0, today: 0 },
                    leads: { total: 0, today: 0, converted: 0 },
                    escalations: { today: 0, total: 0 },
                    system: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        platform: process.platform,
                        node_version: process.version,
                        pid: process.pid
                    }
                };

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // 1. Estatísticas do Catálogo (sempre funciona)
                try {
                    const productCount = await Product.countDocuments();
                    const categories = await Product.distinct('category');
                    const brands = await Product.distinct('brand');
                    stats.catalog = {
                        total_products: productCount,
                        categories: categories.length,
                        brands: brands.length
                    };
                } catch (err) { 
                    console.error('Erro ao buscar stats de Catálogo:', err.message); 
                }

                // 2. Estatísticas de Conversas (com fallback)
                try {
                    const conversationCount = await Conversation.countDocuments();
                    const conversationsToday = await Conversation.countDocuments({
                        timestamp: { $gte: today }
                    });
                    
                    stats.conversations.total = conversationCount;
                    stats.conversations.today = conversationsToday;
                } catch (err) { 
                    console.error('Erro ao buscar stats de Conversas (collection pode não existir):', err.message);
                    // Se não existir a collection, usar valores padrão
                    stats.conversations = { total: 0, active: 0, today: 0 };
                }

                // 3. Estatísticas de Leads (com fallback)
                try {
                    const leadCount = await Lead.countDocuments();
                    const leadsToday = await Lead.countDocuments({ created_at: { $gte: today } });
                    const leadsConverted = await Lead.countDocuments({ status: 'converted' });
                    const leadsActive = await Lead.countDocuments({ status: { $in: ['new', 'qualified', 'quoted'] } });
                    const escalationsTotal = await Lead.countDocuments({ status: 'escalated' });
                    const escalationsToday = await Lead.countDocuments({ 
                        status: 'escalated', 
                        escalated_at: { $gte: today } 
                    });

                    stats.leads = { total: leadCount, today: leadsToday, converted: leadsConverted };
                    stats.conversations.active = leadsActive; // Conversas ativas baseadas em leads
                    stats.escalations = { total: escalationsTotal, today: escalationsToday };
                } catch (err) { 
                    console.error('Erro ao buscar stats de Leads (collection pode não existir):', err.message);
                    // Se não existir a collection, usar valores padrão
                    stats.leads = { total: 0, today: 0, converted: 0 };
                    stats.escalations = { today: 0, total: 0 };
                    stats.conversations.active = 0;
                }
                
                res.json(stats);
            } catch (error) {
                console.error('Erro ao gerar estatísticas:', error);
                res.status(500).json({ 
                    error: 'Erro interno ao gerar estatísticas',
                    details: error.message 
                });
            }
        });

        // Rota para conversas recentes (COM DADOS REAIS E FALLBACKS)
        this.app.get('/api/conversations/recent', async (req, res) => {
            try {
                let formattedConversations = [];

                try {
                    // Busque as 5 conversas mais recentes
                    const conversations = await Conversation.find()
                        .sort({ timestamp: -1 })
                        .limit(5); 
                    
                    formattedConversations = await Promise.all(conversations.map(async conv => {
                        let lead = null;
                        try {
                            lead = await Lead.findOne({ whatsapp_id: conv.whatsapp_id });
                        } catch (leadErr) {
                            // Se Lead collection não existir, ignora
                        }
                        
                        return {
                            id: conv._id,
                            contact: conv.whatsapp_id,
                            name: lead ? lead.name : conv.whatsapp_id.split('@')[0],
                            lastMessage: conv.user_message,
                            timestamp: conv.timestamp.toISOString(),
                            status: lead ? lead.status : 'completed',
                            category: conv.intent
                        };
                    }));
                } catch (err) {
                    console.error('Erro ao buscar conversas recentes (collection pode não existir):', err.message);
                    // Se não existir conversations, retorna array vazio
                    formattedConversations = [];
                }

                res.json({
                    success: true,
                    conversations: formattedConversations,
                    total: formattedConversations.length
                });
            } catch (error) {
                console.error('Erro ao buscar conversas recentes:', error);
                res.status(500).json({ 
                    error: 'Erro interno ao buscar conversas recentes',
                    details: error.message 
                });
            }
        });

        // Rota para dados do gráfico de atividade (COM DADOS REAIS E FALLBACKS)
        this.app.get('/api/analytics/activity', async (req, res) => {
            try {
                let fullActivity = [];

                try {
                    // Para simplificar, vamos agregar conversas por dia na última semana
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    sevenDaysAgo.setHours(0, 0, 0, 0);

                    const activityData = await Conversation.aggregate([
                        { $match: { timestamp: { $gte: sevenDaysAgo } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                                conversations: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } }
                    ]);

                    // Garante que todos os 7 dias estejam presentes, mesmo que sem conversas
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(sevenDaysAgo);
                        d.setDate(d.getDate() + i);
                        const dateString = d.toISOString().slice(0, 10);
                        const found = activityData.find(item => item._id === dateString);
                        fullActivity.push({
                            day: d.toLocaleString('pt-BR', { weekday: 'short' }),
                            conversations: found ? found.conversations : 0,
                            date: dateString
                        });
                    }
                } catch (err) {
                    console.error('Erro ao buscar dados de atividade (collection pode não existir):', err.message);
                    // Se não existir conversations, cria dados vazios para os 7 dias
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    
                    for (let i = 0; i < 7; i++) {
                        const d = new Date(sevenDaysAgo);
                        d.setDate(d.getDate() + i);
                        fullActivity.push({
                            day: d.toLocaleString('pt-BR', { weekday: 'short' }),
                            conversations: 0,
                            date: d.toISOString().slice(0, 10)
                        });
                    }
                }

                res.json({
                    success: true,
                    data: fullActivity
                });
            } catch (error) {
                console.error('Erro ao buscar dados de atividade:', error);
                res.status(500).json({ 
                    error: 'Erro interno ao buscar dados de atividade',
                    details: error.message 
                });
            }
        });

        // Rota para categorias mais procuradas (COM DADOS REAIS)
        this.app.get('/api/analytics/categories', async (req, res) => {
            try {
                let categories = [];

                try {
                    const categoryStats = await Product.aggregate([
                        { $match: { stock: { $gt: 0 }, is_active: true } },
                        { $group: { _id: '$category', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 7 }
                    ]);

                    // Formatar para o frontend
                    const totalProductsInTopCategories = categoryStats.reduce((sum, item) => sum + item.count, 0);
                    categories = categoryStats.map(item => ({
                        name: item._id,
                        count: item.count,
                        percentage: totalProductsInTopCategories > 0 ? 
                            ((item.count / totalProductsInTopCategories) * 100).toFixed(2) : 0
                    }));
                } catch (err) {
                    console.error('Erro ao buscar categorias de produtos:', err.message);
                    // Se der erro, retorna categorias vazias
                    categories = [];
                }

                res.json({
                    success: true,
                    categories
                });
            } catch (error) {
                console.error('Erro ao buscar categorias mais procuradas:', error);
                res.status(500).json({ 
                    error: 'Erro interno ao buscar categorias',
                    details: error.message 
                });
            }
        });

        // Rota para status do ServiceManager (NOVA - para o dashboard.js)
        this.app.get('/api/control/status', (req, res) => {
            try {
                const serviceManager = this.app.locals.serviceManager;
                if (serviceManager) {
                    const status = serviceManager.getServicesStatus();
                    res.json(status);
                } else {
                    res.json({
                        services: {
                            api: { status: 'running', details: 'Online' },
                            database: { status: 'unknown', details: 'ServiceManager não disponível' },
                            whatsapp: { status: 'unknown', details: 'ServiceManager não disponível' },
                            chatbot: { status: 'unknown', details: 'ServiceManager não disponível' },
                            catalog: { status: 'unknown', details: 'ServiceManager não disponível' },
                            ai: { status: 'unknown', details: 'ServiceManager não disponível' }
                        },
                        system: {
                            uptime: process.uptime(),
                            memory: process.memoryUsage(),
                            platform: process.platform,
                            node_version: process.version,
                            pid: process.pid
                        }
                    });
                }
            } catch (error) {
                console.error('Erro ao obter status do ServiceManager:', error);
                res.status(500).json({ 
                    error: 'Erro interno ao obter status',
                    details: error.message 
                });
            }
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version
            });
        });

        // Rota de teste de mensagem (usando o MessageController injetado)
        this.app.post('/api/test-message', async (req, res) => {
            try {
                const { message, contact } = req.body;

                if (!message) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Mensagem é obrigatória' 
                    });
                }

                // Simular um objeto de mensagem e um WhatsAppService para o MessageController
                const mockWhatsappService = {
                    sendMessage: async (chatId, msgContent) => {
                        console.log(`[MOCK WHATSAPP] Mensagem para ${chatId}: ${msgContent}`);
                        return true;
                    },
                    sendCatalog: async (chatId, products) => {
                         console.log(`[MOCK WHATSAPP] Catálogo para ${chatId}: ${products.length} produtos`);
                         return true;
                    }
                };

                // A instância do MessageController deve ser setada em app.locals pelo Server.js
                const messageController = this.app.locals.messageController;
                if (messageController) {
                    // Crie um objeto de mensagem mockado para o controller
                    const mockMessage = {
                        body: message,
                        from: contact || '5511999999999@c.us',
                        to: 'mock_bot_number@c.us'
                    };
                    
                    // Chame o handleMessage do controller
                    await messageController.handleMessage(mockMessage, mockWhatsappService);
                    
                    res.json({
                        success: true,
                        response_info: 'Mensagem processada pelo MessageController. Verifique os logs do console.',
                        processed_at: new Date().toISOString()
                    });

                } else {
                    res.json({
                        success: false,
                        error: 'MessageController não encontrado. O sistema pode não estar totalmente inicializado.',
                        note: 'Verifique se o Server.js está injetando o MessageController em app.locals.'
                    });
                }

            } catch (error) {
                console.error('Erro no teste de mensagem:', error);
                res.status(500).json({
                    success: false,
                    error: 'Erro interno do servidor ao processar mensagem de teste',
                    details: error.message
                });
            }
        });

        // Página de teste do chat
        this.app.get('/test-chat', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/test-chat.html'));
        });

        // Painel de controle
        this.app.get('/control', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/control-panel.html'));
        });

        // Painel administrativo
        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/admin.html'));
        });

        // ==========================================================
        // ROTAS DE DEBUG
        // ==========================================================

        // Debug - Informações do MongoDB
        this.app.get('/api/debug-mongodb', async (req, res) => {
            try {
                const debugInfo = {
                    connection_state: this.getConnectionState(mongoose.connection.readyState),
                    database_name: mongoose.connection.name || 'Não conectado',
                    all_collections: [],
                    product_collections: [],
                    tests: {}
                };

                if (mongoose.connection.readyState === 1) { // Conectado
                    try {
                        const collections = await mongoose.connection.db.listCollections().toArray();
                        debugInfo.all_collections = collections.map(col => col.name);
                        debugInfo.product_collections = collections
                            .filter(col => col.name.toLowerCase().includes('product'))
                            .map(col => col.name);

                        if (debugInfo.product_collections.length > 0) {
                            const totalCount = await Product.countDocuments();
                            const sampleDocs = await Product.find().limit(5).select('id name brand category price stock').lean();
                            const lastDocs = await Product.find().sort({ _id: -1 }).limit(5).select('id name').lean();
                            const sampleDoc = await Product.findOne().lean();
                            const documentFields = sampleDoc ? Object.keys(sampleDoc) : [];
                            
                            const duplicates = await Product.aggregate([
                                { $group: { _id: "$name", count: { $sum: 1 }, ids: { $push: "$id" } } },
                                { $match: { count: { $gt: 1 } } },
                                { $limit: 10 }
                            ]);

                            debugInfo.tests.products = {
                                total_count: totalCount,
                                sample_documents: sampleDocs,
                                last_documents: lastDocs,
                                document_fields: documentFields,
                                duplicates_found: duplicates.length,
                                duplicate_examples: duplicates
                            };
                        }
                    } catch (error) {
                        debugInfo.tests.error = error.message;
                    }
                }

                res.json(debugInfo);
            } catch (error) {
                res.status(500).json({
                    error: 'Erro ao obter informações do MongoDB para debug',
                    details: error.message
                });
            }
        });

        // Debug - Teste do CatalogService
        this.app.get('/api/debug-catalog-service', async (req, res) => {
            try {
                const catalogService = this.app.locals.catalogService;
                
                if (!catalogService) {
                    return res.json({
                        error: 'CatalogService não injetado em app.locals',
                        available_services: Object.keys(this.app.locals)
                    });
                }

                const debugInfo = {
                    catalog_service_info: {
                        is_initialized: catalogService.isInitialized,
                        products_in_memory_count: catalogService.products.length,
                        get_product_count_from_db: await catalogService.getProductCount(),
                        methods_available: Object.getOwnPropertyNames(Object.getPrototypeOf(catalogService)).filter(name => name !== 'constructor'),
                        sample_products_from_memory: catalogService.products.slice(0, 5).map(p => ({
                            id: p.id,
                            name: p.name,
                            category: p.category,
                            fields: Object.keys(p)
                        })),
                        sample_search_results: (await catalogService.searchProducts('filtro')).slice(0,3).map(p => p.name)
                    }
                };
                res.json(debugInfo);
            } catch (error) {
                res.status(500).json({
                    error: 'Erro ao testar CatalogService para debug',
                    details: error.message,
                    stack: error.stack
                });
            }
        });

        // Debug - Produtos completos
        this.app.get('/api/debug-products-full', async (req, res) => {
            try {
                const catalogService = this.app.locals.catalogService;
                if (!catalogService) {
                    return res.status(500).json({ error: 'CatalogService não disponível' });
                }

                const debugInfo = {
                    products_from_catalog_service: {
                        total_in_memory: catalogService.products.length,
                        sample_products: catalogService.products.slice(0, 10).map(p => ({
                            id: p.id,
                            code: p.code,
                            name: p.name,
                            brand: p.brand,
                            category: p.category,
                            price: p.price,
                            stock: p.stock,
                            compatibility_sample: p.compatibility ? p.compatibility.slice(0,2) : [],
                            oem_codes_sample: p.oem_codes ? p.oem_codes.slice(0,2) : [],
                            is_active: p.is_active
                        }))
                    },
                    products_direct_from_mongodb: {
                        total_count: await Product.countDocuments(),
                        sample_products: await Product.find().limit(10).lean().select('id code name brand category price stock compatibility oem_codes is_active'),
                        collection_info: {
                            name: Product.collection.name,
                            indexes: await Product.collection.indexes()
                        }
                    },
                    data_consistency_check: {
                        catalog_memory_vs_db_count_diff: catalogService.products.length - (await Product.countDocuments())
                    }
                };

                res.json(debugInfo);
            } catch (error) {
                console.error('Erro ao obter informações completas dos produtos para debug:', error);
                res.status(500).json({
                    error: 'Erro interno ao obter informações completas dos produtos',
                    details: error.message
                });
            }
        });

        // ==========================================================
        // TRATAMENTO DE ERROS
        // ==========================================================

        // Middleware de erro 404 - Rotas não encontradas
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Rota não encontrada',
                path: req.originalUrl,
                method: req.method,
                available_routes: [
                    'GET /', 'GET /api', 'GET /health',
                    'GET /api/stats', 'GET /api/conversations/recent',
                    'GET /api/analytics/activity', 'GET /api/analytics/categories',
                    'POST /api/test-message', 'GET /test-chat',
                    'GET /control', 'GET /admin',
                    'GET /api/debug-mongodb', 'GET /api/debug-catalog-service', 'GET /api/debug-products-full'
                ]
            });
        });

        // Middleware de tratamento de erros geral
        this.app.use((error, req, res, next) => {
            console.error('Erro na aplicação:', error);
            res.status(500).json({
                error: 'Erro interno do servidor',
                message: error.message,
                timestamp: new Date().toISOString(),
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        });

        console.log('✅ Rotas configuradas');
    }

    // Helper para mapear o estado da conexão do Mongoose
    getConnectionState(state) {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[state] || 'unknown';
    }

    // Métodos para injetar instâncias de serviços no app.locals
    setMessageController(messageController) {
        this.app.locals.messageController = messageController;
        console.log('✅ MessageController configurado em app.locals');
    }

    setCatalogService(catalogService) {
        this.app.locals.catalogService = catalogService;
        console.log('✅ CatalogService configurado em app.locals');
    }

    setWhatsAppService(whatsappService) {
        this.app.locals.whatsappService = whatsappService;
        console.log('✅ WhatsAppService configurado em app.locals');
    }

    setServiceManager(serviceManager) {
        this.app.locals.serviceManager = serviceManager;
        console.log('✅ ServiceManager configurado em app.locals');
    }

    setDbConnection(connection) {
        this.app.locals.dbConnection = connection;
        console.log('✅ Conexão do banco configurada em app.locals');
    }

    // Iniciar servidor HTTP
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server.listen(this.port, () => {
                    console.log(`🚀 Servidor rodando na porta ${this.port}`);
                    console.log(`📊 Dashboard: http://localhost:${this.port}/`);
                    console.log(`🎮 Controle: http://localhost:${this.port}/control`);
                    console.log(`⚙️ Admin: http://localhost:${this.port}/admin`);
                    console.log(`💬 Teste: http://localhost:${this.port}/test-chat`);
                    resolve(this.server);
                });

                this.server.on('error', (error) => {
                    console.error('❌ Erro no servidor HTTP:', error);
                    reject(error);
                });

            } catch (error) {
                console.error('❌ Erro ao iniciar servidor HTTP:', error);
                reject(error);
            }
        });
    }

    // Parar servidor HTTP
    stop() {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) {
                    console.error('❌ Erro ao parar servidor HTTP:', err);
                    return reject(err);
                }
                console.log('🛑 Servidor HTTP parado');
                resolve();
            });
        });
    }

    // Getter para a instância do Express
    getApp() {
        return this.app;
    }
}

module.exports = App;