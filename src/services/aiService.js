class AIService {
    constructor() {
        this.openai = null;
        console.log('🤖 AI Service em modo SIMULAÇÃO (sem OpenAI real)');
    }

    async processMessage(message, context = {}) {
        console.log('🧠 Processando com IA SIMULADA...');
        
        // Simular delay de processamento
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const messageText = message.toLowerCase();
        
        // Respostas simuladas baseadas em palavras-chave
        if (messageText.includes('pastilha') || messageText.includes('freio')) {
            return {
                response: this.generateCatalogResponse(),
                intent: 'product_search',
                confidence: 0.95,
                products: this.getMockProducts('pastilha')
            };
        }
        
        if (messageText.includes('preço') || messageText.includes('valor') || messageText.includes('quanto')) {
            return {
                response: this.generatePriceResponse(),
                intent: 'price_inquiry',
                confidence: 0.90
            };
        }
        
        if (messageText.includes('oi') || messageText.includes('olá') || messageText.includes('bom dia')) {
            return {
                response: this.generateGreetingResponse(),
                intent: 'greeting',
                confidence: 0.85
            };
        }
        
        if (messageText.includes('obrigado') || messageText.includes('valeu') || messageText.includes('tchau')) {
            return {
                response: this.generateFarewellResponse(),
                intent: 'farewell',
                confidence: 0.80
            };
        }
        
        // Resposta padrão para mensagens não reconhecidas
        return {
            response: this.generateDefaultResponse(),
            intent: 'unknown',
            confidence: 0.30
        };
    }

    generateCatalogResponse() {
        return `🔧 *Encontrei estas opções de pastilhas de freio:*

1️⃣ *Pastilha Freio Dianteira Bosch*
📦 Código: PF001
🚗 Honda Civic 2012-2016
💰 R$ 89,90
📊 15 unidades

2️⃣ *Pastilha Freio Traseira TRW*
📦 Código: PF002  
🚗 Honda Civic 2015-2018
💰 R$ 65,50
📊 8 unidades

3️⃣ *Kit Pastilhas Completo Textar*
�� Código: KPF001
�� Honda Civic 2015
💰 R$ 145,00
📊 5 unidades

📱 *Digite o número da opção desejada ou "preço" para mais detalhes!*

🚚 *Entrega rápida em toda região!*`;
    }

    generatePriceResponse() {
        return `💰 *Informações de Preço:*

🔸 *Pastilha Dianteira:* R$ 89,90
🔸 *Pastilha Traseira:* R$ 65,50  
🔸 *Kit Completo:* R$ 145,00

💳 *Formas de Pagamento:*
• PIX (5% desconto)
• Cartão até 3x sem juros
• Dinheiro (3% desconto)

🚚 *Frete GRÁTIS* acima de R$ 100,00

📱 Quer finalizar o pedido? Digite *"comprar"*`;
    }

    generateGreetingResponse() {
        return `👋 *Olá! Bem-vindo à AutoPeças Tech!*

🔧 Sou seu assistente especializado em autopeças!

💡 *Posso te ajudar com:*
• Busca de peças por modelo do carro
• Consulta de preços e estoque  
• Informações de compatibilidade
• Orçamentos personalizados

🚗 *Para começar, me diga:*
Qual peça você precisa e para qual carro?

*Exemplo:* "Preciso de pastilha de freio para Civic 2015"`;
    }

    generateFarewellResponse() {
        return `🙏 *Obrigado por escolher a AutoPeças Tech!*

✅ Foi um prazer te atender!

📱 *Lembre-se:*
• Estamos sempre aqui para ajudar
• Garantia em todas as peças
• Entrega rápida e segura

🔧 *Volte sempre que precisar de autopeças!*

📞 Urgências: +5586995325524
🌐 www.autopecastech.com.br`;
    }

    generateDefaultResponse() {
        return `🤔 *Não entendi sua solicitação...*

💡 *Posso te ajudar com:*
• Busca de autopeças
• Consulta de preços
• Informações de estoque
• Compatibilidade de peças

🚗 *Exemplos do que você pode perguntar:*
• "Pastilha de freio para Civic 2015"
• "Filtro de óleo para Corolla"
• "Qual o preço da peça X?"

📱 Ou digite *"catálogo"* para ver nossas categorias!`;
    }

    getMockProducts(category) {
        const products = {
            pastilha: [
                {
                    id: 'PF001',
                    name: 'Pastilha Freio Dianteira Bosch',
                    code: 'PF001',
                    price: 89.90,
                    stock: 15,
                    brand: 'Bosch',
                    compatibility: ['Honda Civic 2012-2016']
                },
                {
                    id: 'PF002',
                    name: 'Pastilha Freio Traseira TRW',
                    code: 'PF002',
                    price: 65.50,
                    stock: 8,
                    brand: 'TRW',
                    compatibility: ['Honda Civic 2015-2018']
                }
            ]
        };
        
        return products[category] || [];
    }
}

module.exports = AIService;