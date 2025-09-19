// src/controllers/messageController.js
class MessageController {
    constructor(catalogService, aiService) { // Agora recebe aiService
        this.catalogService = catalogService;
        this.aiService = aiService; // Armazena o AI Service
        console.log('✅ MessageController inicializado');
    }

    /**
     * Lida com as mensagens recebidas do usuário, usando IA para entender a intenção.
     * @param {object} message Objeto da mensagem recebida (ex: de whatsapp-web.js).
     * @param {object} whatsappService Instância do serviço de WhatsApp para enviar respostas.
     */
    async handleMessage(message, whatsappService) {
        try {
            console.log('🔄 MessageController processando mensagem...');
            
            const userMessage = message.body.trim();
            const chatId = message.from;
            
            console.log(`📝 Mensagem recebida: "${userMessage}" de ${chatId}`);

            // 1. Processar mensagem com o AIService para obter intenção e entidades
            const aiResult = await this.aiService.processMessage(userMessage);
            console.log(`🧠 AI detectou: Intenção=${aiResult.intent}, Entidades=${JSON.stringify(aiResult.entities)}, Confiança=${aiResult.confidence}`);

            let botResponse = '';
            let productsFound = [];

            // 2. Lógica baseada na intenção detectada pela IA
            switch (aiResult.intent) {
                case 'greeting':
                    botResponse = this.getGreetingResponse();
                    break;

                case 'catalog_request':
                    // Pega todos os produtos do CatalogService (que já estão em memória)
                    productsFound = this.catalogService.getAllProducts(); 
                    if (productsFound.length > 0) {
                        await whatsappService.sendCatalog(chatId, productsFound);
                    } else {
                        botResponse = "Desculpe, não consegui encontrar nenhum produto no catálogo no momento. Por favor, tente mais tarde.";
                    }
                    break;

                case 'help_request':
                    botResponse = this.getHelpResponse();
                    break;

                case 'search_part':
                    const productName = aiResult.entities.product_name || userMessage;
                    const vehicleModel = aiResult.entities.vehicle_model;
                    const vehicleYear = aiResult.entities.vehicle_year;

                    // Constrói a query para o CatalogService
                    const searchQuery = productName;
                    const searchFilters = {};
                    if (vehicleModel) searchFilters.vehicle = vehicleModel;
                    if (vehicleYear) searchFilters.year = vehicleYear;

                    productsFound = await this.catalogService.searchProducts(searchQuery, searchFilters);
                    
                    if (productsFound.length > 0) {
                        console.log(`🔍 Encontrados ${productsFound.length} produtos via IA para "${searchQuery}".`);
                        await whatsappService.sendCatalog(chatId, productsFound);
                    } else {
                        botResponse = this.getNoProductsResponse(userMessage);
                    }
                    break;

                case 'price_inquiry':
                    const inquiredProduct = aiResult.entities.product_name;
                    if (inquiredProduct) {
                        const products = await this.catalogService.searchProducts(inquiredProduct, {});
                        if (products.length > 0) {
                            botResponse = `O preço de ${products[0].name} é R$ ${products[0].price.toFixed(2)}.`;
                            if (products[0].stock !== undefined && products[0].stock <= 5 && products[0].stock > 0) {
                                botResponse += ` Restam poucas unidades em estoque!`;
                            } else if (products[0].stock === 0) {
                                botResponse += ` Este item está sem estoque no momento.`;
                            }
                        } else {
                            botResponse = `Não encontrei informações de preço para "${inquiredProduct}". Tente ser mais específico.`;
                        }
                    } else {
                        botResponse = `Para qual peça você gostaria de saber o preço, ${message.from.split('@')[0]}?`;
                    }
                    break;

                case 'escalate_to_human':
                    botResponse = "Entendido, Gabriel! Vou te conectar com um dos nossos atendentes humanos. Por favor, aguarde um momento. Assim que um atendente estiver disponível, ele entrará em contato.";
                    // Aqui você implementaria a lógica para notificar um atendente (ex: via um sistema de tickets, Slack, etc.)
                    // Exemplo: await this.someNotificationService.notifyHuman(chatId, userMessage);
                    break;

                case 'goodbye':
                    botResponse = this.getGoodbyeResponse();
                    break;
                    
                case 'error': // Quando o AIService encontra um erro
                case 'general_inquiry': // Quando a IA não tem certeza da intenção
                default:
                    // Se a confiança da IA for muito baixa, ou for uma intenção geral
                    if (aiResult.confidence && aiResult.confidence < 0.5) {
                        botResponse = this.getNoProductsResponse(userMessage); // Resposta de não entendimento
                    } else {
                        botResponse = aiResult.response; // Resposta direta da IA
                    }
                    break;
            }

            // Envia a resposta se uma foi gerada
            if (botResponse) {
                await whatsappService.sendMessage(chatId, botResponse);
            }
            
            console.log('✅ Mensagem processada com sucesso.');
            
        } catch (error) {
            console.error('❌ Erro no MessageController.handleMessage:', error);
            // Resposta de erro para o usuário
            try {
                const errorResponse = "😅 Ops! Tive um probleminha técnico. Pode repetir sua mensagem?";
                await whatsappService.sendMessage(message.from, errorResponse);
            } catch (sendError) {
                console.error('❌ Erro ao enviar mensagem de erro:', sendError);
            }
        }
    }

    // Métodos auxiliares de resposta (mantidos do seu código original)
    getGreetingResponse() {
        return `👋 *Olá! Bem-vindo à AutoPeças!*

🔧 Sou seu assistente virtual e estou aqui para ajudar você a encontrar as peças perfeitas para seu veículo!

💬 *Como posso ajudar hoje?*
• Digite o nome da peça que precisa
• Mencione o modelo do seu carro
• Digite "catálogo" para ver todos os produtos
• Digite "ajuda" para mais opções

*Exemplo:* "Preciso de pastilha de freio para Civic 2015"`;
    }

    getHelpResponse() {
        return `❓ *Central de Ajuda - AutoPeças*

🔍 *Como buscar peças:*
• Digite o nome da peça (ex: "pastilha de freio")
• Mencione o modelo do carro (ex: "para Civic 2015")
• Combine ambos (ex: "filtro de óleo Corolla")

📋 *Comandos úteis:*
• *"catálogo"* - Ver todos os produtos
• *"ajuda"* - Esta mensagem
• *"falar com atendente"* - Falar com atendente

🚗 *Tipos de peças disponíveis:*
• Pastilhas e discos de freio
• Filtros (óleo, ar, combustível)
• Amortecedores e molas
• Velas de ignição
• E muito mais!

💬 *Dica:* Seja específico! Quanto mais detalhes, melhor posso ajudar!`;
    }

    getNoProductsResponse(originalMessage) {
        return `🔍 *Ops! Não encontrei peças para "${originalMessage}"*

💡 *Algumas sugestões:*
• Verifique a grafia do produto
• Tente termos mais simples (ex: "freio" ao invés de "pastilha de freio dianteira")
• Mencione apenas o modelo do carro (ex: "Civic" ao invés de "Honda Civic 2015 LX")

📋 Digite *"catálogo"* para ver todos os produtos disponíveis

🤝 Ou digite *"ajuda"* para mais dicas de busca!`;
    }

    getGoodbyeResponse() {
        return `👋 A AutoPeças agradece seu contato! Se precisar de algo mais, é só chamar!`;
    }

    // O método `processProductSelection` seria para um fluxo mais avançado de interação
    // async processProductSelection(message, whatsappService) {
    //     console.log('🔄 Processando seleção de produto...');
    // }
}

module.exports = MessageController;