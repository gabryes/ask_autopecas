// src/services/catalogService.js
const Product = require('../models/Product');

class CatalogService {
    constructor() {
        console.log('✅ CatalogService inicializado para usar MongoDB.');
    }

    // Método para obter todos os produtos do MongoDB
    async getAllProducts() {
        try {
            const products = await Product.find({});
            console.log(`📦 Total de produtos encontrados: ${products.length}`);
            return products;
        } catch (error) {
            console.error('❌ Erro ao buscar todos os produtos do MongoDB:', error);
            return [];
        }
    }

    // Método para obter a contagem de produtos do MongoDB
    async getProductCount() {
        try {
            const count = await Product.countDocuments({});
            console.log(`📊 Total de produtos no banco: ${count}`);
            return count;
        } catch (error) {
            console.error('❌ Erro ao contar produtos do MongoDB:', error);
            return 0;
        }
    }

    // Método MELHORADO para buscar produtos
    async searchProducts(query, filters = {}) {
        try {
            console.log(`🔍 Iniciando busca por: "${query}"`);
            console.log(`📋 Filtros aplicados:`, filters);

            if (!query || query.trim() === '') {
                console.log('📝 Query vazia, retornando primeiros 10 produtos');
                const products = await Product.find({}).limit(10);
                return products;
            }

            // Limpar e preparar a query
            const cleanQuery = query.trim().toLowerCase();
            const queryWords = cleanQuery.split(/\s+/);
            
            console.log(`🔤 Palavras da busca: [${queryWords.join(', ')}]`);

            // Construir query mais flexível
            const searchConditions = [];

            // Para cada palavra, criar condições de busca
            queryWords.forEach(word => {
                if (word.length >= 2) { // Ignorar palavras muito pequenas
                    searchConditions.push(
                        { name: { $regex: word, $options: 'i' } },
                        { brand: { $regex: word, $options: 'i' } },
                        { category: { $regex: word, $options: 'i' } },
                        { description: { $regex: word, $options: 'i' } },
                        { code: { $regex: word, $options: 'i' } },
                        { compatibility: { $regex: word, $options: 'i' } },
                        { oem_codes: { $regex: word, $options: 'i' } }
                    );
                }
            });

            // Query principal - MAIS FLEXÍVEL
            let searchQuery = {};
            
            if (searchConditions.length > 0) {
                searchQuery.$or = searchConditions;
            }

            // Aplicar filtros opcionais (não obrigatórios)
            const additionalFilters = {};
            
            if (filters.category) {
                additionalFilters.category = filters.category;
            }
            if (filters.brand) {
                additionalFilters.brand = filters.brand;
            }
            if (filters.maxPrice) {
                additionalFilters.price = { $lte: filters.maxPrice };
            }
            
            // Filtros de estoque e ativo - OPCIONAIS
            if (filters.onlyActive !== false) {
                // Só aplica se is_active existir no documento
                searchQuery.$and = searchQuery.$and || [];
                searchQuery.$and.push({
                    $or: [
                        { is_active: { $exists: false } }, // Campo não existe
                        { is_active: true }                // Campo existe e é true
                    ]
                });
            }
            
            if (filters.onlyInStock !== false) {
                // Só aplica se stock existir no documento
                searchQuery.$and = searchQuery.$and || [];
                searchQuery.$and.push({
                    $or: [
                        { stock: { $exists: false } },     // Campo não existe
                        { stock: { $gt: 0 } }              // Campo existe e > 0
                    ]
                });
            }

            // Combinar com filtros adicionais
            if (Object.keys(additionalFilters).length > 0) {
                searchQuery = { ...searchQuery, ...additionalFilters };
            }

            console.log(`🔍 Query MongoDB:`, JSON.stringify(searchQuery, null, 2));

            // Executar busca
            const products = await Product.find(searchQuery)
                .sort({ price: 1 })
                .limit(20); // Limitar resultados

            console.log(`✅ Busca concluída: ${products.length} produtos encontrados`);
            
            // Log dos produtos encontrados (apenas nomes)
            if (products.length > 0) {
                console.log(`📦 Produtos encontrados:`);
                products.slice(0, 5).forEach((product, index) => {
                    console.log(`   ${index + 1}. ${product.name} (${product.code || 'sem código'})`);
                });
                if (products.length > 5) {
                    console.log(`   ... e mais ${products.length - 5} produtos`);
                }
            } else {
                console.log(`❌ Nenhum produto encontrado para "${query}"`);
                
                // Busca de fallback - buscar qualquer produto que contenha pelo menos uma palavra
                console.log(`🔄 Tentando busca mais ampla...`);
                const fallbackQuery = {
                    $or: [
                        { name: { $regex: cleanQuery, $options: 'i' } },
                        { description: { $regex: cleanQuery, $options: 'i' } },
                        { category: { $regex: cleanQuery, $options: 'i' } }
                    ]
                };
                
                const fallbackProducts = await Product.find(fallbackQuery).limit(10);
                console.log(`🔄 Busca ampla encontrou: ${fallbackProducts.length} produtos`);
                return fallbackProducts;
            }

            return products;

        } catch (error) {
            console.error('❌ Erro ao buscar produtos no MongoDB:', error);
            console.error('Stack trace:', error.stack);
            return [];
        }
    }

    // Método para debug - verificar estrutura dos produtos
    async debugProductStructure() {
        try {
            console.log('🔍 Analisando estrutura dos produtos no banco...');
            
            const sampleProduct = await Product.findOne({});
            if (sampleProduct) {
                console.log('📋 Estrutura de um produto exemplo:');
                console.log(JSON.stringify(sampleProduct.toObject(), null, 2));
                
                // Verificar campos disponíveis
                const fields = Object.keys(sampleProduct.toObject());
                console.log('🏷️ Campos disponíveis:', fields);
            } else {
                console.log('❌ Nenhum produto encontrado no banco');
            }
            
            const totalCount = await this.getProductCount();
            console.log(`📊 Total de produtos: ${totalCount}`);
            
        } catch (error) {
            console.error('❌ Erro no debug:', error);
        }
    }

    // Métodos existentes mantidos
    async getProductByCode(code) {
        try {
            const product = await Product.findOne({
                $or: [
                    { code: code },
                    { oem_codes: code }
                ]
            });
            return product;
        } catch (error) {
            console.error('❌ Erro ao buscar produto por código:', error);
            return null;
        }
    }

    async getProductById(id) {
        try {
            const product = await Product.findById(id);
            return product;
        } catch (error) {
            console.error('❌ Erro ao buscar produto por ID:', error);
            return null;
        }
    }

    async getLowStockProducts(threshold = 5) {
        try {
            const products = await Product.find({
                stock: { $lte: threshold, $gt: 0 }
            });
            return products;
        } catch (error) {
            console.error('❌ Erro ao buscar produtos com baixo estoque:', error);
            return [];
        }
    }

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
}

module.exports = CatalogService;