const mongoose = require('mongoose');

const messageCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    color: {
        type: String,
        default: '#3498db',
        match: /^#[0-9A-F]{6}$/i
    },
    icon: {
        type: String,
        default: '💬'
    },
    parent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MessageCategory',
        default: null
    },
    order: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: true
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

// Middleware
messageCategorySchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Métodos estáticos
messageCategorySchema.statics.getHierarchy = function() {
    return this.aggregate([
        { $match: { is_active: true } },
        {
            $lookup: {
                from: 'messagetemplates',
                localField: '_id',
                foreignField: 'category_id',
                as: 'templates'
            }
        },
        {
            $addFields: {
                template_count: { $size: '$templates' }
            }
        },
        { $sort: { order: 1, name: 1 } }
    ]);
};

module.exports = mongoose.model('MessageCategory', messageCategorySchema);