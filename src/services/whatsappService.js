const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.messageHandler = null;
        this.numberDiscovered = false;
        this.connectedNumber = null;
        console.log('📱 Iniciando WhatsApp Web Service');
    }

    async initialize() {
        try {
            console.log('🔄 Conectando ao WhatsApp Web...');
            
            this.client = new Client({
                authStrategy: new LocalAuth({
                    name: 'chatbot-autopecas-v3',
                    dataPath: './wwebjs_auth_v3'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                },
                webVersionCache: {
                    type: 'none'
                }
            });

            // QR Code para conectar
            this.client.on('qr', (qr) => {
                console.log('\\n📱 ESCANEIE O QR CODE COM SEU WHATSAPP:\\n');
                qrcode.generate(qr, { small: true });
                console.log('\\n📋 Abra o WhatsApp no seu celular > Menu > Dispositivos conectados > Conectar dispositivo\\n');
                console.log('⏰ QR Code expira em 20 segundos. Se não conseguir, reinicie o servidor.\\n');
            });

            // Quando autenticar
            this.client.on('authenticated', () => {
                console.log('\\n🔐 ===== AUTENTICAÇÃO REALIZADA =====');
                console.log('✅ WhatsApp autenticado com sucesso!');
                console.log('⏳ Aguardando conexão completa...');
                console.log('=====================================\\n');
            });

            // Quando conectar
            this.client.on('ready', async () => {
                console.log('\\n🎉 ===== CONEXÃO ESTABELECIDA =====');
                console.log('✅ WhatsApp conectado e FUNCIONANDO!');
                console.log('📱 Bot está pronto para receber mensagens');
                
                this.isConnected = true;
                console.log('🔧 Status interno: CONECTADO');
                
                // Descobrir número
                await this.forceNumberDiscovery();
                
                console.log('===================================\\n');
                
                // Mostrar instruções de teste
                this.showTestInstructions();
            });

            // Quando receber mensagem - USANDO ARROW FUNCTION PARA MANTER CONTEXTO
            this.client.on('message', async (message) => {
                try {
                    // Auto-descoberta do número
                    if (!this.numberDiscovered && message.to) {
                        const botNumber = message.to.replace('@c.us', '');
                        console.log('\\n🎯 ===== NÚMERO DESCOBERTO VIA MENSAGEM =====');
                        console.log(`📞 SEU BOT ESTÁ NO NÚMERO: ${botNumber}`);
                        console.log('🎉 Agora você sabe qual número compartilhar!');
                        console.log('=============================================\\n');
                        
                        this.connectedNumber = botNumber;
                        this.numberDiscovered = true;
                    }
                    
                    // Filtros
                    if (message.from.includes('@g.us') || message.fromMe || message.from === 'status@broadcast') {
                        return;
                    }

                    console.log(`\\n📨 ===== NOVA MENSAGEM RECEBIDA =====`);
                    console.log(`👤 De: ${message.from.replace('@c.us', '')}`);
                    console.log(`📞 Para: ${message.to.replace('@c.us', '')} (SEU BOT)`);
                    console.log(`💬 Mensagem: "${message.body}"`);
                    console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}`);
                    console.log(`====================================\\n`);
                    
                    // CHAMAR O HANDLER COM VERIFICAÇÃO
                    if (this.messageHandler && typeof this.messageHandler === 'function') {
                        console.log('🔄 Chamando messageHandler...');
                        await this.messageHandler(message);
                    } else {
                        console.log('⚠️ MessageHandler não está configurado ou não é uma função');
                    }
                } catch (error) {
                    console.error('❌ Erro ao processar mensagem:', error);
                }
            });

            // Tratamento de desconexão
            this.client.on('disconnected', (reason) => {
                console.log('\\n❌ WhatsApp desconectado:', reason);
                this.isConnected = false;
                this.numberDiscovered = false;
                this.connectedNumber = null;
                
                setTimeout(() => {
                    console.log('🔄 Tentando reconectar...');
                    this.initialize();
                }, 5000);
            });

            // Falha na autenticação
            this.client.on('auth_failure', (msg) => {
                console.error('❌ Falha na autenticação WhatsApp:', msg);
                console.log('💡 Dica: Delete a pasta wwebjs_auth_v3 e tente novamente');
            });

            // Loading
            this.client.on('loading_screen', (percent, message) => {
                console.log(`⏳ Carregando WhatsApp: ${percent}% - ${message}`);
            });

            await this.client.initialize();
            return this;

        } catch (error) {
            console.error('❌ Erro ao inicializar WhatsApp:', error);
            console.log('🔄 Voltando para modo simulação...');
            return this.initializeMockMode();
        }
    }

    async forceNumberDiscovery() {
        try {
            console.log('🔍 Tentando descobrir número conectado...');
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (this.client.info?.wid?.user) {
                const number = this.client.info.wid.user;
                console.log(`📞 NÚMERO ENCONTRADO: ${number}`);
                console.log(`👤 Nome: ${this.client.info.pushname || 'Não definido'}`);
                this.connectedNumber = number;
                this.numberDiscovered = true;
                return;
            }
            
            try {
                const contacts = await this.client.getContacts();
                const myContact = contacts.find(contact => contact.isMe);
                if (myContact) {
                    const number = myContact.id.user;
                    console.log(`📞 NÚMERO ENCONTRADO (via contatos): ${number}`);
                    this.connectedNumber = number;
                    this.numberDiscovered = true;
                    return;
                }
            } catch (e) {
                console.log('⚠️ Não foi possível buscar contatos');
            }
            
            console.log('💡 Número será descoberto quando chegar a primeira mensagem');
            
        } catch (error) {
            console.log('⚠️ Erro ao descobrir número:', error.message);
        }
    }

    showTestInstructions() {
        console.log('\\n🎯 ===== COMO TESTAR O CHATBOT =====');
        console.log(`📞 Número do Bot: ${this.connectedNumber || 'Será descoberto na primeira mensagem'}`);
        console.log('\\n📱 Opções para testar:');
        console.log('1. 🌐 WhatsApp Web: web.whatsapp.com (com outro celular)');
        console.log('2. 👥 Peça para alguém enviar mensagem');
        console.log('3. 🧪 Use a API de teste: POST /api/test-message');
        console.log('4. 💻 Acesse: http://localhost:3000/test-chat');
        console.log('\\n💬 Mensagens de teste sugeridas:');
        console.log('   • "Oi, preciso de pastilha de freio para Civic 2015"');
        console.log('   • "Quero filtro de óleo para Corolla 2018"');
        console.log('   • "Catálogo"');
        console.log('   • "Ajuda"');
        console.log('=====================================\\n');
    }

    async initializeMockMode() {
        console.log('\\n🤖 ===== MODO SIMULAÇÃO ATIVADO =====');
        console.log('⚠️ WhatsApp real falhou, usando simulação');
        console.log('💡 Para testar: aguarde mensagem simulada');
        console.log('===================================\\n');
        
        this.isConnected = true;
        this.connectedNumber = '5511999999999'; // Número simulado
        this.numberDiscovered = true;
        
        // Mostrar instruções mesmo em modo simulação
        this.showTestInstructions();
        
        setTimeout(() => {
            if (this.messageHandler && typeof this.messageHandler === 'function') {
                console.log('\\n🔔 ===== MENSAGEM SIMULADA =====');
                this.messageHandler({
                    from: '5511888888888@c.us',
                    to: `${this.connectedNumber}@c.us`,
                    body: 'Oi, preciso de pastilha de freio para Civic 2015',
                    timestamp: Date.now(),
                    id: 'sim_' + Date.now(),
                    fromMe: false
                });
            }
        }, 10000);
        
        return this;
    }

    async sendCatalog(chatId, products) {
        const catalogMessage = this.formatCatalogMessage(products);
        return await this.sendMessage(chatId, catalogMessage);
    }

    formatCatalogMessage(products) {
        if (!products || products.length === 0) {
            return "❌ Nenhum produto encontrado para sua busca.";
        }

        let message = "🔧 *CATÁLOGO DE PEÇAS ENCONTRADAS*\n\n";
        
        products.slice(0, 5).forEach((product, index) => {
            message += `${index + 1}️⃣ *${product.name}*\n`;
            message += `📦 Código: ${product.code}\n`;
            message += `🚗 Compatível: ${product.compatibility.join(', ')}\n`;
            message += `💰 Preço: R$ ${product.price.toFixed(2)}\n`;
            message += `📊 Estoque: ${product.stock} unidades\n`;
            message += `⭐ Marca: ${product.brand}\n\n`;
        });

        if (products.length > 5) {
            message += `📋 *E mais ${products.length - 5} produtos...*\n\n`;
        }

        message += "📱 *Digite o número da peça desejada para mais detalhes*";
        return message;
    }

    // MÉTODO PARA TESTE - Simular mensagem
    simulateMessage(messageText = "Preciso de pastilha de freio para Civic 2015", fromNumber = "5511999999999") {
        console.log('\\n🔔 ===== MENSAGEM SIMULADA PARA TESTE =====');
        console.log(`👤 Simulando mensagem de: ${fromNumber}`);
        console.log(`💬 Mensagem: "${messageText}"`);
        console.log('=========================================\\n');
        
        if (this.messageHandler && typeof this.messageHandler === 'function') {
            try {
                this.messageHandler({
                    from: `${fromNumber}@c.us`,
                    to: `${this.connectedNumber}@c.us`,
                    body: messageText,
                    timestamp: Date.now(),
                    id: 'test_' + Date.now(),
                    fromMe: false
                });
                return true;
            } catch (error) {
                console.error('❌ Erro ao executar messageHandler:', error);
                return false;
            }
        } else {
            console.log('⚠️ MessageHandler não está configurado');
            return false;
        }
    }

    // CONFIGURAR O HANDLER COM VERIFICAÇÃO
    onMessage(handler) {
        if (typeof handler === 'function') {
            this.messageHandler = handler;
            console.log('✅ Message handler configurado com sucesso');
        } else {
            console.error('❌ Handler deve ser uma função');
        }
    }

    async sendMessage(chatId, message, options = {}) {
        try {
            if (!this.isConnected) {
                console.log('\\n📤 ===== RESPOSTA SIMULADA =====');
                console.log(`👤 Para: ${chatId.replace('@c.us', '')}`);
                console.log(`🤖 Resposta:\\n${message}`);
                console.log('===============================\\n');
                return { success: true, simulated: true };
            }

            await this.client.sendMessage(chatId, message);
            console.log(`\\n📤 ===== RESPOSTA ENVIADA =====`);
            console.log(`👤 Para: ${chatId.replace('@c.us', '')}`);
            console.log(`🤖 Resposta:\\n${message}`);
            console.log('==============================\\n');
            return { success: true };

        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            
            // Fallback para log
            console.log(`\\n📤 ===== RESPOSTA DO BOT (FALLBACK) =====`);
            console.log(`👤 Para: ${chatId.replace('@c.us', '')}`);
            console.log(`🤖 Resposta:\\n${message}`);
            console.log('===============================\\n');
            return { success: false, error: error.message };
        }
    }

    getConnectedNumber() {
        return this.connectedNumber;
    }

    isNumberDiscovered() {
        return this.numberDiscovered;
    }

    getClient() {
        return this.client;
    }

    isReady() {
        return this.isConnected;
    }

    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isConnected = false;
            this.numberDiscovered = false;
            this.connectedNumber = null;
            console.log('📱 WhatsApp desconectado');
        }
    }
}

module.exports = WhatsAppService;