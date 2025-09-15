const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        text: true // Para busca de texto
    },
    brand: {
        type: String,
        required: true,
        index: true
    },
    category: {
        type: String,
        required: true,
        enum: ['freios', 'filtros', 'motor', 'suspensao', 'eletrica', 'carroceria', 'transmissao'],
        index: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        index: true
    },
    compatibility: [{
        type: String,
        required: true
    }],
    description: {
        type: String,
        required: true
    },
    image: String,
    oem_codes: [String],
    installation_difficulty: {
        type: String,
        enum: ['fácil', 'médio', 'difícil'],
        default: 'médio'
    },
    warranty_months: {
        type: Number,
        default: 12
    },
    weight: Number, // em kg
    dimensions: {
        length: Number,
        width: Number,
        height: Number
    },
    supplier: {
        name: String,
        code: String,
        lead_time_days: Number
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    },
    is_active: {
        type: Boolean,
        default: true
    }
});

// Índices para melhor performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, brand: 1 });
productSchema.index({ price: 1, stock: 1 });

// Middleware
productSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Métodos estáticos
productSchema.statics.searchByText = function(query) {
    return this.find({
        $text: { $search: query },
        is_active: true,
        stock: { $gt: 0 }
    }).sort({ score: { $meta: 'textScore' } });
};

productSchema.statics.findByCompatibility = function(vehicle) {
    const searchPattern = new RegExp(`${vehicle.marca}.*${vehicle.modelo}`, 'i');
    return this.find({
        compatibility: { $regex: searchPattern },
        is_active: true,
        stock: { $gt: 0 }
    });
};

module.exports = mongoose.model('Product', productSchema);