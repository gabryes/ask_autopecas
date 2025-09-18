const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

class CSVImportService {
    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads');
        this.ensureUploadDir();
        console.log('✅ CSVImportService inicializado');
    }

    ensureUploadDir() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    resolve(results);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    validateCSVStructure(data, requiredFields) {
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('CSV vazio ou inválido');
        }

        const firstRow = data[0];
        const availableFields = Object.keys(firstRow);
        
        const missingFields = requiredFields.filter(field => 
            !availableFields.includes(field)
        );

        if (missingFields.length > 0) {
            throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
        }

        return true;
    }

    async processTemplateCSV(filePath) {
        try {
            const data = await this.parseCSV(filePath);
            
            // Validar estrutura
            const requiredFields = ['title', 'content', 'intent'];
            this.validateCSVStructure(data, requiredFields);
            
            return data;
        } catch (error) {
            console.error('❌ Erro ao processar CSV de templates:', error);
            throw error;
        }
    }

    async processProductCSV(filePath) {
        try {
            const data = await this.parseCSV(filePath);
            
            // Validar estrutura para produtos
            const requiredFields = ['name', 'code', 'brand', 'category', 'price'];
            this.validateCSVStructure(data, requiredFields);
            
            return data;
        } catch (error) {
            console.error('❌ Erro ao processar CSV de produtos:', error);
            throw error;
        }
    }

    generateSampleCSV(type = 'templates') {
        const samples = {
            templates: [
                {
                    title: 'Saudação Padrão',
                    content: '👋 Olá! Bem-vindo à AutoPeças! Como posso ajudar você hoje?',
                    intent: 'greeting',
                    category: 'Saudações',
                    keywords: 'oi,olá,bom dia,boa tarde',
                    priority: '5',
                    is_active: 'true'
                },
                {
                    title: 'Busca de Produtos',
                    content: '🔍 Encontrei {{product_count}} produtos para "{{search_term}}". Vou mostrar as melhores opções!',
                    intent: 'search_part',
                    category: 'Busca',
                    keywords: 'buscar,procurar,encontrar,preciso',
                    priority: '8',
                    is_active: 'true'
                }
            ],
            products: [
                {
                    name: 'Pastilha de Freio Dianteira',
                    code: 'PF001',
                    brand: 'Bosch',
                    category: 'freios',
                    price: '89.90',
                    stock: '15',
                    compatibility: 'Honda Civic 2012-2016|Toyota Corolla 2014-2018',
                    description: 'Pastilha de freio dianteira original Bosch'
                }
            ]
        };

        return samples[type] || samples.templates;
    }

    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 Arquivo temporário removido: ${filePath}`);
            }
        } catch (error) {
            console.error('❌ Erro ao remover arquivo:', error);
        }
    }
}

module.exports = CSVImportService;