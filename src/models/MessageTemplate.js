const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    category_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MessageCategory',
        required: true,
        index: true
    },
    intent: {
        type: String,
        enum: [
            'greeting', 'search_part', 'check_compatibility', 'ask_price', 
            'check_stock', 'request_quote', 'escalate_to_human', 
            'select_option', 'goodbye', 'general_inquiry', 'catalog_request',
            'help_request', 'no_products_found'
        ],
        required: true,
        index: true
    },
    keywords: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    variables: [{
        name: String,
        description: String,
        default_value: String,
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
        default: true,
        index: true
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    created_by: {
        type: String,
        default: 'system'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Índices para performance
messageTemplateSchema.index({ intent: 1, is_active: 1 });
messageTemplateSchema.index({ keywords: 1, is_active: 1 });
messageTemplateSchema.index({ category_id: 1, priority: -1 });

// Middleware para atualizar updated_at
messageTemplateSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Métodos estáticos
messageTemplateSchema.statics.findByIntent = function(intent) {
    return this.find({ 
        intent: intent, 
        is_active: true 
    }).sort({ priority: -1, usage_count: -1 });
};

messageTemplateSchema.statics.findByKeywords = function(keywords) {
    const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
    return this.find({
        keywords: { $in: keywordArray },
        is_active: true
    }).sort({ priority: -1 });
};

// Métodos de instância
messageTemplateSchema.methods.incrementUsage = function() {
    this.usage_count += 1;
    this.last_used = new Date();
    return this.save();
};

messageTemplateSchema.methods.processVariables = function(variables = {}) {
    let processedContent = this.content;
    
    this.variables.forEach(variable => {
        const placeholder = `{{${variable.name}}}`;
        const value = variables[variable.name] || variable.default_value || '';
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return processedContent;
};

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);