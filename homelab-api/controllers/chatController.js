const DatabaseModel = require('../models/Database');
const Chat = require('../models/Chat');
const SystemController = require('../controllers/systemController');
const DeviceController = require('../controllers/deviceController');

const systemController = new SystemController();
const deviceController = new DeviceController();

const BASE_SYSTEM_PROMPT = 
`You are HomeBot. You are a homelab dashboard AI. Be concise, accurate, and practical.
If the user asks a general question that is not an action, provide a concise answer based on the provided prompt.
If a user requests an action, include the exact JSON payload at the end of your response. You might need to use the provided information to fill in action parameters.

--- Available actions ---
- Wake-on-LAN (Turn a device on with a WOL packet): { "action": "wol", "mac": "<DEVICE_MAC_ADDRESS>" }
`;

class ChatController {
    constructor() {
        this.modelName = null; // Will be set dynamically
        this.timeout = 600000; // 10 minutes
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
            BASE_SYSTEM_PROMPT +
            `\n\n--- Information Provided for Context ---` + // Add a clear separator
            `\nSystem Information: ${systemInfo}` +
            `\nSaved devices: ${deviceInfo}`;
        
        console.log('Full system prompt:', fullSystemPrompt);
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
            console.log(`Including ${messagesToInclude.length} messages from conversation for user ${userId}, total tokens: ${totalTokens}`);
        }

        return messages;
    }

    // Get conversation from database
    getConversationFromDatabase(userId) {
        try {
            const conversation = this.chatModel.getConversation(userId);
            if (!conversation || conversation.length === 0) {
                console.log('No conversation found for user:', userId);
                return [{ role: 'system', content: BASE_SYSTEM_PROMPT }];
            }
            return conversation;
        } catch (error) {
            console.error('Error getting conversation from database:', error);
            return [{ role: 'system', content: BASE_SYSTEM_PROMPT }];
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

            const { message, stream = false } = req.body;
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

            console.log(`Chat request from user ${userId} (${stream ? 'stream' : 'no stream'}): ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
            
            // Add user message to conversation history
            this.addToConversationHistory(userId, {
                role: 'user',
                content: message
            });
            
            if (stream) {
                // Set up Server-Sent Events for streaming
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no' // Disable nginx buffering
                });

                // Send conversation history along with start message
                const conversationHistory = this.getConversationHistory(userId);
                res.write(`data: ${JSON.stringify({
                    type: 'start',
                    message: 'Streaming started...',
                    conversationHistory: conversationHistory,
                    timestamp: new Date().toISOString()
                })}\n\n`);
                
                if (res.flush) {
                    res.flush();
                }

                const startTime = Date.now();
                let fullResponse = '';
                let checkActionFromIndex = 0;

                try {
                    console.log('Starting streaming response...');
                    await this.streamOllamaResponse(userId, message, (chunk) => {
                        fullResponse += chunk;
                        res.write(`data: ${JSON.stringify({
                            type: 'chunk',
                            content: chunk,
                            timestamp: new Date().toISOString()
                        })}\n\n`);
                        const actionJSON = this.getActions(fullResponse, checkActionFromIndex);
                        if (actionJSON.length > 0) {
                            actionJSON.forEach(action => this.performAction(action));
                            checkActionFromIndex = fullResponse.length;
                        }

                        // Force flush the response immediately
                        if (res.flush) {
                            res.flush();
                        }
                    });

                    const responseTime = Date.now() - startTime;
                    console.log('Streaming complete, sending final message...');
                    
                    // Add assistant response to conversation history
                    this.addToConversationHistory(userId, {
                        role: 'assistant',
                        content: fullResponse.trim()
                    });
                    
                    // Send final message
                    res.write(`data: ${JSON.stringify({
                        type: 'complete',
                        message: fullResponse.trim(),
                        timestamp: new Date().toISOString(),
                        responseTime: responseTime,
                        model: this.modelName
                    })}\n\n`);
                    
                    res.end();
                    console.log(`Streaming chat response time: ${responseTime}ms`);

                } catch (error) {
                    console.error('Streaming error:', error);
                    if (userId) {
                        this.addToConversationHistory(userId, {
                            role: 'assistant',
                            content: "Error"
                        });
                    }
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    })}\n\n`);
                    res.end();
                }
            } else {
                // Non-streaming response (original behavior)
                const startTime = Date.now();
                const response = await this.generateOllamaResponse(userId, message);
                const responseTime = Date.now() - startTime;

                const actionJSON = this.getActions(response, 0);
                if (actionJSON.length > 0) {
                    actionJSON.forEach(action => this.performAction(action));
                }

                console.log(`Chat response time: ${responseTime}ms`);

                // Add assistant response to conversation history
                this.addToConversationHistory(userId, {
                    role: 'assistant',
                    content: response.trim()
                });

                // Get conversation history for frontend
                const conversationHistory = this.getConversationHistory(userId);

                res.json({
                    message: response.trim(),
                    conversationHistory: conversationHistory,
                    timestamp: new Date().toISOString(),
                    responseTime: responseTime,
                    model: this.modelName
                });
            }

        } catch (error) {
            console.error('Chat error:', error);

            const userId = req.user?.userId;
            let assistantMessage = '';

            if (error.message.includes('ECONNREFUSED')) {
                assistantMessage = 'Message failed: Ollama service is not running.';
                if (userId) {
                    this.addToConversationHistory(userId, {
                        role: 'assistant',
                        content: assistantMessage
                    });
                }
                return res.status(503).json({ 
                    error: 'Ollama service is not running',
                    details: 'Please ensure Ollama is installed and running on localhost:11434'
                });
            }

            if (error.message.includes('timeout') || error.message.includes('timed out')) {
                assistantMessage = 'Message timed out: The AI model took too long to respond.';
                if (userId) {
                    this.addToConversationHistory(userId, {
                        role: 'assistant',
                        content: assistantMessage
                    });
                }
                return res.status(504).json({ 
                    error: 'Request timeout',
                    details: 'The AI model took too long to respond. Try a shorter message or check if the model is working properly.'
                });
            }

            if (error.message.includes('model not found')) {
                assistantMessage = `Message failed: The model "${this.modelName}" is not available.`;
                if (userId) {
                    this.addToConversationHistory(userId, {
                        role: 'assistant',
                        content: assistantMessage
                    });
                }
                return res.status(404).json({ 
                    error: 'Model not found',
                    details: `The model "${this.modelName}" is not available. Please check available models.`
                });
            }

            assistantMessage = `Message failed!`;
            if (userId) {
                this.addToConversationHistory(userId, {
                    role: 'assistant',
                    content: assistantMessage
                });
            }
            res.status(500).json({ 
                error: 'Failed to process chat message',
                details: error.message 
            });
        }
    }

    // Stream Ollama response in real-time using messages format and fetch
    async streamOllamaResponse(userId, message, onChunk) {
        const url = new URL('/api/chat', this.ollamaBaseUrl);
        const messages = await this.buildMessagesArray(userId);
        // Add current user message
        messages.push({ role: 'user', content: message });
        
        const requestBody = JSON.stringify({
            model: this.modelName,
            messages: messages,
            stream: true
        });

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody,
            signal: AbortSignal.timeout(this.timeout)
        };

        try {
            const response = await fetch(url.toString(), options);
            
            if (!response.ok) {
                console.error('Failed to get valid response from Ollama:', response.status);
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const data = JSON.parse(line);
                            let content = '';
                            
                            if (data.message && data.message.content) {
                                content = data.message.content;
                            }
                            
                            if (content) {
                                onChunk(content);
                            }   
                            if (data.done) {
                                return;
                            }
                        } catch (parseError) {
                            // Ignore parse errors for incomplete chunks
                            console.warn('Parse error in stream:', parseError.message, 'Line:', line);
                        }
                    }
                }
            }

            // Process any remaining data in buffer
            if (buffer.trim()) {
                try {
                    const data = JSON.parse(buffer.trim());
                    let content = '';
                    
                    if (data.message && data.message.content) {
                        content = data.message.content;
                    }
                    
                    if (content) {
                        onChunk(content);
                    }
                } catch (parseError) {
                    console.warn('Parse error in final buffer:', parseError.message);
                }
            }
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // Execute Ollama API request (non-streaming) using messages format
    async generateOllamaResponse(userId, message) {
        try {
            console.log('Sending Ollama API request...');
            
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
            this.updateTokenLimitsForModel(modelName);

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

    getActions(content, startIndex = 0) {
        content = content.slice(startIndex).trim();
        if (content.length === 0) {
            return []; // No content to check
        }
        // Match any JSON object containing "action": "<string>"
        const actionRegex = /{[^}]*"action"\s*:\s*"[^"]+"[^}]*}/g;
        const matches = content.match(actionRegex);
        if (!matches || matches.length === 0) {
            return [];
        }
        const actions = [];
        for (const match of matches) {
            try {
                const actionObj = JSON.parse(match);
                if (actionObj.action && typeof actionObj.action === 'string') {
                    actions.push(actionObj);
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
        return actions;
    }

    async performAction(actionPayload) {
        switch (actionPayload.action) {
            case 'wol':
                console.log(`Performing Wake-on-LAN for MAC: ${actionPayload.mac}`);
                deviceController.wakeDeviceByMac(actionPayload.mac);
                break;
            default:
                console.warn(`Unknown action: ${actionPayload.action}`);
        }
    }
}

module.exports = ChatController;
