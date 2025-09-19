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
        default: 'general_inquiry'
    },
    confidence: {
        type: Number,
        default: 0.5
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
    entities: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Índices para melhor performance
conversationSchema.index({ whatsapp_id: 1, timestamp: -1 });
conversationSchema.index({ intent: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);