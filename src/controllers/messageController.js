class MessageController {
    constructor(aiService, catalogService) {
        this.aiService = aiService;
        this.catalogService = catalogService;
        console.log('✅ MessageController inicializado');
    }

    async handleMessage(message, whatsappService) {
        try {
            console.log('🔄 MessageController processando mensagem...');
            
            const userMessage = message.body.toLowerCase().trim();
            const chatId = message.from;
            
            console.log(`📝 Mensagem processada: "${userMessage}"`);
            
            // Verificar se é uma saudação
            if (this.isGreeting(userMessage)) {
                const response = this.getGreetingResponse();
                await whatsappService.sendMessage(chatId, response);
                return;
            }
            
            // Verificar se é pedido de catálogo
            if (this.isCatalogRequest(userMessage)) {
                const products = this.catalogService.getAllProducts();
                await whatsappService.sendCatalog(chatId, products);
                return;
            }
            
            // Verificar se é pedido de ajuda
            if (this.isHelpRequest(userMessage)) {
                const response = this.getHelpResponse();
                await whatsappService.sendMessage(chatId, response);
                return;
            }
            
            // Buscar produtos no catálogo
            const products = this.catalogService.searchProducts(userMessage);
            
            if (products.length > 0) {
                console.log(`🔍 Encontrados ${products.length} produtos`);
                await whatsappService.sendCatalog(chatId, products);
            } else {
                console.log('❌ Nenhum produto encontrado');
                const response = this.getNoProductsResponse(userMessage);
                await whatsappService.sendMessage(chatId, response);
            }
            
            console.log('✅ Mensagem processada com sucesso');
            
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

    isGreeting(message) {
        const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'e aí', 'eai'];
        return greetings.some(greeting => message.includes(greeting));
    }

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

    isCatalogRequest(message) {
        const catalogKeywords = ['catálogo', 'catalogo', 'produtos', 'peças', 'pecas', 'lista', 'mostrar', 'ver tudo'];
        return catalogKeywords.some(keyword => message.includes(keyword));
    }

    isHelpRequest(message) {
        const helpKeywords = ['ajuda', 'help', 'como', 'funciona', 'comandos', 'opções', 'opcoes'];
        return helpKeywords.some(keyword => message.includes(keyword));
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
• *"contato"* - Falar com atendente

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

    // Método para processar seleção de produto (se implementado)
    async processProductSelection(message, whatsappService) {
        // Implementar lógica para quando usuário seleciona um produto específico
        console.log('🔄 Processando seleção de produto...');
    }
}

module.exports = MessageController;