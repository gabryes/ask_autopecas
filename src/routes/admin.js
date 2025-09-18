const express = require('express');
const router = express.Router();
const MessageTemplate = require('../models/MessageTemplate');
const MessageCategory = require('../models/MessageCategory');
const Product = require('../models/Product');
const Conversation = require('../models/Conversation');
const Lead = require('../models/Lead');

// ===== ROTAS DE TEMPLATES =====
router.get('/templates', async (req, res) => {
    try {
        const { category, intent, search } = req.query;
        let query = {};
        
        if (category) query.category_id = category;
        if (intent) query.intent = intent;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }
        
        const templates = await MessageTemplate.find(query)
            .populate('category_id', 'name color icon')
            .sort({ priority: -1, usage_count: -1 });
            
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/templates', async (req, res) => {
    try {
        const template = new MessageTemplate(req.body);
        await template.save();
        res.status(201).json(template);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/templates/:id', async (req, res) => {
    try {
        const template = await MessageTemplate.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!template) {
            return res.status(404).json({ error: 'Template não encontrado' });
        }
        res.json(template);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/templates/:id', async (req, res) => {
    try {
        const template = await MessageTemplate.findByIdAndDelete(req.params.id);
        if (!template) {
            return res.status(404).json({ error: 'Template não encontrado' });
        }
        res.json({ message: 'Template deletado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== ROTAS DE CATEGORIAS =====
router.get('/categories', async (req, res) => {
    try {
        const categories = await MessageCategory.find({ is_active: true })
            .sort({ order: 1, name: 1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/categories', async (req, res) => {
    try {
        const category = new MessageCategory(req.body);
        await category.save();
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ===== ESTATÍSTICAS =====
router.get('/stats', async (req, res) => {
    try {
        const stats = await Promise.all([
            MessageTemplate.countDocuments(),
            MessageTemplate.countDocuments({ is_active: true }),
            MessageCategory.countDocuments({ is_active: true }),
            Product.countDocuments(),
            Conversation.countDocuments({
                timestamp: { 
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
                }
            }),
            Lead.countDocuments()
        ]);
        
        const templateStats = await MessageTemplate.aggregate([
            {
                $group: {
                    _id: '$intent',
                    count: { $sum: 1 },
                    total_usage: { $sum: '$usage_count' }
                }
            },
            { $sort: { total_usage: -1 } }
        ]);
        
        res.json({
            total_templates: stats[0],
            active_templates: stats[1],
            total_categories: stats[2],
            total_products: stats[3],
            conversations_today: stats[4],
            total_leads: stats[5],
            template_stats: templateStats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;