import express, { Request, Response } from 'express';
import ChatController from '../controllers/chatController';
import { requireAuth } from '../middleware/authMiddleware';

const router = express.Router();
const chatController = new ChatController();

/**
 * @openapi
 * tags:
 *   name: Chat
 *   description: AI Chat assistant and Ollama model configuration
 */

// Chat endpoints (all require authentication)
/**
 * @openapi
 * /api/chat/message:
 *   post:
 *     summary: Send message to the AI Chat assistant
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message reply payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/chat/message', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.sendChatMessage(req, res));

/**
 * @openapi
 * /api/chat/models:
 *   get:
 *     summary: Retrieve list of available Ollama model tags
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Models list
 */
router.get('/chat/models', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.getModels(req, res));

/**
 * @openapi
 * /api/chat/model:
 *   post:
 *     summary: Set active Ollama model to use
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *             properties:
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Active model updated
 */
router.post('/chat/model', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.setModel(req, res));

/**
 * @openapi
 * /api/chat/status:
 *   get:
 *     summary: Retrieve Ollama server status
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Connection status
 */
router.get('/chat/status', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.getStatus(req, res));

/**
 * @openapi
 * /api/chat/conversation:
 *   get:
 *     summary: Get conversation history for current user
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: History object
 */
router.get('/chat/conversation', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.getConversationHistoryEndpoint(req, res));

/**
 * @openapi
 * /api/chat/conversation:
 *   delete:
 *     summary: Clear active conversation history
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active history cleared
 */
router.delete('/chat/conversation', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.clearConversationEndpoint(req, res));

// Model management endpoints
/**
 * @openapi
 * /api/chat/check-model/{modelName}:
 *   get:
 *     summary: Check if a specific model tag is downloaded
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability boolean flag
 */
router.get('/chat/check-model/:modelName', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.checkModelAvailability(req, res));

/**
 * @openapi
 * /api/chat/models-detailed:
 *   get:
 *     summary: Retrieve detailed package info of downloaded Ollama models
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Detailed models array
 */
router.get('/chat/models-detailed', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.getDetailedModels(req, res));

/**
 * @openapi
 * /api/chat/download-model:
 *   post:
 *     summary: Pull/download a model from Ollama library registry
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *             properties:
 *               model:
 *                 type: string
 *     responses:
 *       200:
 *         description: Download process triggered
 */
router.post('/chat/download-model', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.downloadModel(req, res));

/**
 * @openapi
 * /api/chat/delete-model/{modelName}:
 *   delete:
 *     summary: Delete a downloaded Ollama model
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: modelName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Model deleted
 */
router.delete('/chat/delete-model/:modelName', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.deleteModel(req, res));

// Conversation management endpoints
/**
 * @openapi
 * /api/chat/conversations/cleanup:
 *   post:
 *     summary: Clean up old chat logs (Admin only helper)
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed
 */
router.post('/chat/conversations/cleanup', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.cleanupConversations(req, res));

/**
 * @openapi
 * /api/chat/conversations/clear:
 *   delete:
 *     summary: Clear all stored user chat session logs (Admin only helper)
 *     tags: [Chat]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cleared all
 */
router.delete('/chat/conversations/clear', requireAuth('dashboard-chat-user'), (req: Request, res: Response) => chatController.clearAllConversations(req, res));

export default router;
