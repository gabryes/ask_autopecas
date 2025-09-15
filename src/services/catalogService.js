const fs = require('fs').promises;
const path = require('path');

class CatalogService {
    constructor() {
        this.catalogPath = path.join(__dirname, '../../data/autopecas-catalog.json');
        this.catalog = [];
        this.loadCatalog();
    }

    async loadCatalog() {
        try {
            const data = await fs.readFile(this.catalogPath, 'utf8');
            this.catalog = JSON.parse(data);
            console.log(`✅ Catálogo carregado: ${this.catalog.length} produtos`);
        } catch (error) {
            console.log('⚠️ Catálogo não encontrado, criando catálogo demo...');
            await this.createDemoCatalog();
        }
    }

    async createDemoCatalog() {
        const demoCatalog = [
            {
                id: "001",
                code: "0986494291",
                name: "Pastilha de Freio Dianteira",
                brand: "Bosch",
                category: "freios",
                price: 89.90,
                stock: 15,
                compatibility: ["Honda Civic 2012-2016", "Honda HR-V 2015-2022"],
                description: "Pastilha de freio original Bosch, alta durabilidade",
                image: "/images/pastilha-bosch-001.jpg",
                oem_codes: ["45022-TR0-A01", "45022-TR7-A01"],
                installation_difficulty: "fácil",
                warranty_months: 12
            },
            {
                id: "002",
                code: "573029J",
                name: "Pastilha de Freio Traseira",
                brand: "Jurid",
                category: "freios",
                price: 67.50,
                stock: 8,
                compatibility: ["Honda Civic 2012-2016"],
                description: "Pastilha traseira Jurid, excelente custo-benefício",
                image: "/images/pastilha-jurid-002.jpg",
                oem_codes: ["43022-TR0-A01"],
                installation_difficulty: "fácil",
                warranty_months: 6
            },
            {
                id: "003",
                code: "F026407006",
                name: "Filtro de Óleo",
                brand: "Bosch",
                category: "filtros",
                price: 23.90,
                stock: 45,
                compatibility: ["Toyota Corolla 2015-2024", "Toyota RAV4 2013-2024"],
                description: "Filtro de óleo Bosch original, máxima proteção",
                image: "/images/filtro-oleo-bosch-003.jpg",
                oem_codes: ["90915-YZZD4", "15601-44011"],
                installation_difficulty: "fácil",
                warranty_months: 6
            },
            {
                id: "004",
                code: "VKM74002",
                name: "Kit Correia Dentada",
                brand: "SKF",
                category: "motor",
                price: 245.00,
                stock: 3,
                compatibility: ["Volkswagen Gol 1.0 2013-2020"],
                description: "Kit completo com correia, tensor e roldanas",
                image: "/images/kit-correia-skf-004.jpg",
                oem_codes: ["030109119K", "030109243F"],
                installation_difficulty: "difícil",
                warranty_months: 24
            },
            {
                id: "005",
                code: "7891118066032",
                name: "Amortecedor Dianteiro",
                brand: "Cofap",
                category: "suspensao",
                price: 156.80,
                stock: 6,
                compatibility: ["Chevrolet Onix 2012-2019", "Chevrolet Prisma 2013-2019"],
                description: "Amortecedor dianteiro Cofap, conforto e segurança",
                image: "/images/amortecedor-cofap-005.jpg",
                oem_codes: ["52079162", "52079163"],
                installation_difficulty: "médio",
                warranty_months: 12
            }
        ];

        // Criar diretório se não existir
        const dataDir = path.dirname(this.catalogPath);
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            // Diretório já existe
        }

        await fs.writeFile(this.catalogPath, JSON.stringify(demoCatalog, null, 2));
        this.catalog = demoCatalog;
        console.log('✅ Catálogo demo criado');
    }

    // MÉTODOS PARA COMPATIBILIDADE COM MESSAGECONTROLLER
    getAllProducts() {
        return this.catalog;
    }

    getProductCount() {
        return this.catalog.length;
    }

    searchProducts(query, filters = {}) {
        if (!query) {
            return this.getAllProducts();
        }

        let results = this.catalog;

        // Busca por texto melhorada
        const searchTerms = query.toLowerCase().split(' ');
        results = results.filter(product => {
            const searchText = `${product.name} ${product.brand} ${product.category} ${product.compatibility.join(' ')} ${product.code} ${product.description}`.toLowerCase();
            
            // Buscar por qualquer termo
            return searchTerms.some(term => searchText.includes(term));
        });

        // Aplicar filtros
        if (filters.category) {
            results = results.filter(p => p.category === filters.category);
        }

        if (filters.brand) {
            results = results.filter(p => p.brand.toLowerCase() === filters.brand.toLowerCase());
        }

        if (filters.maxPrice) {
            results = results.filter(p => p.price <= filters.maxPrice);
        }

        if (filters.inStock) {
            results = results.filter(p => p.stock > 0);
        }

        // Ordenar por relevância (estoque > preço)
        results.sort((a, b) => {
            if (a.stock > 0 && b.stock === 0) return -1;
            if (a.stock === 0 && b.stock > 0) return 1;
            return a.price - b.price;
        });

        return results;
    }

    getProductByCode(code) {
        return this.catalog.find(product => 
            product.code === code || 
            product.oem_codes.includes(code)
        );
    }

    getProductById(id) {
        return this.catalog.find(product => product.id === id);
    }

    checkCompatibility(productId, vehicle) {
        const product = this.getProductById(productId);
        if (!product) return false;

        const vehicleString = `${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`.toLowerCase();
        return product.compatibility.some(comp => 
            vehicleString.includes(comp.toLowerCase()) ||
            comp.toLowerCase().includes(vehicleString)
        );
    }

    calculatePrice(productId, customerType = 'retail', quantity = 1) {
        const product = this.getProductById(productId);
        if (!product) return null;

        let price = product.price;

        // Desconto por tipo de cliente
        if (customerType === 'wholesale' && quantity >= 5) {
            price *= (1 - (process.env.DISCOUNT_WHOLESALE / 100 || 10));
        }

        // Desconto por quantidade
        if (quantity >= 10) {
            price *= 0.95; // 5% desconto
        } else if (quantity >= 5) {
            price *= 0.97; // 3% desconto
        }

        return {
            unit_price: product.price,
            final_price: price,
            total: price * quantity,
            discount_applied: product.price - price,
            quantity: quantity
        };
    }

    getPopularProducts(limit = 5) {
        return this.catalog
            .filter(p => p.stock > 0)
            .sort((a, b) => b.stock - a.stock)
            .slice(0, limit);
    }

    getLowStockProducts(threshold = 5) {
        return this.catalog.filter(p => p.stock <= threshold && p.stock > 0);
    }
}

module.exports = CatalogService;