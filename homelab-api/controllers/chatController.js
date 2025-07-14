const https = require('https');
const http = require('http');

class ChatController {
    constructor() {
        this.modelName = null; // Will be set dynamically
        this.timeout = 120000; // 2 minutes
        this.ollamaBaseUrl = 'http://localhost:11434'; // Default Ollama API URL
        this.systemPrompt = `You are HomeBot, a helpful AI assistant for a homelab management dashboard. You help users with technical questions, troubleshooting, system administration, and general computing topics. Be concise, accurate, and practical in your responses. If you're unsure about something, acknowledge it rather than guessing.`;
        this.conversations = new Map(); // Store conversation history
        this.maxPromptCharacters = 12000; // Total character limit for the entire prompt
        this.conversationTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.maxConversations = 100; // Maximum number of conversations to keep
        this.initializeModel();
        
        // Start cleanup interval (every 30 minutes)
        this.startCleanupInterval();
    }

    // Initialize with the first available model
    async initializeModel() {
        try {
            const availableModels = await this.getAvailableModelsList();
            
            if (availableModels.length === 0) {
                console.warn('No Ollama models found. Please install a model first.');
                this.modelName = 'gemma2:2b-instruct-q4_0'; // fallback
                return;
            }

            // Use the first available model
            this.modelName = availableModels[0];
            console.log(`Initialized with first available model: ${this.modelName}`);

        } catch (error) {
            console.warn('Failed to initialize model, using fallback:', error.message);
            this.modelName = 'gemma2:2b-instruct-q4_0'; // fallback
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

    // Helper method to build the full prompt for Ollama API
    getFullPrompt(userMessage, conversationId = null) {
        let prompt = this.systemPrompt;
        
        // Add conversation history if available and it fits
        if (conversationId && this.conversations.has(conversationId)) {
            const history = this.conversations.get(conversationId);
            
            if (history.length > 0) {
                // Add history exchanges until we exceed the limit
                for (const exchange of history) {
                    const exchangeText = this.exchangeToString(exchange);
                    const testPrompt = prompt + exchangeText + `\nUser: ${userMessage}\nAssistant:`;
                    
                    if (testPrompt.length > this.maxPromptCharacters) {
                        break; // Stop if adding this exchange would exceed limit
                    }
                    
                    prompt += exchangeText;
                }
                
                console.log(`Including conversation history for conversation ${conversationId}`);
            }
        }
        
        prompt += `\nUser: ${userMessage}\nAssistant:`;
        
        console.log(`Final prompt length: ${prompt.length}/${this.maxPromptCharacters} characters`);
        return prompt;
    }

    // Helper method to convert exchange to string format used in prompts
    exchangeToString(exchange) {
        return `\nUser: ${exchange.user}\nAssistant: ${exchange.assistant}`;
    }

    // Calculate total character count for conversation history as it would appear in prompt
    getConversationCharacterCount(history) {
        return history.reduce((total, exchange) => {
            return total + this.exchangeToString(exchange).length;
        }, 0);
    }

    // Add exchange to conversation history
    addToConversationHistory(conversationId, userMessage, assistantResponse) {
        if (!this.conversations.has(conversationId)) {
            this.conversations.set(conversationId, []);
        }
        
        const history = this.conversations.get(conversationId);
        
        // Add new exchange with current timestamp
        const newExchange = {
            user: userMessage,
            assistant: assistantResponse,
            timestamp: new Date().toISOString()
        };
        history.push(newExchange);
        
        // Remove oldest messages if total prompt would exceed max limit
        while (history.length > 1) {
            let testPrompt = this.systemPrompt;
            
            // Add all history exchanges using the helper function
            for (const exchange of history) {
                testPrompt += this.exchangeToString(exchange);
            }
            
            if (testPrompt.length <= this.maxPromptCharacters) {
                break; // We're under the limit, stop removing
            }
            
            // Remove the oldest exchange
            const removedExchange = history.shift();
            const freedChars = this.exchangeToString(removedExchange).length;
            console.log(`Removed old exchange from conversation ${conversationId}. Freed ${freedChars} characters.`);
        }
        
        console.log(`Added to conversation ${conversationId}. History length: ${history.length}`);
        
        // Trigger cleanup if we have too many conversations
        if (this.conversations.size > this.maxConversations * 1.2) {
            console.log('Too many conversations, triggering cleanup...');
            this.cleanupOldConversations();
        }
    }

    // Make HTTP request to Ollama API
    async makeOllamaRequest(endpoint, method = 'POST', data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.ollamaBaseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (data) {
                const jsonData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(jsonData);
            }

            const req = http.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const parsed = responseData ? JSON.parse(responseData) : {};
                            resolve(parsed);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Failed to parse response: ${parseError.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(this.timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    // Send a message to Ollama and get response (with streaming support)
    async sendMessage(req, res) {
        try {
            // Ensure model is initialized
            if (!this.modelName) {
                await this.initializeModel();
            }

            const { message, conversationId, stream = false } = req.body;

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

            // Generate conversation ID if not provided
            const currentConversationId = conversationId || this.generateConversationId();

            console.log(`Chat request (${stream ? 'stream' : 'no stream'}): ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
            console.log(`Conversation ID: ${currentConversationId}`);
            
            if (stream) {
                // Set up Server-Sent Events for streaming
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Cache-Control',
                    'X-Accel-Buffering': 'no' // Disable nginx buffering
                });

                // Send immediate confirmation that streaming has started
                res.write(`data: ${JSON.stringify({
                    type: 'start',
                    message: 'Streaming started...',
                    timestamp: new Date().toISOString()
                })}\n\n`);
                
                if (res.flush) {
                    res.flush();
                }

                const startTime = Date.now();
                let fullResponse = '';

                try {
                    console.log('Starting streaming response...');
                    await this.streamOllamaResponse(message, currentConversationId, (chunk) => {
                        fullResponse += chunk;
                        res.write(`data: ${JSON.stringify({
                            type: 'chunk',
                            content: chunk,
                            timestamp: new Date().toISOString()
                        })}\n\n`);
                        
                        // Force flush the response immediately
                        if (res.flush) {
                            res.flush();
                        }
                    });

                    const responseTime = Date.now() - startTime;
                    console.log('Streaming complete, sending final message...');
                    
                    // Add to conversation history
                    this.addToConversationHistory(currentConversationId, message, fullResponse.trim());
                    
                    // Send final message
                    res.write(`data: ${JSON.stringify({
                        type: 'complete',
                        message: fullResponse.trim(),
                        conversationId: currentConversationId,
                        timestamp: new Date().toISOString(),
                        responseTime: responseTime,
                        model: this.modelName
                    })}\n\n`);
                    
                    res.end();
                    console.log(`Streaming chat response time: ${responseTime}ms`);

                } catch (error) {
                    console.error('Streaming error:', error);
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
                const response = await this.executeOllamaCommand(message, currentConversationId);
                const responseTime = Date.now() - startTime;

                console.log(`Chat response time: ${responseTime}ms`);

                // Add to conversation history
                this.addToConversationHistory(currentConversationId, message, response.trim());

                res.json({
                    message: response.trim(),
                    conversationId: currentConversationId,
                    timestamp: new Date().toISOString(),
                    responseTime: responseTime,
                    model: this.modelName
                });
            }

        } catch (error) {
            console.error('Chat error:', error);
            
            if (error.message.includes('ECONNREFUSED')) {
                return res.status(503).json({ 
                    error: 'Ollama service is not running',
                    details: 'Please ensure Ollama is installed and running on localhost:11434'
                });
            }

            if (error.message.includes('timeout') || error.message.includes('timed out')) {
                return res.status(504).json({ 
                    error: 'Request timeout',
                    details: 'The AI model took too long to respond. Try a shorter message or check if the model is working properly.'
                });
            }

            if (error.message.includes('model not found')) {
                return res.status(404).json({ 
                    error: 'Model not found',
                    details: `The model "${this.modelName}" is not available. Please check available models.`
                });
            }

            res.status(500).json({ 
                error: 'Failed to process chat message',
                details: error.message 
            });
        }
    }

    // Stream Ollama response in real-time
    async streamOllamaResponse(message, conversationId, onChunk) {
        return new Promise((resolve, reject) => {
            const url = new URL('/api/generate', this.ollamaBaseUrl);
            const postData = JSON.stringify({
                model: this.modelName,
                prompt: this.getFullPrompt(message, conversationId),
                stream: true
            });

            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let buffer = '';

                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    
                    // Keep the last incomplete line in the buffer
                    buffer = lines.pop() || '';
                    
                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const data = JSON.parse(line);
                                if (data.response) {
                                    onChunk(data.response);
                                }
                                if (data.done) {
                                    resolve();
                                    return;
                                }
                            } catch (parseError) {
                                // Ignore parse errors for incomplete chunks
                                console.warn('Parse error in stream:', parseError.message, 'Line:', line);
                            }
                        }
                    }
                });

                res.on('end', () => {
                    // Process any remaining data in buffer
                    if (buffer.trim()) {
                        try {
                            const data = JSON.parse(buffer.trim());
                            if (data.response) {
                                onChunk(data.response);
                            }
                        } catch (parseError) {
                            console.warn('Parse error in final buffer:', parseError.message);
                        }
                    }
                    resolve();
                });

                res.on('error', (error) => {
                    reject(error);
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(this.timeout, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    // Execute Ollama API request (non-streaming)
    async executeOllamaCommand(message, conversationId = null) {
        try {
            console.log('Sending Ollama API request...');
            
            const response = await this.makeOllamaRequest('/api/generate', 'POST', {
                model: this.modelName,
                prompt: this.getFullPrompt(message, conversationId),
                stream: false
            });

            if (!response.response || response.response.trim().length === 0) {
                throw new Error('Empty response from Ollama');
            }

            return response.response;
            
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
        const now = Date.now();
        let removedCount = 0;
        let totalCount = this.conversations.size;
        
        // Remove conversations older than TTL
        for (const [conversationId, history] of this.conversations.entries()) {
            if (history.length === 0) {
                this.conversations.delete(conversationId);
                removedCount++;
                continue;
            }
            
            // Check the last message timestamp
            const lastExchange = history[history.length - 1];
            const lastActivityTime = new Date(lastExchange.timestamp).getTime();
            
            if (now - lastActivityTime > this.conversationTTL) {
                this.conversations.delete(conversationId);
                removedCount++;
            }
        }
        
        // If still too many conversations, remove oldest ones
        if (this.conversations.size > this.maxConversations) {
            const conversationEntries = Array.from(this.conversations.entries());
            
            // Sort by last activity time (oldest first)
            conversationEntries.sort((a, b) => {
                const aLastTime = a[1].length > 0 ? new Date(a[1][a[1].length - 1].timestamp).getTime() : 0;
                const bLastTime = b[1].length > 0 ? new Date(b[1][b[1].length - 1].timestamp).getTime() : 0;
                return aLastTime - bLastTime;
            });
            
            // Remove oldest conversations
            const toRemove = this.conversations.size - this.maxConversations;
            for (let i = 0; i < toRemove; i++) {
                const [conversationId] = conversationEntries[i];
                this.conversations.delete(conversationId);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} old conversations. Total conversations: ${totalCount} -> ${this.conversations.size}`);
        }
    }

    // Manual cleanup method
    clearAllConversations() {
        const count = this.conversations.size;
        this.conversations.clear();
        console.log(`Manually cleared ${count} conversations`);
        return count;
    }

    // Cleanup method for graceful shutdown
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            console.log('Stopped conversation cleanup interval');
        }
        this.cleanupOldConversations(); // Final cleanup
    }

    // Generate a simple conversation ID
    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    // Get conversation statistics
    async getConversationStats(req, res) {
        try {
            const now = Date.now();
            const stats = {
                totalConversations: this.conversations.size,
                maxConversations: this.maxConversations,
                conversationTTL: this.conversationTTL,
                conversations: []
            };

            for (const [conversationId, history] of this.conversations.entries()) {
                if (history.length > 0) {
                    const lastExchange = history[history.length - 1];
                    const lastActivityTime = new Date(lastExchange.timestamp).getTime();
                    const ageMs = now - lastActivityTime;
                    const totalChars = this.getConversationCharacterCount(history);

                    stats.conversations.push({
                        id: conversationId,
                        messageCount: history.length,
                        totalCharacters: totalChars,
                        lastActivity: lastExchange.timestamp,
                        ageHours: Math.round(ageMs / (1000 * 60 * 60) * 100) / 100,
                        isExpired: ageMs > this.conversationTTL
                    });
                }
            }

            // Sort by last activity (newest first)
            stats.conversations.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

            res.json(stats);

        } catch (error) {
            console.error('Get conversation stats error:', error);
            res.status(500).json({ 
                error: 'Failed to get conversation statistics',
                details: error.message 
            });
        }
    }

    // Manual cleanup endpoint
    async cleanupConversations(req, res) {
        try {
            const before = this.conversations.size;
            this.cleanupOldConversations();
            const after = this.conversations.size;
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
    async clearAllConversationsEndpoint(req, res) {
        try {
            const count = this.clearAllConversations();

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
}

module.exports = ChatController;
