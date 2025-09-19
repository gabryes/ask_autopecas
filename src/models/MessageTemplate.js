const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    variables: [{
        name: String,
        description: String,
        required: {
            type: Boolean,
            default: false
        }
    }],
    usage_count: {
        type: Number,
        default: 0
    },
    last_used: {
        type: Date
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);