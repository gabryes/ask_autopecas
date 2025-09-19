const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    whatsapp_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['new', 'qualified', 'quoted', 'converted', 'lost', 'escalated'],
        default: 'new',
        index: true
    },
    last_interaction: {
        type: Date,
        default: Date.now
    },
    products_interested: [{
        product_id: String,
        product_name: String,
        inquired_at: {
            type: Date,
            default: Date.now
        }
    }],
    notes: {
        type: String,
        default: ''
    },
    escalated_at: {
        type: Date
    },
    converted_at: {
        type: Date
    },
    total_interactions: {
        type: Number,
        default: 1
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Índices para melhor performance
leadSchema.index({ status: 1, created_at: -1 });
leadSchema.index({ last_interaction: -1 });

module.exports = mongoose.model('Lead', leadSchema);