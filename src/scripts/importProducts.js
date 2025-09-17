// src/scripts/importProducts.js
require('dotenv').config(); // Carrega variáveis de ambiente
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const Product = require('../models/Product'); // O caminho está correto para src/models/Product

// Usa process.cwd() que retorna o diretório de onde o comando 'node' foi executado (raiz do projeto).
const csvFilePath = path.join(process.cwd(), 'novos_produtos.csv'); 

async function importProducts() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-autopecas';
        await mongoose.connect(mongoUri);
        console.log('✅ Conectado ao MongoDB.');

        const productsToInsert = [];

        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (row) => {
                // Mapeia os dados do CSV para o formato do seu schema Product
                // Adicionadas verificações e fallbacks para robustez
                const productData = {
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    brand: row.brand,
                    category: row.category,
                    price: row.price ? parseFloat(row.price) : 0, // Fallback para 0 se undefined
                    stock: row.stock ? parseInt(row.stock) : 0, // Fallback para 0 se undefined
                    // Verifica se row.compatibility existe antes de chamar split()
                    compatibility: row.compatibility ? row.compatibility.split('|').map(s => s.trim()).filter(s => s) : [],
                    description: row.description || '', // Fallback para string vazia
                    image: row.image || '', // Fallback para string vazia
                    // Verifica se row.oem_codes existe antes de chamar split()
                    oem_codes: row.oem_codes ? row.oem_codes.split('|').map(s => s.trim()).filter(s => s) : [],
                    installation_difficulty: row.installation_difficulty || 'médio', // Fallback
                    warranty_months: row.warranty_months ? parseInt(row.warranty_months) : 0, // Fallback
                    weight: row.weight ? parseFloat(row.weight) : 0, // Fallback
                    dimensions: {
                        length: row.dimensions_length ? parseFloat(row.dimensions_length) : 0,
                        width: row.dimensions_width ? parseFloat(row.dimensions_width) : 0,
                        height: row.dimensions_height ? parseFloat(row.dimensions_height) : 0
                    },
                    supplier: {
                        name: row.supplier_name || 'Desconhecido', // Fallback
                        code: row.supplier_code || '', // Fallback
                        lead_time_days: row.supplier_lead_time_days ? parseInt(row.supplier_lead_time_days) : 0 // Fallback
                    },
                    is_active: true // Garante que produtos importados estejam ativos por padrão
                };
                productsToInsert.push(productData);
            })
            .on('end', async () => {
                console.log(`✨ CSV lido. Total de ${productsToInsert.length} produtos para inserir.`);
                try {
                    // Insere todos os produtos de uma vez
                    // ordered: false faz com que a inserção continue mesmo se houver erros de duplicidade
                    await Product.insertMany(productsToInsert, { ordered: false });
                    console.log('📦 Todos os produtos do CSV importados com sucesso!');
                } catch (error) {
                    if (error.code === 11000) { // Erro de duplicidade (duplicata de id ou code)
                        console.warn('⚠️ Alguns produtos já existem (ID ou Código duplicado). Os duplicados foram ignorados.');
                    } else {
                        console.error('❌ Erro ao inserir produtos no MongoDB:', error);
                    }
                } finally {
                    await mongoose.disconnect();
                    console.log('🔌 Conexão com MongoDB fechada.');
                    process.exit(0);
                }
            })
            .on('error', (error) => {
                console.error('❌ Erro ao ler o arquivo CSV:', error);
                mongoose.disconnect();
                process.exit(1);
            });

    } catch (error) {
        console.error('❌ Erro de conexão com MongoDB:', error);
        process.exit(1);
    }
}

importProducts();