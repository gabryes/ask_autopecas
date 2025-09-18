const MessageTemplate = require('../models/MessageTemplate');
const MessageCategory = require('../models/MessageCategory');

class MessageTemplateService {
    constructor() {
        console.log('✅ MessageTemplateService inicializado');
    }

    // Buscar template por intent
    async getTemplateByIntent(intent, variables = {}) {
        try {
            const templates = await MessageTemplate.findByIntent(intent);
            
            if (templates.length === 0) {
                return null;
            }

            // Pegar o template com maior prioridade
            const template = templates[0];
            
            // Incrementar uso
            await template.incrementUsage();
            
            // Processar variáveis
            const processedContent = template.processVariables(variables);
            
            return {
                id: template._id,
                title: template.title,
                content: processedContent,
                original_content: template.content,
                intent: template.intent,
                category: template.category_id,
                variables: template.variables
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar template por intent:', error);
            return null;
        }
    }

    // Buscar template por palavras-chave
    async getTemplateByKeywords(message) {
        try {
            const words = message.toLowerCase().split(/\s+/);
            const templates = await MessageTemplate.findByKeywords(words);
            
            if (templates.length === 0) {
                return null;
            }

            // Calcular score de relevância
            const scoredTemplates = templates.map(template => {
                let score = 0;
                template.keywords.forEach(keyword => {
                    if (words.includes(keyword.toLowerCase())) {
                        score += 1;
                    }
                });
                return { template, score };
            });

            // Ordenar por score
            scoredTemplates.sort((a, b) => b.score - a.score);
            
            if (scoredTemplates[0].score === 0) {
                return null;
            }

            const bestTemplate = scoredTemplates[0].template;
            await bestTemplate.incrementUsage();
            
            return {
                id: bestTemplate._id,
                title: bestTemplate.title,
                content: bestTemplate.content,
                intent: bestTemplate.intent,
                relevance_score: scoredTemplates[0].score
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar template por keywords:', error);
            return null;
        }
    }

    // CRUD Operations
    async createTemplate(templateData) {
        try {
            const template = new MessageTemplate(templateData);
            await template.save();
            return template;
        } catch (error) {
            console.error('❌ Erro ao criar template:', error);
            throw error;
        }
    }

    async updateTemplate(id, updateData) {
        try {
            const template = await MessageTemplate.findByIdAndUpdate(
                id, 
                updateData, 
                { new: true, runValidators: true }
            );
            return template;
        } catch (error) {
            console.error('❌ Erro ao atualizar template:', error);
            throw error;
        }
    }

    async deleteTemplate(id) {
        try {
            await MessageTemplate.findByIdAndDelete(id);
            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar template:', error);
            throw error;
        }
    }

    async getAllTemplates(filters = {}) {
        try {
            const query = {};
            
            if (filters.category_id) {
                query.category_id = filters.category_id;
            }
            
            if (filters.intent) {
                query.intent = filters.intent;
            }
            
            if (filters.is_active !== undefined) {
                query.is_active = filters.is_active;
            }

            const templates = await MessageTemplate.find(query)
                .populate('category_id', 'name color icon')
                .sort({ priority: -1, usage_count: -1 });
                
            return templates;
        } catch (error) {
            console.error('❌ Erro ao buscar templates:', error);
            throw error;
        }
    }

    // Importar templates via CSV
    async importFromCSV(csvData) {
        try {
            const results = {
                success: 0,
                errors: [],
                total: csvData.length
            };

            for (let i = 0; i < csvData.length; i++) {
                try {
                    const row = csvData[i];
                    
                    // Validar dados obrigatórios
                    if (!row.title || !row.content || !row.intent) {
                        results.errors.push({
                            row: i + 1,
                            error: 'Campos obrigatórios: title, content, intent'
                        });
                        continue;
                    }

                    // Buscar ou criar categoria
                    let category = await MessageCategory.findOne({ 
                        name: row.category || 'Geral' 
                    });
                    
                    if (!category) {
                        category = await MessageCategory.create({
                            name: row.category || 'Geral',
                            description: 'Categoria criada automaticamente'
                        });
                    }

                    // Processar keywords
                    const keywords = row.keywords ? 
                        row.keywords.split(',').map(k => k.trim()) : [];

                    // Criar template
                    const templateData = {
                        title: row.title,
                        content: row.content,
                        category_id: category._id,
                        intent: row.intent,
                        keywords: keywords,
                        priority: parseInt(row.priority) || 1,
                        is_active: row.is_active !== 'false'
                    };

                    await this.createTemplate(templateData);
                    results.success++;
                    
                } catch (error) {
                    results.errors.push({
                        row: i + 1,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('❌ Erro no import CSV:', error);
            throw error;
        }
    }

    // Estatísticas
    async getStats() {
        try {
            const stats = await MessageTemplate.aggregate([
                {
                    $group: {
                        _id: '$intent',
                        count: { $sum: 1 },
                        total_usage: { $sum: '$usage_count' },
                        avg_priority: { $avg: '$priority' }
                    }
                },
                { $sort: { total_usage: -1 } }
            ]);

            const totalTemplates = await MessageTemplate.countDocuments();
            const activeTemplates = await MessageTemplate.countDocuments({ is_active: true });
            
            return {
                total_templates: totalTemplates,
                active_templates: activeTemplates,
                by_intent: stats
            };
        } catch (error) {
            console.error('❌ Erro ao gerar stats:', error);
            throw error;
        }
    }
}

module.exports = MessageTemplateService;