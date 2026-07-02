const express = require('express');
const ChatController = require('../controllers/chatController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const chatController = new ChatController();

// Chat endpoints (all require authentication)
router.post('/chat/message', requireAuth('dashboard-chat-user'), (req, res) => chatController.sendChatMessage(req, res));
router.get('/chat/models', requireAuth('dashboard-chat-user'), (req, res) => chatController.getModels(req, res));
router.post('/chat/model', requireAuth('dashboard-chat-user'), (req, res) => chatController.setModel(req, res));
router.get('/chat/status', requireAuth('dashboard-chat-user'), (req, res) => chatController.getStatus(req, res));
router.get('/chat/conversation', requireAuth('dashboard-chat-user'), (req, res) => chatController.getConversationHistoryEndpoint(req, res));
router.delete('/chat/conversation', requireAuth('dashboard-chat-user'), (req, res) => chatController.clearConversationEndpoint(req, res));

// Model management endpoints
router.get('/chat/check-model/:modelName', requireAuth('dashboard-chat-user'), (req, res) => chatController.checkModelAvailability(req, res));
router.get('/chat/models-detailed', requireAuth('dashboard-chat-user'), (req, res) => chatController.getDetailedModels(req, res));
router.post('/chat/download-model', requireAuth('dashboard-chat-user'), (req, res) => chatController.downloadModel(req, res));
router.delete('/chat/delete-model/:modelName', requireAuth('dashboard-chat-user'), (req, res) => chatController.deleteModel(req, res));

// Conversation management endpoints
router.post('/chat/conversations/cleanup', requireAuth('dashboard-chat-user'), (req, res) => chatController.cleanupConversations(req, res));
router.delete('/chat/conversations/clear', requireAuth('dashboard-chat-user'), (req, res) => chatController.clearAllConversations(req, res));

module.exports = router;
