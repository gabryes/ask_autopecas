const mongoose = require('mongoose');

const connectDatabase = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot-autopecas';
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ MongoDB conectado com sucesso');
        
        // Event listeners para conexão
        mongoose.connection.on('error', (err) => {
            console.error('❌ Erro na conexão MongoDB:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('📴 MongoDB desconectado');
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('📴 Conexão MongoDB fechada devido ao encerramento da aplicação');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error);
        
        // Se não conseguir conectar, usar dados em memória
        console.log('⚠️ Usando dados em memória (sem persistência)');
        return null;
    }
};

module.exports = { connectDatabase };