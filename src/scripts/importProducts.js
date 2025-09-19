// src/scripts/importProducts.js
require('dotenv').config(); // Carrega variáveis de ambiente
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const Product = require('../models/Product'); // O caminho está correto para src/models/Product

// ✅ MUDANÇA: Agora aponta para data/products.csv
const csvFilePath = path.join(process.cwd(), 'data', 'products.csv'); 

async function importProducts() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-autopecas';
        await mongoose.connect(mongoUri);
        console.log('✅ Conectado ao MongoDB.');
        
        // ✅ Verificar se o arquivo existe
        if (!fs.existsSync(csvFilePath)) {
            console.error(`❌ Arquivo CSV não encontrado: ${csvFilePath}`);
            console.log('💡 Certifique-se de que o arquivo está em: data/products.csv');
            process.exit(1);
        }
        
        console.log(`📄 Lendo arquivo: ${csvFilePath}`);

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
                
                // ✅ Log do progresso a cada 10 produtos
                if (productsToInsert.length % 10 === 0 && productsToInsert.length > 0) {
                    console.log(`📦 Processados ${productsToInsert.length} produtos...`);
                }
                
                productsToInsert.push(productData);
            })
            .on('end', async () => {
                console.log(`✨ CSV lido. Total de ${productsToInsert.length} produtos para inserir.`);
                
                // ✅ Verificar produtos existentes antes da inserção
                let insertedCount = 0;
                let skippedCount = 0;
                let errorCount = 0;
                
                console.log('🔍 Verificando produtos existentes...');
                
                for (const productData of productsToInsert) {
                    try {
                        // Verificar se produto já existe por ID ou código
                        const existingProduct = await Product.findOne({
                            $or: [
                                { id: productData.id },
                                { code: productData.code }
                            ]
                        });
                        
                        if (existingProduct) {
                            console.log(`⏭️ Produto ${productData.id} já existe, pulando...`);
                            skippedCount++;
                        } else {
                            // Inserir produto novo
                            await Product.create(productData);
                            console.log(`✅ Produto ${productData.id} inserido: ${productData.name}`);
                            insertedCount++;
                        }
                    } catch (error) {
                        console.error(`❌ Erro ao inserir produto ${productData.id}:`, error.message);
                        errorCount++;
                    }
                }
                
                // ✅ Relatório final
                console.log('\n🎉 Importação concluída!');
                console.log(`✅ Produtos inseridos: ${insertedCount}`);
                console.log(`⏭️ Produtos já existentes (pulados): ${skippedCount}`);
                console.log(`❌ Erros: ${errorCount}`);
                console.log(`📊 Total processado: ${productsToInsert.length}`);
                
                // Verificar total no banco
                const totalInDB = await Product.countDocuments();
                console.log(`🗄️ Total de produtos no banco agora: ${totalInDB}`);
                
                await mongoose.disconnect();
                console.log('🔌 Conexão com MongoDB fechada.');
                process.exit(0);
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