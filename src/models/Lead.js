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
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['new', 'qualified', 'quoted', 'escalated', 'converted', 'lost'],
        default: 'new',
        index: true
    },
    profile: {
        customerType: {
            type: String,
            enum: ['retail', 'wholesale', 'mechanic', 'workshop'],
            default: 'retail'
        },
        vehicleInfo: {
            marca: String,
            modelo: String,
            ano: Number,
            motor: String
        },
        preferredBrands: [String],
        averageTicket: {
            type: Number,
            default: 0
        },
        location: {
            city: String,
            state: String,
            zipcode: String
        }
    },
    interactions: {
        total_messages: { 
            type: Number, 
            default: 0 
        },
        last_interaction: {
            type: Date,
            default: Date.now
        },
        products_viewed: [{
            product_id: String,
            viewed_at: Date,
            interest_level: {
                type: String,
                enum: ['low', 'medium', 'high'],
                default: 'medium'
            }
        }],
        quotes_requested: {
            type: Number,
            default: 0
        },
        total_value_quoted: {
            type: Number,
            default: 0
        }
    },
    source: {
        type: String,
        enum: ['whatsapp', 'website', 'referral', 'social_media'],
        default: 'whatsapp'
    },
    tags: [String],
    notes: [{
        content: String,
        created_by: String,
        created_at: {
            type: Date,
            default: Date.now
        }
    }],
    escalated_at: Date,
    converted_at: Date,
    conversion_value: Number,
    created_at: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    updated_at: { 
        type: Date, 
        default: Date.now 
    }
});

// Middleware para atualizar updated_at
leadSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Métodos estáticos úteis
leadSchema.statics.getActiveLeads = function() {
    return this.find({ 
        status: { $in: ['new', 'qualified', 'quoted'] },
        'interactions.last_interaction': { 
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // últimos 7 dias
        }
    });
};

leadSchema.statics.getConversionStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalValue: { $sum: '$conversion_value' }
            }
        }
    ]);
};

// Métodos de instância
leadSchema.methods.addInteraction = function() {
    this.interactions.total_messages += 1;
    this.interactions.last_interaction = new Date();
    return this.save();
};

leadSchema.methods.addProductView = function(productId, interestLevel = 'medium') {
    this.interactions.products_viewed.push({
        product_id: productId,
        viewed_at: new Date(),
        interest_level: interestLevel
    });
    return this.save();
};

module.exports = mongoose.model('Lead', leadSchema);