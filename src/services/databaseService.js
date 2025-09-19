const mongoose = require('mongoose');

class DatabaseService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/askAutoPecas';
            
            console.log('🔗 Conectando ao MongoDB...');
            console.log(`📍 URI: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);

            // Opções atualizadas para Mongoose 8.x
            const options = {
                // Opções básicas de conexão
                serverSelectionTimeoutMS: 5000, // Timeout para seleção do servidor
                socketTimeoutMS: 45000,          // Timeout do socket
                maxPoolSize: 10,                 // Máximo de conexões no pool
                
                // Opções removidas (não suportadas mais):
                // useNewUrlParser: true,        // Removido no Mongoose 6+
                // useUnifiedTopology: true,     // Removido no Mongoose 6+
                // bufferCommands: false,        // Removido
                // bufferMaxEntries: 0           // Esta era a opção problemática!
            };

            this.connection = await mongoose.connect(mongoUri, options);
            this.isConnected = true;

            console.log('✅ Conectado ao MongoDB com sucesso!');
            console.log(`📊 Database: ${mongoose.connection.name}`);

            // Event listeners
            mongoose.connection.on('error', (error) => {
                console.error('❌ Erro na conexão MongoDB:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.log('📴 MongoDB desconectado');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('🔄 MongoDB reconectado');
                this.isConnected = true;
            });

            return this.connection;
        } catch (error) {
            console.error('❌ Erro ao conectar ao MongoDB:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
                console.log('✅ Desconectado do MongoDB');
            }
        } catch (error) {
            console.error('❌ Erro ao desconectar do MongoDB:', error);
            throw error;
        }
    }

    getConnection() {
        return this.connection;
    }

    isConnectionActive() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }

    async testConnection() {
        try {
            if (!this.isConnectionActive()) {
                throw new Error('Não conectado ao banco de dados');
            }

            // Teste simples
            await mongoose.connection.db.admin().ping();
            console.log('✅ Teste de conexão bem-sucedido');
            return true;
        } catch (error) {
            console.error('❌ Teste de conexão falhou:', error);
            return false;
        }
    }
}

module.exports = DatabaseService;