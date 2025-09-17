// src/services/aiService.js
const OpenAI = require('openai'); // Certifique-se de ter o pacote 'openai' instalado: npm install openai

class AIService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey) {
            this.openai = new OpenAI({ apiKey: apiKey });
            console.log('✅ AI Service inicializado com OpenAI real.');
        } else {
            this.openai = null; // Garante que a instância da OpenAI não seja criada
            console.log('🤖 AI Service em modo SIMULAÇÃO (sem OpenAI real). Por favor, defina OPENAI_API_KEY no seu .env');
        }
    }

    async processMessage(message, context = {}) {
        console.log('🧠 Processando mensagem...');

        if (!this.openai) {
            // Se não houver chave API, fallback para a simulação (para desenvolvimento local sem custo)
            console.log('⚠️ Usando IA SIMULADA (API Key não configurada).');
            const messageText = message.toLowerCase();
            // Simular delay de processamento
            await new Promise(resolve => setTimeout(resolve, 500));

            if (messageText.includes('pastilha') || messageText.includes('freio')) {
                return { response: this.generateCatalogResponse(), intent: 'product_search', confidence: 0.95 };
            }
            if (messageText.includes('preço') || messageText.includes('valor') || messageText.includes('quanto')) {
                return { response: this.generatePriceResponse(), intent: 'price_inquiry', confidence: 0.90 };
            }
            if (messageText.includes('oi') || messageText.includes('olá') || messageText.includes('bom dia')) {
                return { response: this.generateGreetingResponse(), intent: 'greeting', confidence: 0.85 };
            }
            if (messageText.includes('obrigado') || messageText.includes('valeu') || messageText.includes('tchau')) {
                return { response: this.generateFarewellResponse(), intent: 'farewell', confidence: 0.80 };
            }
            return { response: this.generateDefaultResponse(), intent: 'unknown', confidence: 0.30 };

        } else {
            // Lógica para usar a API real da OpenAI
            try {
                console.log('🚀 Chamando a API da OpenAI...');
                const completion = await this.openai.chat.completions.create({
                    model: "gpt-3.5-turbo", // Ou "gpt-4", "gpt-4o" se preferir
                    messages: [
                        { role: "system", content: "Você é um assistente de vendas de autopeças. Responda de forma útil e profissional, focando em encontrar produtos ou informações para o cliente." },
                        // Se você tiver contexto de conversas anteriores, adicione aqui
                        { role: "user", content: message }
                    ],
                    max_tokens: 150, // Limite de tokens na resposta
                });

                const botResponse = completion.choices[0].message.content;
                console.log(`✅ Resposta da OpenAI: ${botResponse}`);

                // Aqui você precisaria de uma lógica mais avançada para extrair "intent" e "products"
                // da resposta da OpenAI, o que é um tópico mais complexo (NLP, function calling, etc.)
                // Por enquanto, vamos retornar apenas a resposta e um intent genérico.
                return {
                    response: botResponse,
                    intent: 'general_query', // Ou tente inferir algo baseado na resposta
                    confidence: 0.70 // A confiança pode ser determinada pela própria IA em modelos mais avançados
                };

            } catch (error) {
                console.error('❌ Erro ao chamar a API da OpenAI:', error.response ? error.response.data : error.message);
                // Fallback para uma resposta padrão ou simulada em caso de erro da API
                return { response: "Desculpe, tive um problema ao processar sua solicitação com a IA. Pode tentar novamente?", intent: 'error', confidence: 0.1 };
            }
        }
    }

    // Métodos de simulação (ainda úteis para fallback ou testes)
    generateCatalogResponse() {
        return `�� *Encontrei estas opções de pastilhas de freio:* ... (seu texto simulado)`;
    }
    generatePriceResponse() {
        return `💰 *Informações de Preço:* ... (seu texto simulado)`;
    }
    generateGreetingResponse() {
        return `�� *Olá! Bem-vindo à AutoPeças Tech!* ... (seu texto simulado)`;
    }
    generateFarewellResponse() {
        return `�� *Obrigado por escolher a AutoPeças Tech!* ... (seu texto simulado)`;
    }
    generateDefaultResponse() {
        return `�� *Não entendi sua solicitação...* ... (seu texto simulado)`;
    }
}

module.exports = AIService;