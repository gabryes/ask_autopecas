const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    whatsapp_id: {
        type: String,
        required: true,
        index: true
    },
    user_message: {
        type: String,
        required: true
    },
    bot_response: {
        type: String,
        required: true
    },
    intent: {
        type: String,
        enum: [
            'greeting', 'search_part', 'check_compatibility', 'ask_price', 
            'check_stock', 'request_quote', 'escalate_to_human', 
            'select_option', 'goodbye', 'general_inquiry'
        ],
        default: 'general_inquiry'
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },
    tokens_used: {
        type: Number,
        default: 0
    },
    processing_time: {
        type: Number, // em millisegundos
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    session_id: {
        type: String,
        index: true
    },
    metadata: {
        user_agent: String,
        ip_address: String,
        platform: String
    }
});

// Índices compostos para melhor performance
conversationSchema.index({ whatsapp_id: 1, timestamp: -1 });
conversationSchema.index({ intent: 1, timestamp: -1 });

// Middleware para limpar conversas antigas (opcional)
conversationSchema.statics.cleanOldConversations = async function(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await this.deleteMany({ timestamp: { $lt: cutoffDate } });
    console.log(`🧹 Limpeza: ${result.deletedCount} conversas antigas removidas`);
    return result;
};

module.exports = mongoose.model('Conversation', conversationSchema);