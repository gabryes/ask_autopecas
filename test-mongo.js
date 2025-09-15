require('dotenv').config();
const { MongoClient } = require('mongodb');

console.log('🔍 Testando conexão MongoDB...');

// Verificar se a variável existe
if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI não encontrada no .env');
    console.log('📁 Verifique se o arquivo .env existe na pasta do projeto');
    process.exit(1);
}

console.log('String de conexão (censurada):', process.env.MONGODB_URI.replace(/:[^:@]*@/, ':***@'));

async function testConnection() {
    try {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        console.log('✅ Conexão MongoDB bem-sucedida!');
        
        // Testar operação básica
        const db = client.db('askAutoPecas');
        const collections = await db.listCollections().toArray();
        console.log('📊 Collections disponíveis:', collections.map(c => c.name));
        
        await client.close();
        console.log('🔒 Conexão fechada');
    } catch (error) {
        console.log('❌ Erro na conexão:', error.message);
    }
}

testConnection();