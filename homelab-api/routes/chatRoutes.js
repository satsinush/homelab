const express = require('express');
const ChatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const chatController = new ChatController();

// Chat endpoints (all require authentication)
router.post('/chat/message', requireAuth('admin'), (req, res) => chatController.sendMessage(req, res));
router.get('/chat/models', requireAuth('admin'), (req, res) => chatController.getModels(req, res));
router.post('/chat/model', requireAuth('admin'), (req, res) => chatController.setModel(req, res));
router.get('/chat/status', requireAuth('admin'), (req, res) => chatController.getStatus(req, res));
router.get('/chat/conversation', requireAuth('admin'), (req, res) => chatController.getConversationHistoryEndpoint(req, res));
router.delete('/chat/conversation', requireAuth('admin'), (req, res) => chatController.clearConversationEndpoint(req, res));

// Conversation management endpoints
router.post('/chat/conversations/cleanup', requireAuth('admin'), (req, res) => chatController.cleanupConversations(req, res));
router.delete('/chat/conversations/clear', requireAuth('admin'), (req, res) => chatController.clearAllConversations(req, res));

module.exports = router;
