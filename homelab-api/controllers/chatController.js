const DatabaseModel = require('../models/Database');
const Chat = require('../models/Chat');
const SystemController = require('../controllers/systemController');
const DeviceController = require('../controllers/deviceController');
const { formatMacForDisplay } = require('../utils/formatters'); // <-- Correct import

const systemController = new SystemController();
const deviceController = new DeviceController();

class ChatController {
    constructor() {
        this.modelName = null; // Will be set dynamically
        this.timeout = 300000; // 5 minutes
        this.ollamaBaseUrl = 'http://localhost:11434'; // Default Ollama API URL
        this.db = DatabaseModel.getDatabase(); // Database instance
        this.chatModel = new Chat(); // Chat model instance
        this.maxTokens = 2048; // Maximum tokens for context (conservative estimate for most models)
        this.conversationTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.maxExchangesPerConversation = 100; // Maximum exchanges per conversation
        this.initializeModel();
        
        // Start cleanup interval (every 30 minutes)
        this.startCleanupInterval();
    }

    async getSystemPrompt() {
        const systemInfo = JSON.stringify(await systemController.getSystemPromptInfo());
        const deviceInfo = JSON.stringify(await deviceController.getDevicePromptInfo());

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

            // Use the first available model
            this.modelName = availableModels[0];
            console.log(`Initialized with first available model: ${this.modelName}, max tokens: ${this.maxTokens}`);

        } catch (error) {
            console.warn('Failed to initialize model, using fallback:', error.message);
        }
    }

    // Helper method to get available models list
    async getAvailableModelsList() {
        try {
            const response = await this.makeOllamaRequest('/api/tags', 'GET');
            return response.models?.map(model => model.name) || [];
        } catch (error) {
            console.warn('Failed to get available models via API:', error.message);
            return [];
        }
    }

    // Estimate token count for text using simple character-based estimation
    estimateTokens(text) {
        // Simple estimation: roughly 4 characters per token
        return Math.ceil(text.length / 4);
    }

    // Build messages array for Ollama API (simplified - uses Ollama message structure)
    async buildMessagesArray(userId) {
        const systemPrompt = await this.getSystemPrompt();
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];

        // Add conversation history if available
        const conversationMessages = this.getConversationFromDatabase(userId);
        if (conversationMessages && conversationMessages.length > 0) {
            // Skip the system message (first message) and add all conversation messages
            const historyMessages = conversationMessages.slice(1);
            
            // Estimate tokens and include as many messages as possible (newest first approach)
            let totalTokens = this.estimateTokens(systemPrompt) + 10; // system message + overhead
            const maxHistoryTokens = Math.floor(this.maxTokens * 0.8); // Use 80% for history
            
            const messagesToInclude = [];
            for (let i = historyMessages.length - 1; i >= 0; i--) {
                const message = historyMessages[i];
                const messageTokens = this.estimateTokens(message.content) + 10;
                
                if (totalTokens + messageTokens <= maxHistoryTokens) {
                    messagesToInclude.unshift(message); // Add to beginning to maintain order
                    totalTokens += messageTokens;
                } else {
                    break; // Stop if we can't fit more messages
                }
            }
            
            messages.push(...messagesToInclude);
            console.log(`Building prompt with ${messagesToInclude.length} messages, total tokens: ${totalTokens}`);
        }

        return messages;
    }

    // Get conversation from database
    getConversationFromDatabase(userId) {
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
    saveConversationToDatabase(userId, messages) {
        this.chatModel.saveConversation(userId, messages);
    }

    // Add exchange to conversation history
    // Add a message to conversation history
    addToConversationHistory(userId, message) {
        // Get current conversation from database
        const conversation = this.getConversationFromDatabase(userId);
        
        // Add new message
        conversation.push(message);
        
        // Keep only last 100 exchanges (200 messages - system message + user/assistant pairs)
        // System message + 100 exchanges = 201 messages max
        const maxMessages = 201;
        if (conversation.length > maxMessages) {
            // Remove oldest messages but keep system message
            const messagesToRemove = conversation.length - maxMessages;
            conversation.splice(1, messagesToRemove);
        }
        
        // Save back to database
        this.saveConversationToDatabase(userId, conversation);
        
        console.log(`Added message to conversation for user ${userId}. Total messages: ${conversation.length}`);
    }

    // Make HTTP request to Ollama API using fetch
    async makeOllamaRequest(endpoint, method = 'POST', data = null) {
        const url = new URL(endpoint, this.ollamaBaseUrl);
        
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(this.timeout)
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url.toString(), options);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const responseText = await response.text();
            return responseText ? JSON.parse(responseText) : {};
            
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // Send a message to Ollama and get response (with streaming support)
    async sendMessage(req, res) {
        try {
            // Ensure model is initialized
            if (!this.modelName) {
                await this.initializeModel();
            }

            const { message } = req.body;
            // Get userId from authenticated user - must be logged in
            const userId = req.user?.userId;

            if (!userId) {
                console.log('Authentication failed - no userId in req.user');
                return res.status(401).json({ 
                    error: 'Authentication required',
                    details: 'You must be logged in to use the chat feature'
                });
            }

            if (!message || typeof message !== 'string' || message.trim().length === 0) {
                return res.status(400).json({ 
                    error: 'Message is required and cannot be empty' 
                });
            }

            // Check character limit
            if (message.trim().length > 1000) {
                return res.status(400).json({ 
                    error: 'Message too long',
                    details: 'Message must be 1000 characters or less'
                });
            }

            console.log(`Chat request from user ${userId}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
            
            // Add user message to conversation history
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
            const actionsExecuted = parsedMessage.actions ? await this.executeActions(parsedMessage.actions) : [];

            // Add assistant response to conversation history
            this.addToConversationHistory(userId, {
                role: 'assistant',
                content: responseMessage,
                message: parsedMessage.message || 'Error',
                actions: actionsExecuted
            });

            // Get conversation history for frontend
            const conversationHistory = this.getConversationHistory(userId);

            res.json({
                content: responseMessage,
                message: parsedMessage.message || 'Error',
                conversationHistory: conversationHistory,
                timestamp: new Date().toISOString(),
                responseTime: responseTime,
                model: this.modelName,
                actions: actionsExecuted,
            });

        } catch (error) {
            console.error('Chat error:', error);

            const userId = req.user?.userId;
            if (userId) {
                this.addToConversationHistory(userId, {
                    role: 'assistant',
                    content: `Message failed: ${error.message}`,
                    message: "Error",
                    actions: []
                });
            }
            res.status(500).json({ 
                error: 'Failed to process chat message',
                details: error.message 
            });
        }
    }    

    // Execute Ollama API request (non-streaming) using messages format
    async generateOllamaResponse(userId, message) {
        try {            
            const messages = await this.buildMessagesArray(userId);
            // Add current user message
            messages.push({ role: 'user', content: message });
            
            // Try new chat API first
            const response = await this.makeOllamaRequest('/api/chat', 'POST', {
                model: this.modelName,
                messages: messages,
                stream: false
            });

            if (!response.message || !response.message.content || response.message.content.trim().length === 0) {
                throw new Error('Empty response from Ollama');
            }

            return response.message.content;            
        } catch (error) {
            console.error('Ollama API request failed:', error.message);
            throw error;
        }
    }

    // Get available models
    async getModels(req, res) {
        try {
            const response = await this.makeOllamaRequest('/api/tags', 'GET');
            const models = response.models || [];

            // Ensure model is initialized
            if (!this.modelName && models.length > 0) {
                await this.initializeModel();
            }

            res.json({
                models: models.map(model => ({
                    name: model.name,
                    size: this.formatBytes(model.size || 0),
                    modified: model.modified_at || 'Unknown'
                })),
                currentModel: this.modelName,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Get models error:', error);
            
            if (error.message.includes('ECONNREFUSED')) {
                return res.status(503).json({ 
                    error: 'Ollama service is not running',
                    details: 'Please ensure Ollama is installed and running on localhost:11434'
                });
            }

            res.status(500).json({ 
                error: 'Failed to get available models',
                details: error.message 
            });
        }
    }

    // Helper to format bytes
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Change the current model
    async setModel(req, res) {
        try {
            const { modelName } = req.body;

            if (!modelName || typeof modelName !== 'string') {
                return res.status(400).json({ 
                    error: 'Model name is required' 
                });
            }

            // Validate model exists
            const response = await this.makeOllamaRequest('/api/tags', 'GET');
            const availableModels = response.models?.map(model => model.name) || [];

            if (!availableModels.includes(modelName)) {
                return res.status(404).json({ 
                    error: 'Model not found',
                    availableModels: availableModels
                });
            }

            this.modelName = modelName;

            res.json({
                message: 'Model changed successfully',
                currentModel: this.modelName,
                maxTokens: this.maxTokens,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Set model error:', error);
            res.status(500).json({ 
                error: 'Failed to change model',
                details: error.message 
            });
        }
    }

    // Check Ollama status
    async getStatus(req, res) {
        try {
            // Try to get version info from API
            const response = await this.makeOllamaRequest('/api/version', 'GET');
            
            res.json({
                status: 'online',
                version: response.version || 'Unknown',
                currentModel: this.modelName,
                apiUrl: this.ollamaBaseUrl,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Ollama status error:', error);
            
            res.json({
                status: 'offline',
                error: error.message.includes('ECONNREFUSED') ? 'Ollama service not running' : 'Ollama not responding',
                apiUrl: this.ollamaBaseUrl,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Start automatic cleanup interval
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldConversations();
        }, 30 * 60 * 1000); // Run every 30 minutes
        
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
        
        this.cleanupOldConversations(); // Final cleanup
    }

    // Manual cleanup endpoint
    async cleanupConversations(req, res) {
        try {
            // Get count before cleanup
            const before = this.chatModel.getConversationCount();
            
            // Run cleanup
            this.cleanupOldConversations();
            
            // Get count after cleanup
            const after = this.chatModel.getConversationCount();
            const removed = before - after;

            res.json({
                message: 'Cleanup completed',
                conversationsRemoved: removed,
                conversationsRemaining: after,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Manual cleanup error:', error);
            res.status(500).json({ 
                error: 'Failed to cleanup conversations',
                details: error.message 
            });
        }
    }

    // Clear all conversations endpoint
    async clearAllConversations(req, res) {
        try {
            const count = this.chatModel.clearAllConversations();

            res.json({
                message: 'All conversations cleared',
                conversationsRemoved: count,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Clear all conversations error:', error);
            res.status(500).json({ 
                error: 'Failed to clear conversations',
                details: error.message 
            });
        }
    }

    // Get conversation history for a user
    getConversationHistory(userId) {
        const conversation = this.getConversationFromDatabase(userId);
        // Return all messages except the system message (first message)
        return conversation.slice(1);
    }

    // API endpoint to get conversation history
    async getConversationHistoryEndpoint(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                console.log('Get conversation history - Authentication failed - no userId in req.user');
                return res.status(401).json({ 
                    error: 'Authentication required',
                    details: 'You must be logged in to view conversation history'
                });
            }

            const conversationHistory = this.getConversationHistory(userId);
            console.log(`Retrieved conversation history for user ${userId}, total messages: ${conversationHistory.length}`);
            
            res.json({
                conversationHistory: conversationHistory,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Failed to get conversation history:', error);
            res.status(500).json({ 
                error: 'Failed to retrieve conversation history',
                details: error.message 
            });
        }
    }

    // API endpoint to clear user's conversation
    async clearConversationEndpoint(req, res) {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                console.log('Clear conversation - Authentication failed - no userId in req.user');
                return res.status(401).json({ 
                    error: 'Authentication required',
                    details: 'You must be logged in to clear conversation'
                });
            }

            this.chatModel.deleteConversation(userId);
            
            res.json({
                message: 'Conversation cleared successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Failed to clear conversation:', error);
            res.status(500).json({ 
                error: 'Failed to clear conversation',
                details: error.message 
            });
        }
    }

    /**
     * Extracts the actions array from a string containing a JSON object.
     * Returns [] if not found or invalid.
     * @param {string} message
     * @returns {Array}
     */
    parseMessage(rawMessage) {
        try {
            // Scan for all possible balanced JSON objects and parse each
            let results = [];
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
                            // Ignore parse errors, keep searching
                        }
                        break;
                    }
                }
            }
            // If nothing found, fallback
            console.warn('No valid JSON with message/actions found in:', rawMessage);
            return null; // Return null if no valid JSON found
        } catch (e) {
            console.error('Error parsing message:', e);
            return null;
        }
    }

    async executeActions(actions) {
        if (!Array.isArray(actions) || actions.length === 0) {
            return [];
        }
        let actionsExecuted = [];
        for (const action of actions) {
            console.log('Executing action:', JSON.stringify(action));
            switch (action.action) {
                case 'wol':
                    // Format MAC address using formatMacForDisplay from formatters.js
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
}

module.exports = ChatController;