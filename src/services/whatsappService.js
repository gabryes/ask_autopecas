const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.messageHandler = null; // Função a ser chamada quando uma mensagem é recebida
        this.connectedNumber = null; // Número do bot após conexão
        this.isSimulationMode = false; // Flag para indicar modo de simulação

        // Referência ao MessageController, será setada via método
        this.messageController = null; 

        console.log('📱 Iniciando WhatsApp Web Service');
    }

    /**
     * Seta o MessageController para que o WhatsAppService possa chamar seu método handleMessage.
     * @param {object} controller Instância do MessageController.
     */
    setMessageController(controller) {
        this.messageController = controller;
        console.log('✅ MessageController injetado no WhatsAppService.');
        // Agora o 'message' event listener pode usar this.messageController
    }

    async initialize() {
        console.log('🔄 Tentando inicializar WhatsApp Web...');

        // --- Lógica de limpeza para evitar conflitos de sessão ---
        if (this.client) {
            console.log('🧹 Detectada uma instância anterior do WhatsApp Client. Tentando encerrá-la...');
            try {
                await this.client.destroy();
                console.log('✅ Instância anterior encerrada com sucesso.');
            } catch (err) {
                console.warn('⚠️ Erro ao tentar encerrar instância anterior:', err.message);
            } finally {
                this.client = null;
                this.isConnected = false;
            }
        }
        // --- Fim da lógica de limpeza ---

        try {
            console.log('🔄 Conectando ao WhatsApp Web...');

            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'chatbot-autopecas-v3', // Usar clientId ao invés de name para LocalAuth
                    dataPath: './wwebjs_auth_v3' // Caminho para armazenar os dados da sessão
                }),
                puppeteer: {
                    headless: true, // Mantenha como 'true' para execução em servidor
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--single-process' // Adicionado para evitar problemas em ambientes com poucos recursos
                    ]
                },
                webVersionCache: {
                    type: 'remote', // Tenta buscar a versão mais recente remotamente
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51.html', // Caminho alternativo para a versão web
                }
            });

            // Eventos do cliente WhatsApp
            this.client.on('qr', (qr) => {
                console.log('\n📱 ESCANEIE O QR CODE COM SEU WHATSAPP:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n📋 Abra o WhatsApp no seu celular > Menu > Aparelhos Conectados > Conectar um aparelho\n');
                console.log('⏰ QR Code expira em 20 segundos. Se não conseguir, reinicie o servidor.');
            });

            this.client.on('authenticated', () => {
                console.log('\n📳 Autenticado! Aguardando conexão completa...');
            });

            this.client.on('ready', async () => {
                console.log('\n🎉 ===== CONEXÃO WHATSAPP ESTABELECIDA =====');
                console.log('✅ WhatsApp conectado e FUNCIONANDO!');
                this.isConnected = true;
                this.isSimulationMode = false;

                // Tentar descobrir o número do bot
                await this.forceNumberDiscovery();
                console.log(`📱 Bot está pronto para receber mensagens em ${this.connectedNumber || 'um número não descoberto ainda'}`);
                console.log('===================================\n');
                this.showTestInstructions();
            });

            this.client.on('loading_screen', (percent, message) => {
                console.log(`⏳ Carregando WhatsApp: ${percent}% - ${message}`);
            });

            this.client.on('message', async (message) => {
                try {
                    // Tentar descobrir o número do bot na primeira mensagem recebida
                    if (!this.connectedNumber && message.to) {
                        const botNumber = message.to.replace('@c.us', '');
                        console.log(`\n🎯 ===== NÚMERO DO BOT DESCOBERTO =====\n📞 Seu bot está no número: ${botNumber}`);
                        this.connectedNumber = botNumber;
                    }

                    // Ignorar mensagens de grupos, suas próprias mensagens ou status
                    if (message.from.includes('@g.us') || message.fromMe || message.from === 'status@broadcast') {
                        return;
                    }

                    console.log(`\n📨 ===== NOVA MENSAGEM RECEBIDA =====`);
                    console.log(`👤 De: ${message.from.replace('@c.us', '')}`);
                    console.log(`💬 Mensagem: "${message.body}"`);
                    console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}`);
                    console.log(`====================================\n`);

                    // Chamar o MessageController para lidar com a mensagem
                    if (this.messageController) {
                        await this.messageController.handleMessage(message, this); // Passa a si mesmo como whatsappService
                    } else {
                        console.warn('⚠️ MessageController não configurado no WhatsAppService. Mensagem não processada.');
                        await this.sendMessage(message.from, "Desculpe, o bot está em manutenção. Tente mais tarde.");
                    }
                } catch (error) {
                    console.error('❌ Erro ao processar mensagem recebida:', error);
                    await this.sendMessage(message.from, "Ops! Ocorreu um erro interno ao processar sua mensagem. Por favor, tente novamente.");
                }
            });

            this.client.on('auth_failure', (msg) => {
                console.error('❌ Falha na autenticação WhatsApp:', msg);
                console.log('💡 Tente remover a pasta `wwebjs_auth_v3` e reiniciar para forçar um novo QR Code.');
                this.isConnected = false;
                this.setupSimulationMode(); // Volta para o modo simulação em caso de falha de autenticação
            });

            this.client.on('disconnected', (reason) => {
                console.log('📴 WhatsApp desconectado:', reason);
                this.isConnected = false;
                this.connectedNumber = null;
                // Tentar reiniciar em modo simulação ou reconectar
                console.log('🔄 Tentando entrar em modo de simulação após desconexão.');
                this.setupSimulationMode();
            });

            await this.client.initialize();
            return this;

        } catch (error) {
            console.error('❌ Erro fatal ao inicializar WhatsApp:', error);
            if (this.client) {
                try {
                    await this.client.destroy();
                    console.log('🧹 Cliente WhatsApp destruído após erro na inicialização.');
                } catch (destroyErr) {
                    console.error('❌ Erro ao tentar destruir cliente após falha na inicialização:', destroyErr.message);
                }
            }
            console.log('🌐 WhatsApp real falhou, configurando modo simulação.');
            this.setupSimulationMode();
            return this;
        }
    }

    /**
     * Tenta descobrir o número do bot após a conexão.
     */
    async forceNumberDiscovery() {
        try {
            const info = await this.client.info;
            if (info && info.wid && info.wid.user) {
                this.connectedNumber = info.wid.user;
                console.log(`📞 NÚMERO DO BOT: ${this.connectedNumber}`);
            } else {
                console.log('⚠️ Não foi possível descobrir o número do bot pela API.');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao forçar descoberta de número:', error.message);
        }
    }

    /**
     * Configura o serviço para operar em modo de simulação (sem conexão real com o WhatsApp).
     */
    setupSimulationMode() {
        this.isSimulationMode = true;
        this.isConnected = true; // No modo simulação, consideramos "conectado"
        this.connectedNumber = '5511999999999'; // Número de simulação
        console.log('🤖 WhatsAppService configurado para modo SIMULAÇÃO.');
        this.showTestInstructions();

        // Enviar uma mensagem simulada após um delay
        setTimeout(() => {
            if (this.messageController && this.isSimulationMode) { // Garante que está no modo simulação e o controller está pronto
                console.log('\n🔔 ===== MENSAGEM SIMULADA ENVIADA =====');
                const simulatedMessage = {
                    from: '5511888888888@c.us', // Número de um usuário simulado
                    to: `${this.connectedNumber}@c.us`,
                    body: 'Olá, preciso de um filtro de ar para Ford Ka 2012',
                    timestamp: Date.now(),
                    id: 'simulated_msg_' + Date.now(),
                    fromMe: false, // Mensagem de outro usuário
                    hasMedia: false
                };
                console.log(`Simulado: De ${simulatedMessage.from} para ${simulatedMessage.to} - "${simulatedMessage.body}"`);
                this.messageController.handleMessage(simulatedMessage, this);
            }
        }, 15000); // Envia mensagem simulada 15 segundos após entrar em modo simulação
    }

    /**
     * Exibe instruções de teste no console.
     */
    showTestInstructions() {
        console.log('\n🎯 ===== COMO TESTAR O CHATBOT =====');
        console.log(`📞 Número do Bot: ${this.connectedNumber || 'Aguardando descoberta...'}`);
        console.log('\n📱 Opções para testar:');
        console.log('1. 💬 Envie mensagem para o número do bot acima (se conectado ao WhatsApp real).');
        console.log('2. 🌐 Acesse o painel de teste: http://localhost:3000/test-chat');
        if (this.isSimulationMode) {
            console.log('3. 🔔 Uma mensagem simulada será enviada em breve (se o modo simulação estiver ativo).');
        }
        console.log('===================================\n');
    }

    /**
     * Envia uma mensagem para um chat específico.
     * @param {string} chatId ID do chat (ex: 5511999999999@c.us).
     * @param {string} message Conteúdo da mensagem.
     * @returns {Promise<boolean>} True se a mensagem foi enviada com sucesso, False caso contrário.
     */
    async sendMessage(chatId, message) {
        if (!this.isConnected) {
            console.log('⚠️ WhatsApp não conectado ou em modo simulação. Simulando envio...');
            console.log(`📤 RESPOSTA SIMULADA para ${chatId}:`);
            console.log(`💬 ${message}`);
            return true;
        }
        try {
            await this.client.sendMessage(chatId, message);
            console.log(`✅ Mensagem enviada para ${chatId}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            return false;
        }
    }

    /**
     * Envia um catálogo de produtos para o chat.
     * @param {string} chatId ID do chat.
     * @param {Array<object>} products Lista de produtos.
     * @returns {Promise<boolean>} True se o catálogo foi enviado, False caso contrário.
     */
    async sendCatalog(chatId, products) {
        const catalogMessage = this.formatCatalogMessage(products);
        return await this.sendMessage(chatId, catalogMessage);
    }

    /**
     * Formata uma lista de produtos em uma mensagem de catálogo.
     * @param {Array<object>} products Lista de produtos.
     * @returns {string} Mensagem formatada do catálogo.
     */
    formatCatalogMessage(products) {
        if (!products || products.length === 0) {
            return "❌ *NENHUMA PEÇA ENCONTRADA*\n\nTente uma busca mais específica ou entre em contato conosco!";
        }

        let message = "🛒 *CATÁLOGO DE PEÇAS ENCONTRADAS*\n\n";

        products.slice(0, 5).forEach((product, index) => { // Limita a 5 produtos para não sobrecarregar
            message += `${index + 1}️⃣ *${product.name}*\n`;
            message += `📦 Código: ${product.code || 'N/A'}\n`;
            message += `💰 Preço: R$ ${product.price ? product.price.toFixed(2) : 'N/A'}\n`;
            message += `📊 Estoque: ${product.stock !== undefined ? product.stock + ' unidades' : 'N/A'}\n`;
            message += `🚗 Compatível: ${product.compatibility && product.compatibility.length > 0 ? product.compatibility.join(', ') : 'Verificar'}\n`;
            message += `_Marca: ${product.brand || 'N/A'}, Categoria: ${product.category || 'N/A'}_\n\n`;
        });

        if (products.length > 5) {
            message += `➕ *E mais ${products.length - 5} produtos disponíveis!* Digite mais detalhes para refinar a busca.\n\n`;
        }

        message += "📞 *Entre em contato para mais informações!*";
        return message;
    }

    /**
     * Simula o recebimento de uma mensagem para fins de teste.
     * @param {string} messageText O texto da mensagem simulada.
     * @param {string} fromNumber O número de telefone de origem simulado.
     * @returns {boolean} True se a mensagem simulada foi processada, False caso contrário.
     */
    simulateMessage(messageText, fromNumber) {
        if (this.messageController) {
            console.log('\n🔔 ===== MENSAGEM SIMULADA (TESTE EXTERNO) =====');
            const simulatedMessage = {
                from: `${fromNumber}@c.us`,
                to: `${this.connectedNumber}@c.us`,
                body: messageText,
                timestamp: Date.now(),
                id: 'test_ext_' + Date.now(),
                fromMe: false,
                hasMedia: false
            };
            this.messageController.handleMessage(simulatedMessage, this);
            return true;
        }
        return false;
    }

    /**
     * Verifica se o WhatsApp está pronto (conectado ou em modo simulação).
     * @returns {boolean} True se pronto, False caso contrário.
     */
    isReady() {
        return this.isConnected;
    }

    /**
     * Retorna o número de telefone do bot conectado.
     * @returns {string|null} O número de telefone ou null se não descoberto.
     */
    getConnectedNumber() {
        return this.connectedNumber;
    }

    /**
     * Destrói a instância do cliente WhatsApp Web.
     * @returns {Promise<void>}
     */
    async destroy() {
        if (this.client && typeof this.client.destroy === 'function') {
            console.log('🧹 Encerrando WhatsApp Web client...');
            try {
                await this.client.destroy();
                this.client = null;
                this.isConnected = false;
                this.connectedNumber = null;
                this.isSimulationMode = false; // Garante que o modo simulação seja desativado
                console.log('✅ WhatsApp Web client encerrado com sucesso.');
            } catch (error) {
                console.error('❌ Erro ao encerrar WhatsApp Web client:', error);
            }
        }
    }
}

module.exports = WhatsAppService;