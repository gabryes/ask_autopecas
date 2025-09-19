const mongoose = require('mongoose');

const messageCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ''
    },
    keywords: [{
        type: String
    }],
    count: {
        type: Number,
        default: 0
    },
    last_used: {
        type: Date,
        default: Date.now
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('MessageCategory', messageCategorySchema);