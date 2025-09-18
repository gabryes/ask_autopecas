// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar serviços
const { connectDatabase } = require('./config/database');
const WhatsAppService = require('./services/whatsappService');
const adminRoutes = require('./routes/admin');
const AIService = require('./services/aiService');
const ServiceManager = require('./services/serviceManager');
const CatalogService = require('./services/catalogService'); // Importa o novo CatalogService
const MessageController = require('./controllers/messageController');

class ChatbotApp {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Serviços
        this.whatsappService = null;
        this.aiService = null;
        this.catalogService = null;
        this.messageController = null;
        this.serviceManager = null;
        
        console.log('�� Iniciando serviços...');
    }

    async initialize() {
        try {
            // Configurar Express
            this.setupExpress();
            
            // Inicializar serviços
            await this.initializeServices(); // Esta linha chama initializeServices
            
            // REMOVA QUALQUER LINHA QUE CHAME this.catalogService.loadCatalog() AQUI
            // Por exemplo, se você tinha algo como:
            // await this.catalogService.loadCatalog(); // <--- REMOVA ESTA LINHA SE EXISTIR

            // Configurar rotas
            this.setupRoutes();
            
            // Iniciar servidor
            this.startServer();
            
            console.log('🎉 Todos os serviços inicializados com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar aplicação:', error);
            process.exit(1);
        }
    }

    async initializeServices() {
        try {
            // 1. Conectar ao banco de dados
            await connectDatabase();
            
            // 2. Inicializar AI Service
            this.aiService = new AIService();
            
            // 3. Inicializar Catalog Service
            this.catalogService = new CatalogService(); // Instancia o novo CatalogService
            // REMOVA QUALQUER LINHA QUE CHAME this.catalogService.loadCatalog() AQUI TAMBÉM
            // O novo CatalogService não precisa ser "carregado", ele busca do DB sob demanda.

            // 4. Inicializar Message Controller
            this.messageController = new MessageController(this.aiService, this.catalogService);
            console.log('✅ MessageController inicializado');
            
            // 5. Inicializar WhatsApp Service
            this.whatsappService = new WhatsAppService();
            
            // 6. Configurar handler de mensagens COM BIND CORRETO
            this.whatsappService.onMessage(async (message) => {
                try {
                    console.log('🔄 Processando mensagem via handler...');
                    await this.messageController.handleMessage(message, this.whatsappService);
                } catch (error) {
                    console.error('❌ Erro no handler de mensagem:', error);
                }
            });
            
            // 7. Conectar ao WhatsApp
            await this.whatsappService.initialize();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar serviços:', error);
            throw error;
        }
    }

    setupExpress() {
        // Middlewares
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Servir arquivos estáticos
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        // Health Check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Chatbot AutoPeças',
                version: '1.0.0',
                uptime: process.uptime(),
                whatsapp_connected: this.whatsappService?.isReady() || false,
                whatsapp_number: this.whatsappService?.getConnectedNumber() || null,
                timestamp: new Date().toISOString()
            });
        });

        // Rotas administrativas
        this.app.use('/api/admin', adminRoutes);

        // Rota para o painel admin
        this.app.get('/admin', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/admin.html'));
        });

        // Stats
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = {
                    service: 'Chatbot AutoPeças',
                    uptime: process.uptime(),
                    whatsapp: {
                        connected: this.whatsappService?.isReady() || false,
                        number: this.whatsappService?.getConnectedNumber() || null,
                        number_discovered: this.whatsappService?.isNumberDiscovered() || false
                    },
                    catalog: {
                        // Agora o CatalogService vai buscar a contagem no DB
                        total_products: await this.catalogService?.getProductCount() || 0 
                    },
                    ai: {
                        mode: 'simulation' // Ou 'real' se você ativar a OpenAI
                    },
                    timestamp: new Date().toISOString()
                };
                
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // ROTA PARA TESTE DE MENSAGEM
        this.app.post('/api/test-message', (req, res) => {
            try {
                const { message, from } = req.body;
                const testMessage = message || "Preciso de pastilha de freio para Civic 2015";
                const fromNumber = from || "5511999999999";
                
                if (this.whatsappService?.isReady()) {
                    const success = this.whatsappService.simulateMessage(testMessage, fromNumber);
                    
                    if (success) {
                        res.json({ 
                            success: true, 
                            message: "Mensagem simulada enviada com sucesso!",
                            test_message: testMessage,
                            from_number: fromNumber,
                            bot_number: this.whatsappService.getConnectedNumber()
                        });
                    } else {
                        res.status(500).json({ 
                            success: false, 
                            message: "Erro ao simular mensagem" 
                        });
                    }
                } else {
                    res.status(503).json({ 
                        success: false, 
                        message: "WhatsApp não está conectado" 
                    });
                }
            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    message: error.message 
                });
            }
        });


        // Rota para o painel de controle
        this.app.get('/control', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/control-panel.html'));
        });

        // API para controle de serviços
        this.app.post('/api/control/start', async (req, res) => {
            try {
                if (!this.serviceManager) {
                    this.serviceManager = new ServiceManager();
                }
                
                const result = await this.serviceManager.startAllServices();
                res.json({ success: result, message: 'Serviços iniciados' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/control/stop', async (req, res) => {
            try {
                if (this.serviceManager) {
                    const result = await this.serviceManager.stopAllServices();
                    res.json({ success: result, message: 'Serviços parados' });
                } else {
                    res.json({ success: true, message: 'Serviços já estavam parados' });
                }
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/api/control/status', async (req, res) => {
            try {
                if (this.serviceManager) {
                    const status = this.serviceManager.getServicesStatus();
                    res.json(status);
                } else {
                    res.json({ services: {}, system: {} });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/control/logs', async (req, res) => {
            try {
                if (this.serviceManager) {
                    const logs = this.serviceManager.getLogs();
                    res.json(logs);
                } else {
                    res.json([]);
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        // PÁGINA DE TESTE SIMPLES
        this.app.get('/test-chat', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Teste do Chatbot</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .container { background: #f8f9fa; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h1 { color: #333; text-align: center; }
                        .status { padding: 15px; margin: 20px 0; border-radius: 5px; text-align: center; font-weight: bold; }
                        .connected { background: #d4edda; color: #155724; }
                        .disconnected { background: #f8d7da; color: #721c24; }
                        .form-group { margin: 20px 0; }
                        label { display: block; margin-bottom: 8px; font-weight: bold; color: #555; }
                        textarea { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px; }
                        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin-top: 10px; }
                        button:hover { background: #0056b3; }
                        .suggestions { margin: 15px 0; }
                        .suggestion { display: inline-block; margin: 5px; padding: 8px 15px; background: #e9ecef; border-radius: 20px; cursor: pointer; font-size: 13px; }
                        .suggestion:hover { background: #dee2e6; }
                        .response { margin-top: 20px; padding: 15px; background: white; border-radius: 5px; border-left: 4px solid #28a745; }
                        .error { border-left-color: #dc3545; background: #f8d7da; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🤖 Ask Autopeças</h1>
                        
                        <div id="status" class="status">
                            <strong>Status:</strong> Verificando conexão...
                        </div>
                        
                        <div class="form-group">
                            <label for="message">💬 Mensagem para o Bot:</label>
                            <textarea id="message" rows="3" placeholder="Digite sua mensagem aqui..."></textarea>
                        </div>
                        
                        <div class="suggestions">
                            <strong>💡 Sugestões rápidas:</strong><br><br>
                            <span class="suggestion" onclick="setMessage('Oi, preciso de pastilha de freio para Civic 2015')">🔧 Pastilha de freio</span>
                            <span class="suggestion" onclick="setMessage('Quero filtro de óleo para Corolla 2018')">🛢️ Filtro de óleo</span>
                            <span class="suggestion" onclick="setMessage('Tem amortecedor para Gol G6?')">🚗 Amortecedor</span>
                            <span class="suggestion" onclick="setMessage('Catálogo')">📋 Catálogo</span>
                            <span class="suggestion" onclick="setMessage('Ajuda')">❓ Ajuda</span>
                        </div>
                        
                        <button onclick="sendMessage()">📤 Enviar Mensagem de Teste</button>
                        
                        <div id="response"></div>
                    </div>

                    <script>
                        // Verificar status na inicialização
                        checkStatus();
                        
                        function setMessage(text) {
                            document.getElementById('message').value = text;
                        }
                        
                        async function checkStatus() {
                            try {
                                const response = await fetch('/health');
                                const data = await response.json();
                                
                                const statusDiv = document.getElementById('status');
                                if (data.whatsapp_connected) {
                                    statusDiv.className = 'status connected';
                                    statusDiv.innerHTML = '✅ <strong>WhatsApp Conectado!</strong><br>Número: ' + (data.whatsapp_number || 'Descobrindo...');
                                } else {
                                    statusDiv.className = 'status disconnected';
                                    statusDiv.innerHTML = '❌ <strong>WhatsApp Desconectado</strong><br>Verifique o terminal para conectar';
                                }
                            } catch (error) {
                                const statusDiv = document.getElementById('status');
                                statusDiv.className = 'status disconnected';
                                statusDiv.innerHTML = '❌ <strong>Erro ao verificar status</strong>';
                            }
                        }
                        
                        async function sendMessage() {
                            const message = document.getElementById('message').value.trim();
                            if (!message) {
                                alert('Digite uma mensagem primeiro!');
                                return;
                            }
                            
                            const responseDiv = document.getElementById('response');
                            responseDiv.innerHTML = '<div class="response">⏳ Enviando mensagem...</div>';
                            
                            try {
                                const response = await fetch('/api/test-message', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ message })
                                });
                                
                                const data = await response.json();
                                
                                if (data.success) {
                                    responseDiv.innerHTML = '<div class="response">✅ <strong>Mensagem enviada com sucesso!</strong><br><br>📤 <strong>Enviado:</strong> ' + data.test_message + '<br>📞 <strong>Para o bot:</strong> ' + data.bot_number + '<br><br>�� <strong>Verifique o terminal</strong> para ver a resposta do chatbot!</div>';
                                } else {
                                    responseDiv.innerHTML = '<div class="response error">❌ <strong>Erro:</strong> ' + data.message + '</div>';
                                }
                            } catch (error) {
                                responseDiv.innerHTML = '<div class="response error">❌ <strong>Erro de conexão:</strong> ' + error.message + '</div>';
                            }
                        }
                        
                        // Atualizar status a cada 10 segundos
                        setInterval(checkStatus, 10000);
                    </script>
                </body>
                </html>
            `);
        });

                // Adicionar no setupRoutes()
        this.app.get('/api/debug-products', async (req, res) => {
            try {
                await this.catalogService.debugProductStructure();
                const products = await this.catalogService.getAllProducts();
                res.json({
                    total_products: products.length,
                    sample_product: products[0] || null,
                    available_fields: products[0] ? Object.keys(products[0].toObject()) : []
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Rota padrão
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Chatbot AutoPeças API',
                version: '1.0.0',
                endpoints: {
                    health: '/health',
                    stats: '/api/stats',
                    test_message: 'POST /api/test-message',
                    test_page: '/test-chat'
                }
            });
        });
    }

    startServer() {
        this.app.listen(this.port, () => {
            console.log(`🚀 Servidor rodando na porta ${this.port}`);
            console.log(`🔍 Health Check: http://localhost:${this.port}/health`);
            console.log(`�� Stats: http://localhost:${this.port}/api/stats`);
            console.log(`🧪 Teste: http://localhost:${this.port}/test-chat`);
        });
    }
}

// Inicializar aplicação
const app = new ChatbotApp();
app.initialize().catch(error => {
    console.error('❌ Falha crítica na inicialização:', error);
    process.exit(1);
});
