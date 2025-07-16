// src/components/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Avatar,
    Paper,
    IconButton,
    Chip,
    CircularProgress,
    Container,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Alert,
    Tooltip
} from '@mui/material';
import {
    Send as SendIcon,
    Person as PersonIcon,
    SmartToy as BotIcon,
    Settings as SettingsIcon,
    Refresh as RefreshIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import { tryApiCall, tryStreamingApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [availableModels, setAvailableModels] = useState([]);
    const [currentModel, setCurrentModel] = useState('');
    const [ollamaStatus, setOllamaStatus] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const { showError, showSuccess, showConfirmDialog } = useNotification();

    useEffect(() => {
        checkOllamaStatus();
        fetchModels();
        // Load existing conversation history for the user
        fetchConversationHistory();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const checkOllamaStatus = async () => {
        try {
            const response = await tryApiCall('/chat/status');
            setOllamaStatus(response.data);
        } catch (error) {
            console.error('Failed to check Ollama status:', error);
            setOllamaStatus({ status: 'offline', error: 'Failed to connect' });
        }
    };

    const fetchModels = async () => {
        try {
            const response = await tryApiCall('/chat/models');
            setAvailableModels(response.data.models || []);
            if (response.data.currentModel) {
                setCurrentModel(response.data.currentModel);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            showError('Failed to fetch available models');
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        // Client-side character limit check
        if (inputMessage.trim().length > 1000) {
            showError('Message is too long. Please limit your message to 1000 characters.');
            return;
        }

        const userMessage = {
            id: Date.now(),
            type: 'user',
            content: inputMessage.trim(),
            timestamp: new Date().toISOString()
        };

        // Always add user message immediately for immediate feedback
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        // Try streaming first, fall back to regular response if streaming fails
        try {
            await handleStreamingMessage(userMessage);
        } catch (streamingError) {
            console.warn('Streaming failed, falling back to regular response:', streamingError);
            await handleNonStreamingMessage(userMessage);
        }
    };

    const handleStreamingMessage = async (userMessage) => {
        // Create assistant message placeholder with "Thinking..." content
        const assistantMessageId = Date.now() + 1;
        const assistantMessage = {
            id: assistantMessageId,
            type: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            streaming: true,
            thinking: true, // Add thinking state
            model: currentModel
        };

        setMessages(prev => [...prev, assistantMessage]);

        try {
            const { response } = await tryStreamingApiCall('/chat/message', {
                data: {
                    message: userMessage.content,
                    stream: true
                }
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            console.log('Streaming response started...');

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('Stream ended');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'start') {
                                console.log('Stream started:', data.message);
                                // Update conversation history but keep the streaming assistant message
                                if (data.conversationHistory) {
                                    updateConversationHistory(data.conversationHistory, true);
                                }
                                // Keep thinking state until first chunk
                            } else if (data.type === 'chunk') {
                                // Switch from thinking to streaming content
                                setMessages(prev => prev.map(msg =>
                                    msg.id === assistantMessageId
                                        ? {
                                            ...msg,
                                            content: msg.content + data.content,
                                            thinking: false // Remove thinking state
                                        }
                                        : msg
                                ));
                            } else if (data.type === 'complete') {
                                // Mark the streaming message as complete first
                                setMessages(prev => prev.map(msg =>
                                    msg.id === assistantMessageId
                                        ? {
                                            ...msg,
                                            streaming: false,
                                            thinking: false,
                                            responseTime: data.responseTime,
                                            timestamp: data.timestamp
                                        }
                                        : msg
                                ));

                                // After streaming is complete, get the authoritative conversation history
                                // This replaces everything with the server's version for consistency
                                setTimeout(() => {
                                    fetchConversationHistory();
                                }, 100); // Small delay to ensure the streaming state update completes first
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (parseError) {
                            console.warn('Parse error:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming error:', error);

            // Remove the failed message
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));

            // Re-throw the error so handleSendMessage can catch it and fall back
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const handleNonStreamingMessage = async (userMessage) => {
        try {
            const response = await tryApiCall('/chat/message', {
                method: 'POST',
                timeout: 150000, // 2.5 minutes for chat responses
                data: {
                    message: userMessage.content,
                    stream: false
                }
            });

            // Update conversation history from server response
            if (response.data.conversationHistory) {
                updateConversationHistory(response.data.conversationHistory);
            } else {
                // Fallback: add the assistant message manually if no history provided
                const assistantMessage = {
                    id: Date.now() + 1,
                    type: 'assistant',
                    content: response.data.message,
                    timestamp: response.data.timestamp,
                    responseTime: response.data.responseTime,
                    model: response.data.model
                };

                setMessages(prev => [...prev, assistantMessage]);
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage = {
                id: Date.now() + 1,
                type: 'error',
                content: error.message || 'Failed to get response from AI',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
            showError('Failed to send message');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleModelChange = async (newModel) => {
        try {
            await tryApiCall('/chat/model', {
                method: 'POST',
                data: { modelName: newModel }
            });
            setCurrentModel(newModel);
            showSuccess(`Switched to model: ${newModel}`);
        } catch (error) {
            console.error('Failed to change model:', error);
            showError('Failed to change model');
        }
    };

    const handleClearConversation = async () => {
        showConfirmDialog({
            title: 'Clear Conversation',
            message: 'Are you sure you want to clear your entire conversation history? This action cannot be undone.',
            confirmText: 'Clear',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    await tryApiCall('/chat/conversation', { method: 'DELETE' });
                    setMessages([]);
                    showSuccess('Conversation cleared');
                } catch (error) {
                    console.error('Failed to clear conversation:', error);
                    showError('Failed to clear conversation');
                }
            }
        });
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'online': return 'success';
            case 'offline': return 'error';
            default: return 'warning';
        }
    };

    // Convert Ollama messages to frontend format
    const convertOllamaMessagesToFrontend = (ollamaMessages) => {
        return ollamaMessages.map((msg, index) => ({
            id: Date.now() + index,
            type: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
            timestamp: new Date().toISOString()
        }));
    };

    // Update conversation history from server response
    const updateConversationHistory = (conversationHistory, keepStreamingMessage = false) => {
        if (conversationHistory && conversationHistory.length > 0) {
            const frontendMessages = convertOllamaMessagesToFrontend(conversationHistory);

            if (keepStreamingMessage) {
                // During streaming, find any existing streaming message and preserve it
                setMessages(prev => {
                    const streamingMessage = prev.find(msg => msg.streaming || msg.thinking);
                    if (streamingMessage) {
                        return [...frontendMessages, streamingMessage];
                    }
                    return frontendMessages;
                });
            } else {
                // Replace all messages with server history (after streaming completes)
                setMessages(frontendMessages);
            }
        }
    };

    // Fetch conversation history from server (for streaming completion)
    const fetchConversationHistory = async () => {
        try {
            const response = await tryApiCall('/chat/conversation');
            if (response.data.conversationHistory) {
                updateConversationHistory(response.data.conversationHistory);
            }
        } catch (error) {
            console.error('Failed to fetch conversation history:', error);
            // Don't show error to user as this is a background operation
        }
    };

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 }, width: '100%', minHeight: 'calc(100vh - 64px)' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                        AI Chat Assistant
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {ollamaStatus && (
                            <Chip
                                label={ollamaStatus.status === 'online' ? 'Online' : 'Offline'}
                                color={getStatusColor(ollamaStatus.status)}
                                icon={<BotIcon />}
                                size="small"
                            />
                        )}
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Model</InputLabel>
                            <Select
                                value={currentModel}
                                label="Model"
                                onChange={(e) => handleModelChange(e.target.value)}
                                disabled={availableModels.length === 0}
                            >
                                {availableModels.map((model) => (
                                    <MenuItem key={model.name} value={model.name}>
                                        {model.name} ({model.size})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Tooltip title="Refresh Status">
                            <IconButton onClick={checkOllamaStatus} color="primary">
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear Conversation">
                            <IconButton onClick={handleClearConversation} color="secondary">
                                <ClearIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {/* Status Alert */}
            {ollamaStatus && ollamaStatus.status === 'offline' && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Ollama is offline. Please ensure Ollama is installed and running to use the chat feature.
                </Alert>
            )}

            {/* Chat Container */}
            <Card sx={{ height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
                {/* Messages Area */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2
                    }}
                >
                    {messages.map((message) => (
                        <Box
                            key={message.id}
                            sx={{
                                display: 'flex',
                                justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                                mb: 1
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    maxWidth: '80%'
                                }}
                            >
                                <Avatar
                                    sx={{
                                        bgcolor: message.type === 'user' ? 'primary.main' :
                                            message.type === 'error' ? 'error.main' : 'secondary.main',
                                        width: 32,
                                        height: 32,
                                        color: message.type === 'user' ? 'primary.contrastText' :
                                            message.type === 'error' ? 'error.contrastText' : 'secondary.contrastText'
                                    }}
                                >
                                    {message.type === 'user' ? <PersonIcon /> : <BotIcon />}
                                </Avatar>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 2,
                                        bgcolor: message.type === 'user' ? 'primary.main' :
                                            message.type === 'error' ? 'error.main' : 'background.paper',
                                        color: message.type === 'user' ? 'primary.contrastText' :
                                            message.type === 'error' ? 'error.contrastText' : 'text.primary',
                                        borderRadius: 2,
                                        wordBreak: 'break-word',
                                        border: message.type === 'user' ? 'none' :
                                            message.type === 'error' ? 'none' : '1px solid',
                                        borderColor: message.type === 'user' ? 'transparent' :
                                            message.type === 'error' ? 'transparent' : 'divider'
                                    }}
                                >
                                    {/* Show loading indicator when thinking or streaming with no content yet */}
                                    {message.type === 'assistant' && (message.thinking || (message.streaming && !message.content)) ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={16} />
                                            <Typography variant="body2" color="text.secondary">
                                                Thinking...
                                            </Typography>
                                        </Box>
                                    ) : (
                                        // Render markdown for assistant messages, plain text for others
                                        message.type === 'assistant' ? (
                                            <ReactMarkdown
                                                components={{
                                                    // Customize markdown components to use Material-UI styling
                                                    p: ({ children }) => (
                                                        <Typography variant="body1" sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                                                            {children}
                                                        </Typography>
                                                    ),
                                                    h1: ({ children }) => (
                                                        <Typography variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                                                            {children}
                                                        </Typography>
                                                    ),
                                                    h2: ({ children }) => (
                                                        <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}>
                                                            {children}
                                                        </Typography>
                                                    ),
                                                    h3: ({ children }) => (
                                                        <Typography variant="h6" sx={{ mt: 1.5, mb: 1, fontWeight: 'bold' }}>
                                                            {children}
                                                        </Typography>
                                                    ),
                                                    code: ({ inline, children }) => (
                                                        inline ? (
                                                            <Box
                                                                component="code"
                                                                sx={{
                                                                    backgroundColor: 'grey.100',
                                                                    padding: '2px 4px',
                                                                    borderRadius: '4px',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.875em'
                                                                }}
                                                            >
                                                                {children}
                                                            </Box>
                                                        ) : (
                                                            <Box
                                                                component="pre"
                                                                sx={{
                                                                    backgroundColor: 'grey.100',
                                                                    padding: 2,
                                                                    borderRadius: 1,
                                                                    overflow: 'auto',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.875em',
                                                                    my: 1
                                                                }}
                                                            >
                                                                <code>{children}</code>
                                                            </Box>
                                                        )
                                                    ),
                                                    ul: ({ children }) => (
                                                        <Box component="ul" sx={{ pl: 2, my: 1 }}>
                                                            {children}
                                                        </Box>
                                                    ),
                                                    ol: ({ children }) => (
                                                        <Box component="ol" sx={{ pl: 2, my: 1 }}>
                                                            {children}
                                                        </Box>
                                                    ),
                                                    li: ({ children }) => (
                                                        <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
                                                            {children}
                                                        </Typography>
                                                    ),
                                                    blockquote: ({ children }) => (
                                                        <Box
                                                            sx={{
                                                                borderLeft: '4px solid',
                                                                borderColor: 'primary.main',
                                                                pl: 2,
                                                                py: 1,
                                                                backgroundColor: 'grey.50',
                                                                fontStyle: 'italic',
                                                                my: 1
                                                            }}
                                                        >
                                                            {children}
                                                        </Box>
                                                    )
                                                }}
                                            >
                                                {message.content}
                                            </ReactMarkdown>
                                        ) : (
                                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                                {message.content}
                                            </Typography>
                                        )
                                    )}
                                    {/* <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                        <Typography variant="caption" sx={{
                                            opacity: 0.7,
                                            color: message.type === 'user' ? 'primary.contrastText' :
                                                message.type === 'error' ? 'error.contrastText' : 'text.secondary'
                                        }}>
                                            {formatTimestamp(message.timestamp)}
                                        </Typography>
                                        {message.responseTime && (
                                            <Typography variant="caption" sx={{
                                                opacity: 0.7,
                                                color: message.type === 'user' ? 'primary.contrastText' :
                                                    message.type === 'error' ? 'error.contrastText' : 'text.secondary'
                                            }}>
                                                {message.responseTime}ms
                                            </Typography>
                                        )}
                                    </Box> */}
                                </Paper>
                            </Box>
                        </Box>
                    ))}

                    <div ref={messagesEndRef} />
                </Box>

                {/* Input Area */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                            <TextField
                                ref={inputRef}
                                fullWidth
                                multiline
                                maxRows={4}
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your message... (Shift+Enter for new line)"
                                disabled={isLoading || ollamaStatus?.status === 'offline'}
                                variant="outlined"
                                size="small"
                                error={inputMessage.length > 1000}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                                <Typography
                                    variant="caption"
                                    color={inputMessage.length > 1000 ? 'error' : inputMessage.length > 900 ? 'warning.main' : 'text.secondary'}
                                >
                                    {inputMessage.length}/1000 characters
                                </Typography>
                                {inputMessage.length > 1000 && (
                                    <Typography variant="caption" color="error">
                                        Message too long
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                        <Button
                            variant="contained"
                            onClick={handleSendMessage}
                            disabled={!inputMessage.trim() || isLoading || ollamaStatus?.status === 'offline' || inputMessage.length > 1000}
                            sx={{ minWidth: 'auto', px: 2, alignSelf: 'flex-start' }}
                        >
                            <SendIcon />
                        </Button>
                    </Box>
                </Box>
            </Card>
        </Container>
    );
};

export default Chat;
