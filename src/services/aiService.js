// src/services/aiService.js
const OpenAI = require('openai');

class AIService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey) {
            this.openai = new OpenAI({ apiKey: apiKey });
            console.log('✅ AI Service inicializado com OpenAI real.');
        } else {
            this.openai = null;
            console.log('🤖 AI Service em modo SIMULAÇÃO (sem OpenAI real). Por favor, defina OPENAI_API_KEY no seu .env');
        }
    }

    /**
     * Processa a mensagem do usuário usando IA (real ou simulada) para detectar intenção e entidades.
     * @param {string} message A mensagem do usuário.
     * @param {object} context Contexto da conversa (opcional).
     * @returns {Promise<object>} Objeto com { response, intent, entities, confidence }.
     */
    async processMessage(message, context = {}) {
        console.log('🧠 Processando mensagem com AI Service...');

        if (!this.openai) {
            // Modo de SIMULAÇÃO: Intenção e Entidades baseadas em palavras-chave simples
            console.log('⚠️ Usando IA SIMULADA (API Key não configurada).');
            const messageText = message.toLowerCase();
            await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay

            let intent = 'general_inquiry';
            let entities = {};
            let confidence = 0.3;
            let response = this.generateDefaultResponse();

            if (messageText.includes('oi') || messageText.includes('olá') || messageText.includes('bom dia')) {
                intent = 'greeting';
                response = this.generateGreetingResponse();
                confidence = 0.9;
            } else if (messageText.includes('catálogo') || messageText.includes('produtos') || messageText.includes('peças')) {
                intent = 'catalog_request';
                response = this.generateCatalogResponse();
                confidence = 0.85;
            } else if (messageText.includes('ajuda') || messageText.includes('socorro') || messageText.includes('opções')) {
                intent = 'help_request';
                response = this.generateHelpResponse();
                confidence = 0.8;
            } else if (messageText.includes('pastilha') || messageText.includes('freio') || messageText.includes('filtro') || messageText.includes('amortecedor') || messageText.includes('vela')) {
                intent = 'search_part';
                response = 'Ok, estou procurando por essa peça.';
                confidence = 0.7;

                // Simular extração de entidades
                if (messageText.includes('pastilha')) entities.product_name = 'pastilha de freio';
                if (messageText.includes('filtro')) entities.product_name = 'filtro';
                if (messageText.includes('amortecedor')) entities.product_name = 'amortecedor';
                if (messageText.includes('vela')) entities.product_name = 'vela de ignição';
                
                if (messageText.includes('honda civic')) entities.vehicle_model = 'Honda Civic';
                if (messageText.includes('toyota corolla')) entities.vehicle_model = 'Toyota Corolla';
                if (messageText.includes('2015')) entities.vehicle_year = '2015';

                response = this.generateSearchPartResponse(entities);

            } else if (messageText.includes('preço') || messageText.includes('valor') || messageText.includes('quanto custa')) {
                intent = 'price_inquiry';
                response = 'Por favor, me diga o nome da peça para que eu possa verificar o preço.';
                confidence = 0.6;
            } else if (messageText.includes('falar com atendente') || messageText.includes('humano') || messageText.includes('transferir')) {
                intent = 'escalate_to_human';
                response = 'Entendido. Vou te conectar com um atendente humano.';
                confidence = 0.95;
            } else if (messageText.includes('obrigado') || messageText.includes('tchau') || messageText.includes('até mais')) {
                intent = 'goodbye';
                response = this.generateFarewellResponse();
                confidence = 0.8;
            }

            return { response, intent, entities, confidence };

        } else {
            // Lógica para usar a API real da OpenAI
            try {
                console.log('🚀 Chamando a API da OpenAI para detecção de intenção...');
                
                // Exemplo de prompt mais sofisticado para detecção de intenção e extração de entidades.
                // Em um projeto real, você usaria Function Calling ou um prompt mais elaborado
                // para extrair JSON com intenção/entidades.
                const systemPrompt = `Você é um assistente de vendas de autopeças. 
                Sua tarefa é entender a *intenção* do usuário e extrair *entidades* relevantes.
                As intenções possíveis são: 'greeting', 'catalog_request', 'help_request', 'search_part', 
                'price_inquiry', 'escalate_to_human', 'goodbye', 'general_inquiry'.
                Para 'search_part' ou 'price_inquiry', tente extrair 'product_name', 'vehicle_model' e 'vehicle_year'.
                Responda com um objeto JSON no formato:
                {
                    "intent": "sua_intencao",
                    "entities": {
                        "product_name": "nome_da_peca_extraido",
                        "vehicle_model": "modelo_do_veiculo_extraido",
                        "vehicle_year": "ano_do_veiculo_extraido"
                    },
                    "response_suggestion": "uma_sugestao_de_resposta_curta_para_o_bot"
                }
                Se não conseguir identificar claramente, use "general_inquiry".
                Priorize a extração de intenção e entidades.`;

                const completion = await this.openai.chat.completions.create({
                    model: "gpt-3.5-turbo", // ou gpt-4, gpt-4o para melhor performance/custo
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: message }
                    ],
                    max_tokens: 200,
                    response_format: { type: "json_object" } // Solicita resposta em formato JSON
                });

                const rawResponse = completion.choices[0].message.content;
                console.log(`✅ Resposta bruta da OpenAI: ${rawResponse}`);
                
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(rawResponse);
                } catch (parseError) {
                    console.error('❌ Erro ao parsear JSON da OpenAI, usando fallback:', parseError);
                    // Em caso de JSON inválido, retorna uma intenção genérica
                    return { 
                        response: "Desculpe, tive um problema ao entender sua solicitação. Pode tentar de outra forma?", 
                        intent: 'general_inquiry', 
                        entities: {}, 
                        confidence: 0.2 
                    };
                }

                // Ajusta a confiança baseada na identificação
                const confidence = parsedResponse.intent !== 'general_inquiry' ? 0.8 : 0.4;

                return {
                    response: parsedResponse.response_suggestion || "Ok, entendi.",
                    intent: parsedResponse.intent,
                    entities: parsedResponse.entities || {},
                    confidence: confidence
                };

            } catch (error) {
                console.error('❌ Erro ao chamar a API da OpenAI:', error.response ? error.response.data : error.message);
                return { 
                    response: "Desculpe, a IA está com probleminhas. Poderia tentar novamente?", 
                    intent: 'error', 
                    entities: {}, 
                    confidence: 0.1 
                };
            }
        }
    }

    // Funções auxiliares para respostas simuladas
    generateGreetingResponse() {
        return `👋 *Olá! Bem-vindo à AutoPeças!* Sou seu assistente virtual. Como posso ajudar?`;
    }
    generateCatalogResponse() {
        return ` *Entendido! Mostrarei o catálogo de produtos.*`;
    }
    generateHelpResponse() {
        return `❓ *Central de Ajuda:* Diga o que precisa, ou digite 'catálogo' ou 'falar com atendente'.`;
    }
    generateSearchPartResponse(entities) {
        let response = `Ok, procurando`;
        if (entities.product_name) response += ` por ${entities.product_name}`;
        if (entities.vehicle_model) response += ` para ${entities.vehicle_model}`;
        if (entities.vehicle_year) response += ` ano ${entities.vehicle_year}`;
        response += `.`;
        return response;
    }
    generateFarewellResponse() {
        return `👋 *Obrigado por utilizar a AutoPeças!* Tenha um ótimo dia!`;
    }
    generateDefaultResponse() {
        return `💬 Não entendi bem. Pode reformular sua pergunta ou digitar 'ajuda'?`;
    }
}

module.exports = AIService;