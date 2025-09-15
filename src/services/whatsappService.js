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
                console.log('\n📱 ESCANEIE O QR CODE COM SEU WHATSAPP:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n📋 Abra o WhatsApp no seu celular > Menu > Dispositivos conectados > Conectar dispositivo\n');       
                console.log('⏰ QR Code expira em 20 segundos. Se não conseguir, reinicie o servidor.\n');
            });

            // Quando autenticar
            this.client.on('authenticated', () => {
                console.log('\n📳 Aguardando conexão completa...');
                console.log('=====================================\n');
            });

            // Quando conectar
            this.client.on('ready', async () => {
                console.log('\n🎉 ===== CONEXÃO ESTABELECIDA =====');
                console.log('✅ WhatsApp conectado e FUNCIONANDO!');
                console.log('📱 Bot está pronto para receber mensagens');

                this.isConnected = true;
                console.log('🔧 Status interno: CONECTADO');

                // Descobrir número
                await this.forceNumberDiscovery();

                console.log('===================================\n');

                // Mostrar instruções de teste
                this.showTestInstructions();
            });

            // Loading
            this.client.on('loading_screen', (percent, message) => {
                console.log(`⏳ Carregando WhatsApp: ${percent}% - ${message}`);
            });

            // Quando receber mensagem
            this.client.on('message', async (message) => {
                try {
                    // Auto-descoberta do número
                    if (!this.numberDiscovered && message.to) {
                        const botNumber = message.to.replace('@c.us', '');
                        console.log('\n🎯 ===== NÚMERO DESCOBERTO VIA MENSAGEM =====');
                        console.log(`📞 SEU BOT ESTÁ NO NÚMERO: ${botNumber}`);
                        console.log('🎉 Agora você sabe qual número compartilhar!');
                        console.log('=============================================\n');

                        this.connectedNumber = botNumber;
                        this.numberDiscovered = true;
                    }

                    // Filtros
                    if (message.from.includes('@g.us') || message.fromMe || message.from === 'status@broadcast') {
                        return;
                    }

                    console.log(`\n📨 ===== NOVA MENSAGEM RECEBIDA =====`);
                    console.log(`👤 De: ${message.from.replace('@c.us', '')}`);
                    console.log(`📞 Para: ${message.to.replace('@c.us', '')} (SEU BOT)`);
                    console.log(`💬 Mensagem: "${message.body}"`);
                    console.log(`⏰ Horário: ${new Date().toLocaleString('pt-BR')}`);
                    console.log(`====================================\n`);

                    // CHAMAR O HANDLER
                    if (this.messageHandler && typeof this.messageHandler === 'function') {
                        console.log('🔄 Chamando messageHandler...');
                        await this.messageHandler(message);
                    } else {
                        console.log('⚠️ MessageHandler não está configurado');
                    }
                } catch (error) {
                    console.error('❌ Erro ao processar mensagem:', error);
                }
            });

            // Erro de autenticação
            this.client.on('auth_failure', () => {
                console.error('❌ Falha na autenticação WhatsApp');
                console.log('💡 Tente remover a pasta wwebjs_auth_v3 e reiniciar');
            });

            // Desconexão
            this.client.on('disconnected', (reason) => {
                console.log('📴 WhatsApp desconectado:', reason);
                this.isConnected = false;
            });

            await this.client.initialize();
            return this;

        } catch (error) {
            console.error('❌ Erro ao inicializar WhatsApp:', error);
            console.log('🌐 WhatsApp real falhou, usando simulação');
            this.setupSimulationMode();
            return this;
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

    setupSimulationMode() {
        console.log('🤖 Configurando modo simulação...');
        this.isConnected = true;
        this.connectedNumber = '5511999999999';
        this.numberDiscovered = true;

        this.showTestInstructions();

        // Enviar mensagem simulada após 10 segundos
        setTimeout(() => {
            if (this.messageHandler && typeof this.messageHandler === 'function') {
                console.log('\n🔔 ===== MENSAGEM SIMULADA =====');
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
    }

    showTestInstructions() {
        console.log('\n🎯 ===== COMO TESTAR O CHATBOT =====');
        console.log(`📞 Número do Bot: ${this.connectedNumber || 'Será descoberto na primeira mensagem'}`);
        console.log('\n📱 Opções para testar:');
        console.log('1. 💬 Envie mensagem para o número do bot');
        console.log('2. 🌐 Acesse: http://localhost:3000/test-chat');
        console.log('3. 🔔 Aguarde mensagem simulada (10 segundos)');
        console.log('===================================\n');
    }

    async sendMessage(chatId, message) {
        try {
            if (!this.isConnected) {
                console.log('⚠️ WhatsApp não conectado, simulando envio...');
                console.log(`📤 RESPOSTA SIMULADA para ${chatId}:`);
                console.log(`💬 ${message}`);
                console.log('=====================================\n');
                return true;
            }

            await this.client.sendMessage(chatId, message);
            console.log(`✅ Mensagem enviada para ${chatId}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            return false;
        }
    }

    async sendCatalog(chatId, products) {
        const catalogMessage = this.formatCatalogMessage(products);
        return await this.sendMessage(chatId, catalogMessage);
    }

    formatCatalogMessage(products) {
        if (!products || products.length === 0) {
            return "❌ *NENHUMA PEÇA ENCONTRADA*\n\nTente uma busca mais específica ou entre em contato conosco!";
        }

        let message = "🛒 *CATÁLOGO DE PEÇAS ENCONTRADAS*\n\n";

        products.slice(0, 5).forEach((product, index) => {
            message += `${index + 1}️⃣ *${product.name}*\n`;
            message += `📦 Código: ${product.code}\n`;
            message += `🚗 Compatível: ${product.compatibility.join(', ')}\n`;
            message += `💰 Preço: R$ ${product.price.toFixed(2)}\n`;
            message += `📊 Estoque: ${product.stock} unidades\n`;
            message += `⭐ Avaliação: ${product.rating}/5\n\n`;
        });

        if (products.length > 5) {
            message += `➕ *E mais ${products.length - 5} produtos disponíveis!*\n\n`;
        }

        message += "📞 *Entre em contato para mais informações!*";
        return message;
    }

    simulateMessage(messageText, fromNumber) {
        try {
            if (this.messageHandler && typeof this.messageHandler === 'function') {
                console.log('\n🔔 ===== MENSAGEM SIMULADA (TESTE) =====');
                this.messageHandler({
                    from: `${fromNumber}@c.us`,
                    to: `${this.connectedNumber}@c.us`,
                    body: messageText,
                    timestamp: Date.now(),
                    id: 'test_' + Date.now(),
                    fromMe: false
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Erro ao simular mensagem:', error);
            return false;
        }
    }

    onMessage(handler) {
        if (typeof handler === 'function') {
            this.messageHandler = handler;
            console.log('✅ Message handler configurado com sucesso');
        } else {
            console.error('❌ Handler deve ser uma função');
        }
    }

    isReady() {
        return this.isConnected;
    }

    getConnectedNumber() {
        return this.connectedNumber;
    }

    isNumberDiscovered() {
        return this.numberDiscovered;
    }
}

module.exports = WhatsAppService;