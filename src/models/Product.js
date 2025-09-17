const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        trim: true // Adicionado para remover espaços em branco no início/fim
    },
    code: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true // Adicionado
    },
    name: {
        type: String,
        required: true,
        text: true, // Para busca de texto
        trim: true // Adicionado
    },
    brand: {
        type: String,
        required: true,
        index: true,
        trim: true // Adicionado
    },
    category: {
        type: String,
        required: true,
        enum: ['freios', 'filtros', 'motor', 'suspensao', 'eletrica', 'carroceria', 'transmissao'],
        index: true,
        trim: true // Adicionado
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
        required: true,
        trim: true // Adicionado
    }],
    description: {
        type: String,
        required: true,
        trim: true // Adicionado
    },
    image: {
        type: String,
        trim: true // Adicionado
    },
    oem_codes: [{ // Array de strings, trim em cada elemento ao salvar
        type: String,
        trim: true
    }],
    installation_difficulty: {
        type: String,
        enum: ['fácil', 'médio', 'difícil'],
        default: 'médio',
        trim: true // Adicionado
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
        name: {
            type: String,
            trim: true // Adicionado
        },
        code: {
            type: String,
            trim: true // Adicionado
        },
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

// Middleware para atualizar 'updated_at'
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
    }).sort({ score: { $meta: 'textScore' } }); // Ordena por relevância do texto
};

productSchema.statics.findByCompatibility = function(vehicle) {
    // Regex mais robusta para compatibilidade (busca por marca e modelo, ignorando case)
    const searchPattern = new RegExp(`${vehicle.marca}.*${vehicle.modelo}`, 'i');
    return this.find({
        compatibility: { $regex: searchPattern }, // Busca por regex nos campos de compatibilidade
        is_active: true,
        stock: { $gt: 0 }
    });
};

module.exports = mongoose.model('Product', productSchema);