// src/services/catalogService.js
const Product = require('../models/Product');
const mongoose = require('mongoose'); // Importar mongoose para Product.find()

class CatalogService {
    constructor() {
        console.log('✅ CatalogService inicializado para usar MongoDB.');
        this.products = []; // Armazenar todos os produtos em memória
        this.isInitialized = false; // Flag para indicar se os produtos foram carregados
    }

    /**
     * Inicializa o serviço, carregando todos os produtos do banco de dados para a memória.
     * Isso permite buscas rápidas sem consultas repetitivas ao DB.
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('📦 CatalogService já inicializado. Pulando pré-carga.');
            return;
        }
        try {
            console.log('📦 Carregando todos os produtos do banco de dados para a memória...');
            this.products = await Product.find({}); // Carrega todos os produtos do DB
            this.isInitialized = true;
            console.log(`✅ CatalogService inicializado com ${this.products.length} produtos em memória.`);
        } catch (error) {
            console.error('❌ Erro ao pré-carregar produtos no CatalogService:', error);
            this.isInitialized = false; // Falha na inicialização
            this.products = []; // Limpa produtos em caso de erro
            throw new Error('Falha ao inicializar CatalogService: ' + error.message);
        }
    }

    /**
     * Retorna todos os produtos atualmente carregados na memória.
     * @returns {Array} Lista de produtos.
     */
    getAllProducts() {
        return this.products;
    }

    /**
     * Retorna a contagem total de produtos no banco de dados.
     * @returns {Promise<number>} Número de produtos.
     */
    async getProductCount() {
        try {
            // Este método ainda consulta o DB para obter a contagem mais recente e precisa
            const count = await Product.countDocuments({});
            return count;
        } catch (error) {
            console.error('❌ Erro ao contar produtos no MongoDB (getProductCount):', error);
            return 0;
        }
    }

    /**
     * Busca produtos na memória baseado em uma query e filtros.
     * Se não encontrar na memória ou for uma query complexa, pode recorrer ao DB.
     * @param {string} query Termo de busca.
     * @param {object} filters Filtros adicionais (category, brand, maxPrice, etc.).
     * @returns {Promise<Array>} Lista de produtos encontrados.
     */
    async searchProducts(query, filters = {}) {
        if (!this.isInitialized) {
            console.warn('⚠️ CatalogService não inicializado. Tentando carregar produtos antes da busca.');
            await this.initialize(); // Tenta inicializar se não estiver
        }

        if (!query || query.trim() === '') {
            console.log('📝 Query vazia, retornando primeiros 10 produtos da memória.');
            return this.products.slice(0, 10);
        }

        const cleanQuery = query.trim().toLowerCase();
        const queryWords = cleanQuery.split(/\s+/).filter(word => word.length > 1); // Ignorar palavras muito pequenas

        let results = this.products.filter(product => {
            const name = (product.name || '').toLowerCase();
            const brand = (product.brand || '').toLowerCase();
            const category = (product.category || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            const code = (product.code || '').toLowerCase();
            const compatibility = (product.compatibility || []).map(c => c.toLowerCase()).join(' ');
            const oemCodes = (product.oem_codes || []).map(o => o.toLowerCase()).join(' ');

            if (queryWords.length === 0) { // Se a query estiver vazia após limpeza
                return true;
            }
            
            // Verifica se TODAS as palavras da query estão em algum campo
            return queryWords.every(word => 
                name.includes(word) ||
                brand.includes(word) ||
                category.includes(word) ||
                description.includes(word) ||
                code.includes(word) ||
                compatibility.includes(word) ||
                oemCodes.includes(word)
            );
        });

        // Aplicar filtros adicionais
        if (filters.category) {
            results = results.filter(p => (p.category || '').toLowerCase() === filters.category.toLowerCase());
        }
        if (filters.brand) {
            results = results.filter(p => (p.brand || '').toLowerCase() === filters.brand.toLowerCase());
        }
        if (filters.maxPrice) {
            results = results.filter(p => p.price <= filters.maxPrice);
        }
        // Filtros de estoque e ativo - usam dados em memória
        if (filters.onlyActive !== false) {
            results = results.filter(p => p.is_active === undefined || p.is_active === true);
        }
        if (filters.onlyInStock !== false) {
            results = results.filter(p => p.stock === undefined || p.stock > 0);
        }

        results.sort((a, b) => a.price - b.price); // Ordena por preço

        console.log(`🔍 Busca na memória por "${query}" encontrou: ${results.length} produtos.`);
        return results.slice(0, 20); // Limita os resultados retornados
    }

    /**
     * Método para debug - verificar estrutura dos produtos e contagem.
     * @returns {Promise<void>}
     */
    async debugProductStructure() {
        try {
            console.log('🔍 Analisando estrutura de produtos no banco...');
            
            const sampleProduct = await Product.findOne({});
            if (sampleProduct) {
                console.log('📋 Estrutura de um produto exemplo:');
                console.log(JSON.stringify(sampleProduct.toObject(), null, 2));
                
                const fields = Object.keys(sampleProduct.toObject());
                console.log('🏷️ Campos disponíveis:', fields);
            } else {
                console.log('❌ Nenhum produto encontrado no banco para debug.');
            }
            
            const totalCount = await this.getProductCount();
            console.log(`📊 Total de produtos no DB: ${totalCount}`);
            
        } catch (error) {
            console.error('❌ Erro no debugProductStructure:', error);
        }
    }

    // Métodos auxiliares de busca (podem usar a lista em memória)
    getProductByCode(code) {
        return this.products.find(p => p.code === code || (p.oem_codes && p.oem_codes.includes(code)));
    }

    getProductById(id) {
        // Supondo que 'id' é um campo único que você usa para identificar o produto,
        // não necessariamente o _id do MongoDB, a menos que seu Product model defina.
        return this.products.find(p => p.id === id); 
    }

    getLowStockProducts(threshold = 5) {
        return this.products.filter(p => p.stock && p.stock <= threshold && p.stock > 0);
    }

    // O método `calculatePrice` não precisa de modificação.
    calculatePrice(product, customerType = 'retail', quantity = 1) {
        if (!product) return null;

        let price = product.price;

        if (customerType === 'wholesale' && quantity >= 5) {
            price *= 0.90; // 10% desconto
        }

        if (quantity >= 10) {
            price *= 0.95; // 5% desconto adicional
        } else if (quantity >= 5) {
            price *= 0.97; // 3% desconto adicional
        }

        return {
            unit_price: product.price,
            final_price: price,
            total: price * quantity,
            discount_applied: product.price - price,
            quantity: quantity
        };
    }

    // REMOVIDO: O método `startChatbot()` foi removido, pois ele pertence ao ServiceManager.
}

module.exports = CatalogService;