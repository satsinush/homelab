import config from '../config';

export interface OllamaModel {
    name: string;
    size: string;
    modified: string;
    details: unknown;
}

export interface DetailedOllamaModel {
    name: string;
    size: number;
    sizeFormatted: string;
    modified: string;
    digest: string;
    details: unknown;
}

export interface OllamaStatusResponse {
    success: boolean;
    status: string;
    version?: string;
    apiUrl?: string;
    error?: string;
}

export interface OllamaModelsResponse {
    success: boolean;
    models: OllamaModel[];
    count: number;
    error?: string;
}

export interface OllamaDetailedModelsResponse {
    success: boolean;
    models: DetailedOllamaModel[];
    count: number;
    error?: string;
}

export interface OllamaChatResponse {
    success: boolean;
    response: string;
    model?: string;
    done?: boolean;
    totalDuration?: number;
    loadDuration?: number;
    promptEvalCount?: number;
    evalCount?: number;
    error?: string;
}

export interface OllamaGenerateResponse {
    success: boolean;
    response: string;
    model?: string;
    done?: boolean;
    totalDuration?: number;
    loadDuration?: number;
    promptEvalCount?: number;
    evalCount?: number;
    error?: string;
}

export interface OllamaPullResponse {
    success: boolean;
    status?: string;
    model?: string;
    response?: unknown;
    error?: string;
}

export interface OllamaAvailabilityResponse {
    success: boolean;
    exists: boolean;
    available?: boolean;
    name: string;
    message?: string;
    details?: unknown;
    error?: string;
}

export interface OllamaDeleteResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export interface OllamaShowResponse {
    success: boolean;
    modelfile?: string;
    parameters?: string;
    template?: string;
    details?: unknown;
    error?: string;
}

interface OllamaRawTag {
    name: string;
    size?: number;
    modified_at?: string;
    details?: unknown;
}

interface OllamaRawResponse {
    models?: OllamaRawTag[];
    message?: { content?: string };
    model?: string;
    done?: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
    version?: string;
    status?: string;
    modelfile?: string;
    parameters?: string;
    template?: string;
    details?: unknown;
    response?: string;
}

class OllamaService {
    public baseUrl: string;
    private timeout: number;
    private shortTimeout: number;

    constructor() {
        this.baseUrl = config.ollama?.url || 'http://localhost:11434';
        this.timeout = 300000; // 5 minutes timeout for chat operations
        this.shortTimeout = 5000; // 5 seconds for status checks
    }

    // Generic method to make Ollama API requests
    async makeRequest(endpoint: string, method = 'GET', data: unknown = null, timeout: number | null = null): Promise<OllamaRawResponse> {
        const url = new URL(endpoint, this.baseUrl);
        
        const options: RequestInit = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(timeout || this.timeout)
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url.toString(), options);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Endpoint not found: ${endpoint}`);
                }
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const responseText = await response.text();
            return (responseText ? JSON.parse(responseText) : {}) as OllamaRawResponse;
            
        } catch (error: unknown) {
            const err = error as { name?: string; cause?: { code?: string } };
            if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            if (err.cause?.code === 'ECONNREFUSED') {
                throw new Error('Connection refused - Ollama service not running');
            }
            throw error;
        }
    }

    // Get available models
    async getModels(): Promise<OllamaModelsResponse> {
        try {
            const response = await this.makeRequest('/api/tags', 'GET', null, this.shortTimeout);
            const models = response.models || [];

            return {
                success: true,
                models: models.map((model) => ({
                    name: model.name,
                    size: this.formatBytes(model.size || 0),
                    modified: model.modified_at || 'Unknown',
                    details: model.details || {}
                })),
                count: models.length
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama get models error:', err);
            return {
                success: false,
                error: err.message,
                models: [],
                count: 0
            };
        }
    }

    // Send chat message
    async sendChat(messages: unknown[], modelName: string, stream = false): Promise<OllamaChatResponse> {
        try {
            const data = {
                model: modelName,
                messages: messages,
                stream: stream
            };

            const response = await this.makeRequest('/api/chat', 'POST', data);
            
            return {
                success: true,
                response: response.message?.content || '',
                model: response.model || modelName,
                done: response.done || false,
                totalDuration: response.total_duration || 0,
                loadDuration: response.load_duration || 0,
                promptEvalCount: response.prompt_eval_count || 0,
                evalCount: response.eval_count || 0
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama chat error:', err);
            return {
                success: false,
                error: err.message,
                response: ''
            };
        }
    }

    // Generate completion (for non-chat models)
    async generate(prompt: string, modelName: string, options: Record<string, unknown> = {}): Promise<OllamaGenerateResponse> {
        try {
            const data = {
                model: modelName,
                prompt: prompt,
                stream: false,
                ...options
            };

            const response = await this.makeRequest('/api/generate', 'POST', data);
            
            return {
                success: true,
                response: response.response || '',
                model: response.model || modelName,
                done: response.done || false,
                totalDuration: response.total_duration || 0,
                loadDuration: response.load_duration || 0,
                promptEvalCount: response.prompt_eval_count || 0,
                evalCount: response.eval_count || 0
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama generate error:', err);
            return {
                success: false,
                error: err.message,
                response: ''
            };
        }
    }

    // Get Ollama version and status
    async getStatus(): Promise<OllamaStatusResponse> {
        try {
            const response = await this.makeRequest('/api/version', 'GET', null, this.shortTimeout);
            
            return {
                success: true,
                status: 'online',
                version: response.version || 'Unknown',
                apiUrl: this.baseUrl
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama status error:', err);
            return {
                success: false,
                status: 'offline',
                error: err.message.includes('Connection refused') ? 'Service not running' : 'Service not responding',
                apiUrl: this.baseUrl
            };
        }
    }

    // Pull a model from Ollama library with progress tracking
    async pullModel(modelName: string, stream = true): Promise<OllamaPullResponse> {
        try {
            const data = {
                name: modelName,
                stream: stream
            };

            const response = await this.makeRequest('/api/pull', 'POST', data);
            
            return {
                success: true,
                status: response.status || 'completed',
                model: modelName,
                response: response
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama pull model error:', err);
            return {
                success: false,
                error: err.message,
                model: modelName
            };
        }
    }

    // Check if a model is available in Ollama library (more comprehensive check)
    async checkModelAvailability(modelName: string): Promise<OllamaAvailabilityResponse> {
        try {
            // First check if model exists locally
            const localModels = await this.getModelNames();
            if (localModels.includes(modelName)) {
                // Get detailed info for local model
                const modelInfo = await this.showModel(modelName);
                return {
                    success: true,
                    exists: true,
                    name: modelName,
                    message: `Model "${modelName}" is already downloaded`,
                    details: modelInfo.success ? modelInfo.details : {}
                };
            }

            // For remote availability, try to get info from Ollama registry
            // This is a simple validation - Ollama will validate during pull
            if (this.isValidModelName(modelName)) {
                return {
                    success: true,
                    exists: false,
                    available: true,
                    name: modelName,
                    message: `Model "${modelName}" is available for download from Ollama library`
                };
            } else {
                return {
                    success: false,
                    exists: false,
                    available: false,
                    name: modelName,
                    error: 'Invalid model name format'
                };
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama check model availability error:', err);
            return {
                success: false,
                error: err.message,
                exists: false,
                available: false,
                name: modelName
            };
        }
    }

    // Get detailed information about downloaded models
    async getDetailedModels(): Promise<OllamaDetailedModelsResponse> {
        try {
            const response = await this.makeRequest('/api/tags', 'GET', null, this.shortTimeout);
            const models = response.models || [];

            return {
                success: true,
                models: models.map((model) => ({
                    name: model.name || '',
                    size: model.size || 0,
                    sizeFormatted: this.formatBytes(model.size || 0),
                    modified: model.modified_at || 'Unknown',
                    digest: (model as { digest?: string }).digest || '',
                    details: model.details || {}
                })),
                count: models.length
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama get detailed models error:', err);
            return {
                success: false,
                error: err.message,
                models: [],
                count: 0
            };
        }
    }

    // Delete a model
    async deleteModel(modelName: string): Promise<OllamaDeleteResponse> {
        try {
            const data = {
                name: modelName
            };

            await this.makeRequest('/api/delete', 'DELETE', data, this.shortTimeout);
            
            return {
                success: true,
                message: `Model ${modelName} deleted successfully`
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama delete model error:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    // Show model information
    async showModel(modelName: string): Promise<OllamaShowResponse> {
        try {
            const data = {
                name: modelName
            };

            const response = await this.makeRequest('/api/show', 'POST', data, this.shortTimeout);
            
            return {
                success: true,
                modelfile: response.modelfile || '',
                parameters: response.parameters || '',
                template: response.template || '',
                details: response.details || {}
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Ollama show model error:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    // Check if Ollama service is available
    async isAvailable(): Promise<boolean> {
        try {
            const status = await this.getStatus();
            return status.success && status.status === 'online';
        } catch {
            return false;
        }
    }

    // Get list of model names only
    async getModelNames(): Promise<string[]> {
        try {
            const modelsResult = await this.getModels();
            if (modelsResult.success) {
                return modelsResult.models.map((model) => model.name);
            }
            return [];
        } catch (error) {
            console.error('Error getting model names:', error);
            return [];
        }
    }

    // Helper method to format bytes
    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Estimate token count for text using simple character-based estimation
    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    // Validate model name format
    isValidModelName(modelName: string): boolean {
        if (!modelName || typeof modelName !== 'string') {
            return false;
        }
        
        const validPattern = /^[a-zA-Z0-9\-_.:]+$/;
        return validPattern.test(modelName.trim());
    }
}

export default OllamaService;
