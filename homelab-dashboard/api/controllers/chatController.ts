import { Request, Response } from 'express';
import DatabaseModel from '../models/Database';
import Chat from '../models/Chat';
import SystemController from '../controllers/systemController';
import DeviceController from '../controllers/deviceController';
import OllamaService from '../services/ollamaService';
import { formatMacForDisplay } from '../utils/formatters';
import { sendError, sendSuccess } from '../utils/response';

const systemController = new SystemController();
const deviceController = new DeviceController();

class ChatController {
    private modelName: string | null;
    private ollamaService: OllamaService;
    private db: any;
    private chatModel: Chat;
    private maxTokens: number;
    private conversationTTL: number;
    private maxExchangesPerConversation: number;
    private cleanupInterval: NodeJS.Timeout | null;

    constructor() {
        this.modelName = null;
        this.ollamaService = new OllamaService();
        this.db = DatabaseModel.getDatabase();
        this.chatModel = new Chat();
        this.maxTokens = 2048;
        this.conversationTTL = 24 * 60 * 60 * 1000;
        this.maxExchangesPerConversation = 100;
        this.cleanupInterval = null;
        this.initializeModel();
        
        this.startCleanupInterval();
    }

    async getSystemPrompt(userId: number): Promise<string> {
        const systemInfo = JSON.stringify(await systemController.getSystemPromptInfo());
        const deviceInfo = deviceController.getDevicePromptInfo(userId);

        const fullSystemPrompt =
        `You are HomeBot, a helpful AI assistant for a homelab management dashboard.
        Your primary role is to assist users with technical questions, troubleshooting, system administration, and general computing topics related to their homelab.
        You also have the ability to perform certain actions on devices in the homelab specified in the list of available actions.
        Assume responding with the correct JSON will execute the action if it is valid and the parameters are correct. There is no need to explain or instruct the user to perform the task.

        --- Output Format ---
        **You MUST always reply in the following JSON format:**
        \`\`\`json
        {
          "message": "<your text response here>",
          "actions": [ /* array of action objects, empty if no action */ ]
        }
        \`\`\`
        
        --- Instructions ---
        1.  **Conciseness & Accuracy:** Be concise, accurate, and practical in your text responses (the "message" field).
        2.  **Uncertainty:** If you're unsure about something or lack necessary information, state it in the "message" field.
        3.  **Action Requests:**
            * If a user's request clearly indicates one or more actions from the "Available actions" list:
                * Populate the "actions" array with the specific JSON payload(s) for the requested action(s).
                * Include a brief, relevant confirmation or explanation in the "message" field (e.g., "Okay, initiating Wake-on-LAN for that device.").
                * You MUST extract any necessary parameters (like MAC addresses, service names, or paths) from the "System Information" and "Saved devices" provided. Do NOT guess or invent values.
                * If a required parameter is missing or the device/service cannot be found in the provided information for an action:
                    * Set the "message" field to explain why the action cannot be performed.
                    * The "actions" array should be empty.
                * If the requested action is not in the "Available actions" list:
                    * Set the "message" field to "The requested action is not supported."
                    * The "actions" array should be empty.
        4.  **General Questions/Statements:**
            * If the user asks a general question or makes a statement that is NOT an action request:
                * Provide a concise, direct answer in the "message" field based on the provided information.
                * The "actions" array MUST be empty (i.e., \`[]\`).
        5.  **Domain:** Only help with homelab-related topics. If a question is outside this domain, set the "message" to "I cannot assist with that topic." and the "actions" array to empty.

        --- Available actions (Use these exact "action" values for 'action' key) ---
        - Wake-on-LAN (Send a magic packet to wake up a specified device): { "action": "wol", "mac": "<MAC_ADDRESS_OF_DEVICE>" }

        --- Information for your use ---
        System Information: ${systemInfo}
        Saved devices: ${deviceInfo}
        `;
        return fullSystemPrompt;
    }

    // Initialize with the first available model
    async initializeModel() {
        try {
            const availableModels = await this.getAvailableModelsList();
            
            if (availableModels.length === 0) {
                console.warn('No Ollama models found. Please install a model first.');
                return;
            }

            this.modelName = availableModels[0];
            console.log(`Initialized with first available model: ${this.modelName}, max tokens: ${this.maxTokens}`);

        } catch (error: any) {
            console.warn('Failed to initialize model, using fallback:', error.message);
        }
    }

    // Helper method to get available models list
    async getAvailableModelsList(): Promise<string[]> {
        try {
            const modelNames = await this.ollamaService.getModelNames();
            return modelNames;
        } catch (error: any) {
            console.warn('Failed to get available models via service:', error.message);
            return [];
        }
    }

    // Estimate token count for text using simple character-based estimation
    estimateTokens(text: string): number {
        return this.ollamaService.estimateTokens(text);
    }

    // Build messages array for Ollama API
    async buildMessagesArray(userId: number): Promise<any[]> {
        const systemPrompt = await this.getSystemPrompt(userId);
        const messages: any[] = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];

        const conversationMessages = this.getConversationFromDatabase(userId);
        if (conversationMessages && conversationMessages.length > 0) {
            const historyMessages = conversationMessages.slice(1);
            
            let totalTokens = this.estimateTokens(systemPrompt) + 10;
            const maxHistoryTokens = Math.floor(this.maxTokens * 0.8);
            
            const messagesToInclude = [];
            for (let i = historyMessages.length - 1; i >= 0; i--) {
                const message = historyMessages[i];
                const messageTokens = this.estimateTokens(message.content) + 10;
                
                if (totalTokens + messageTokens <= maxHistoryTokens) {
                    messagesToInclude.unshift(message);
                    totalTokens += messageTokens;
                } else {
                    break;
                }
            }
            
            messages.push(...messagesToInclude);
            console.log(`Building prompt with ${messagesToInclude.length} messages, total tokens: ${totalTokens}`);
        }

        return messages;
    }

    // Get conversation from database
    getConversationFromDatabase(userId: number): any[] {
        try {
            const conversation = this.chatModel.getConversation(userId);
            if (!conversation || conversation.length === 0) {
                console.log('No conversation found for user:', userId);
                return [{ role: 'system', content: "" }];
            }
            return conversation;
        } catch (error) {
            console.error('Error getting conversation from database:', error);
            return [{ role: 'system', content: "" }];
        }
    }

    // Save conversation to database
    saveConversationToDatabase(userId: number, messages: any[]) {
        this.chatModel.saveConversation(userId, messages);
    }

    // Add a message to conversation history
    addToConversationHistory(userId: number, message: any) {
        const conversation = this.getConversationFromDatabase(userId);
        conversation.push(message);
        
        const maxMessages = 201;
        if (conversation.length > maxMessages) {
            const messagesToRemove = conversation.length - maxMessages;
            conversation.splice(1, messagesToRemove);
        }
        
        this.saveConversationToDatabase(userId, conversation);
        console.log(`Added message to conversation for user ${userId}. Total messages: ${conversation.length}`);
    }

    // Send a message to Ollama and get response
    async sendChatMessage(req: Request, res: Response) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!this.modelName) {
                await this.initializeModel();
                if (!this.modelName) {
                    return sendError(res, 503, 'Chat service is not available. No AI models found.');
                }
            }

            const { message } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                console.log('Authentication failed - no userId in req.user');
                return sendError(res, 401, 'Authentication required to use chat');
            }

            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                return sendError(res, 400, 'Message is required and cannot be empty');
            }

            if (message.trim().length > 1000) {
                return sendError(res, 400, 'Message must be 1000 characters or less');
            }

            console.log(`Chat request from user ${userId}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
            
            this.addToConversationHistory(userId, {
                role: 'user',
                content: message,
                message: message,
                actions: []
            });
            
            const startTime = Date.now();
            const response = await this.generateOllamaResponse(userId, message);
            const responseTime = Date.now() - startTime;

            const responseMessage = response.trim();
            const parsedMessage = this.parseMessage(responseMessage);
            const actionsExecuted = parsedMessage?.actions ? await this.executeActions(parsedMessage.actions) : [];

            this.addToConversationHistory(userId, {
                role: 'assistant',
                content: responseMessage,
                message: parsedMessage?.message || 'Error processing response',
                actions: actionsExecuted
            });

            const conversationHistory = this.getConversationHistory(userId);

            return sendSuccess(res, {
                content: responseMessage,
                message: parsedMessage?.message || 'Error processing response',
                conversationHistory: conversationHistory,
                timestamp: new Date().toISOString(),
                responseTime: responseTime,
                model: this.modelName,
                actions: actionsExecuted,
            });

        } catch (error: any) {
            console.error('Chat error:', error);

            const userId = req.user?.id;
            if (userId) {
                this.addToConversationHistory(userId, {
                    role: 'assistant',
                    content: `Message failed: ${error.message}`,
                    message: "Error processing your request",
                    actions: []
                });
            }

            if (error.message.includes('ECONNREFUSED')) {
                return sendError(res, 503, 'AI service is currently unavailable. Please try again later.');
            }

            if (error.message.includes('timeout')) {
                return sendError(res, 408, 'Request timeout. Please try a shorter message or try again later.');
            }

            return sendError(res, 500, 'Failed to process chat message', error.message);
        }
    }    

    // Execute Ollama API request
    async generateOllamaResponse(userId: number, message: string): Promise<string> {
        try {            
            const messages = await this.buildMessagesArray(userId);
            messages.push({ role: 'user', content: message });
            
            const response = await this.ollamaService.sendChat(messages, this.modelName!);

            if (!response.success || !response.response || response.response.trim().length === 0) {
                throw new Error('Empty response from Ollama');
            }

            return response.response;            
        } catch (error: any) {
            console.error('Ollama API request failed:', error.message);
            throw error;
        }
    }

    // Get available models
    async getModels(req: Request, res: Response) {
        try {
            const modelsResult = await this.ollamaService.getModels();

            if (!this.modelName && modelsResult.success && modelsResult.models.length > 0) {
                await this.initializeModel();
            }

            if (!modelsResult.success) {
                if (modelsResult.error && modelsResult.error.includes('Connection refused')) {
                    return sendError(res, 503, 'AI service is not running. Please ensure Ollama is installed and running.');
                }
                return sendError(res, 500, 'Failed to retrieve available AI models', modelsResult.error);
            }

            return sendSuccess(res, {
                models: modelsResult.models,
                currentModel: this.modelName,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Get models error:', error);
            return sendError(res, 500, 'Failed to retrieve available AI models', error.message);
        }
    }

    // Change the current model
    async setModel(req: Request, res: Response) {
        try {
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            const { modelName } = req.body;

            if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
                return sendError(res, 400, 'Model name is required');
            }

            const modelsResult = await this.ollamaService.getModels();
            
            if (!modelsResult.success) {
                if (modelsResult.error && modelsResult.error.includes('Connection refused')) {
                    return sendError(res, 503, 'AI service is not running. Cannot change model.');
                }
                return sendError(res, 500, 'Failed to retrieve available models', modelsResult.error);
            }

            const availableModels = modelsResult.models.map((model: any) => model.name);

            if (!availableModels.includes(modelName.trim())) {
                return sendError(res, 404, `Model '${modelName}' not found. Available models: ${availableModels.join(', ')}`);
            }

            this.modelName = modelName.trim();

            return sendSuccess(res, {
                message: 'AI model changed successfully',
                currentModel: this.modelName,
                maxTokens: this.maxTokens,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Set model error:', error);
            return sendError(res, 500, 'Failed to change AI model', error.message);
        }
    }

    // Check Ollama status
    async getStatus(req: Request, res: Response) {
        try {
            const statusResult = await this.ollamaService.getStatus();
            
            return sendSuccess(res, {
                status: statusResult.status,
                version: statusResult.version || 'Unknown',
                currentModel: this.modelName,
                apiUrl: statusResult.apiUrl,
                timestamp: new Date().toISOString(),
                error: statusResult.error || undefined
            });

        } catch (error) {
            console.error('Ollama status error:', error);
            
            return sendSuccess(res, {
                status: 'offline',
                error: 'AI service not responding',
                apiUrl: this.ollamaService.baseUrl,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Start automatic cleanup interval
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldConversations();
        }, 30 * 60 * 1000);
        
        console.log('Started conversation cleanup interval (every 30 minutes)');
    }

    // Clean up old conversations
    cleanupOldConversations() {
        const cutoffTime = Date.now() - this.conversationTTL;
        this.chatModel.cleanupOldConversations(cutoffTime);
    }

    // Cleanup method for graceful shutdown
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            console.log('Stopped conversation cleanup interval');
        }
        
        this.cleanupOldConversations();
    }

    // Manual cleanup endpoint
    async cleanupConversations(req: Request, res: Response) {
        try {
            const before = this.chatModel.getConversationCount();
            this.cleanupOldConversations();
            const after = this.chatModel.getConversationCount();
            const removed = before - after;

            return sendSuccess(res, {
                message: 'Conversation cleanup completed successfully',
                conversationsRemoved: removed,
                conversationsRemaining: after,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Manual cleanup error:', error);
            return sendError(res, 500, 'Failed to cleanup conversations', error.message);
        }
    }

    // Clear all conversations endpoint
    async clearAllConversations(req: Request, res: Response) {
        try {
            const count = this.chatModel.clearAllConversations();

            return sendSuccess(res, {
                message: 'All conversations cleared successfully',
                conversationsRemoved: count,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Clear all conversations error:', error);
            return sendError(res, 500, 'Failed to clear conversations', error.message);
        }
    }

    // Get conversation history for a user
    getConversationHistory(userId: number): any[] {
        const conversation = this.getConversationFromDatabase(userId);
        return conversation.slice(1);
    }

    // API endpoint to get conversation history
    async getConversationHistoryEndpoint(req: Request, res: Response) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                console.log('Get conversation history - Authentication failed - no userId in req.user');
                return sendError(res, 401, 'No user ID found');
            }

            const conversationHistory = this.getConversationHistory(userId);
            console.log(`Retrieved conversation history for user ${userId}, total messages: ${conversationHistory.length}`);
            
            return sendSuccess(res, {
                conversationHistory: conversationHistory,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Failed to get conversation history:', error);
            return sendError(res, 500, 'Failed to retrieve conversation history', error.message);
        }
    }

    // API endpoint to clear user's conversation
    async clearConversationEndpoint(req: Request, res: Response) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                console.log('Clear conversation - Authentication failed - no userId in req.user');
                return sendError(res, 401, 'Authentication required to clear conversation');
            }

            this.chatModel.deleteConversation(userId);
            
            return sendSuccess(res, {
                message: 'Conversation cleared successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Failed to clear conversation:', error);
            return sendError(res, 500, 'Failed to clear conversation', error.message);
        }
    }

    parseMessage(rawMessage: string): { message: string; actions: any[] } | null {
        try {
            for (let i = 0; i < rawMessage.length; i++) {
                if (rawMessage[i] !== '{') continue;
                let braceCount = 0;
                for (let j = i; j < rawMessage.length; j++) {
                    if (rawMessage[j] === '{') braceCount++;
                    if (rawMessage[j] === '}') braceCount--;
                    if (braceCount === 0) {
                        const jsonStr = rawMessage.slice(i, j + 1);
                        try {
                            const obj = JSON.parse(jsonStr);
                            if (
                                typeof obj.message === 'string' &&
                                Array.isArray(obj.actions)
                            ) {
                                return { message: obj.message, actions: obj.actions };
                            }
                        } catch (e) {
                            // Keep searching
                        }
                        break;
                    }
                }
            }
            console.warn('No valid JSON with message/actions found in:', rawMessage);
            return null;
        } catch (e) {
            console.error('Error parsing message:', e);
            return null;
        }
    }

    async executeActions(actions: any[]): Promise<any[]> {
        if (!Array.isArray(actions) || actions.length === 0) {
            return [];
        }
        let actionsExecuted = [];
        for (const action of actions) {
            console.log('Executing action:', JSON.stringify(action));
            switch (action.action) {
                case 'wol':
                    const formattedMac = formatMacForDisplay(action.mac);
                    const successful = await deviceController.wakeDeviceByMac(formattedMac);
                    if (successful) {
                        actionsExecuted.push({
                            ...action,
                            mac: formattedMac,
                            message: `Wake-on-LAN sent to device with MAC ${formattedMac}`,
                            status: 'success'
                        });
                    } else {
                        actionsExecuted.push({
                            ...action,
                            mac: formattedMac,
                            message: `Failed to send Wake-on-LAN to device with MAC ${formattedMac}`,
                            status: 'error'
                        });
                    }
                    break;
                default:
                    console.warn(`Unknown action type: ${action.action}`);
                    actionsExecuted.push({
                        ...action,
                        message: `Unknown action type: ${action.action}`
                    });
            }
        }
        return actionsExecuted;
    }

    // Check model availability for download confirmation
    async checkModelAvailability(req: Request, res: Response) {
        try {
            const { modelName } = req.params;

            if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
                return sendError(res, 400, 'Model name is required');
            }

            if (!this.ollamaService.isValidModelName(modelName)) {
                return sendError(res, 400, 'Invalid model name format');
            }

            const availability = await this.ollamaService.checkModelAvailability(modelName.trim());

            if (!availability.success) {
                return sendError(res, 400, availability.error || `Model "${modelName}" is not available`);
            }

            return sendSuccess(res, {
                name: availability.name,
                exists: availability.exists,
                available: availability.available || false,
                message: availability.message,
                details: availability.details || {},
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Check model availability error:', error);
            return sendError(res, 500, 'Failed to check model availability', error.message);
        }
    }

    // Download a model
    async downloadModel(req: Request, res: Response) {
        try {
            const { modelName } = req.body;

            if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
                return sendError(res, 400, 'Model name is required');
            }

            if (!this.ollamaService.isValidModelName(modelName)) {
                return sendError(res, 400, 'Invalid model name format');
            }

            const trimmedModelName = modelName.trim();

            const availability = await this.ollamaService.checkModelAvailability(trimmedModelName);
            if (availability.success && availability.exists) {
                return sendError(res, 409, `Model "${trimmedModelName}" already exists`);
            }

            const downloadResult = await this.ollamaService.pullModel(trimmedModelName, false);

            if (!downloadResult.success) {
                if (downloadResult.error.includes('Connection refused')) {
                    return sendError(res, 503, 'AI service is not running. Cannot download model.');
                }
                return sendError(res, 500, `Failed to download model "${trimmedModelName}"`, downloadResult.error);
            }

            setTimeout(() => {
                this.initializeModel();
            }, 1000);

            return sendSuccess(res, {
                message: `Model "${trimmedModelName}" downloaded successfully`,
                model: trimmedModelName,
                status: downloadResult.status,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Download model error:', error);
            return sendError(res, 500, 'Failed to download model', error.message);
        }
    }

    // Get detailed models with size and management info
    async getDetailedModels(req: Request, res: Response) {
        try {
            const modelsResult = await this.ollamaService.getDetailedModels();

            if (!modelsResult.success) {
                if (modelsResult.error && modelsResult.error.includes('Connection refused')) {
                    return sendError(res, 503, 'AI service is not running. Please ensure Ollama is installed and running.');
                }
                return sendError(res, 500, 'Failed to retrieve detailed model information', modelsResult.error);
            }

            return sendSuccess(res, {
                models: modelsResult.models,
                count: modelsResult.count,
                currentModel: this.modelName,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Get detailed models error:', error);
            return sendError(res, 500, 'Failed to retrieve detailed model information', error.message);
        }
    }

    // Delete a model
    async deleteModel(req: Request, res: Response) {
        try {
            const { modelName } = req.params;

            if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
                return sendError(res, 400, 'Model name is required');
            }

            const trimmedModelName = modelName.trim();

            const availability = await this.ollamaService.checkModelAvailability(trimmedModelName);
            if (!availability.success || !availability.exists) {
                return sendError(res, 404, `Model "${trimmedModelName}" not found locally`);
            }

            const deleteResult = await this.ollamaService.deleteModel(trimmedModelName);

            if (!deleteResult.success) {
                if (deleteResult.error.includes('Connection refused')) {
                    return sendError(res, 503, 'AI service is not running. Cannot delete model.');
                }
                return sendError(res, 500, `Failed to delete model "${trimmedModelName}"`, deleteResult.error);
            }

            return sendSuccess(res, {
                message: `Model "${trimmedModelName}" deleted successfully`,
                model: trimmedModelName,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Delete model error:', error);
            return sendError(res, 500, 'Failed to delete model', error.message);
        }
    }
}

export default ChatController;