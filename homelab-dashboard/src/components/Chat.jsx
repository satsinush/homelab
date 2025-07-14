// src/components/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
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
    Tooltip,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    Send as SendIcon,
    Person as PersonIcon,
    SmartToy as BotIcon,
    Settings as SettingsIcon,
    Refresh as RefreshIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [availableModels, setAvailableModels] = useState([]);
    const [currentModel, setCurrentModel] = useState('');
    const [ollamaStatus, setOllamaStatus] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [streamingEnabled, setStreamingEnabled] = useState(() => {
        // Load streaming preference from localStorage, default to true
        const saved = localStorage.getItem('chat_streaming_enabled');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const { showError, showSuccess } = useNotification();

    useEffect(() => {
        checkOllamaStatus();
        fetchModels();
        // Add welcome message
        setMessages([{
            id: 1,
            type: 'assistant',
            content: 'Hello! I\'m HomeBot, your personal AI assistant. How can I help you today?',
            timestamp: new Date().toISOString()
        }]);
    }, []);

    // Save streaming preference to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('chat_streaming_enabled', JSON.stringify(streamingEnabled));
    }, [streamingEnabled]);

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
            if (response.data.currentModel) {
                setCurrentModel(response.data.currentModel);
            }
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

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        if (streamingEnabled) {
            await handleStreamingMessage(userMessage);
        } else {
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
            const response = await fetch(`https://admin.rpi5-server.home.arpa/api/chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    conversationId: conversationId,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

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

                                if (data.conversationId && !conversationId) {
                                    setConversationId(data.conversationId);
                                }
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
            showError('Failed to send message: ' + error.message);

            // Remove the failed message
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
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
                    conversationId: conversationId,
                    stream: false
                }
            });

            const assistantMessage = {
                id: Date.now() + 1,
                type: 'assistant',
                content: response.data.message,
                timestamp: response.data.timestamp,
                responseTime: response.data.responseTime,
                model: response.data.model
            };

            setMessages(prev => [...prev, assistantMessage]);

            if (response.data.conversationId && !conversationId) {
                setConversationId(response.data.conversationId);
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

    const clearConversation = () => {
        setMessages([{
            id: 1,
            type: 'assistant',
            content: 'Hello! I\'m HomeBot, your AI assistant. How can I help you today?',
            timestamp: new Date().toISOString()
        }]);
        setConversationId(null);
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
                        {currentModel && (
                            <Chip
                                label={`Model: ${currentModel}`}
                                variant="outlined"
                                size="small"
                            />
                        )}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Refresh Status">
                        <IconButton onClick={checkOllamaStatus} color="primary">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Clear Conversation">
                        <IconButton onClick={clearConversation} color="secondary">
                            <ClearIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Settings">
                        <IconButton
                            onClick={() => setShowSettings(!showSettings)}
                            color={showSettings ? 'primary' : 'default'}
                        >
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Settings Panel */}
            {showSettings && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Chat Settings
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={fetchModels}
                                startIcon={<RefreshIcon />}
                            >
                                Refresh Models
                            </Button>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={streamingEnabled}
                                        onChange={(e) => setStreamingEnabled(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label="Real-time streaming"
                            />
                        </Box>
                    </CardContent>
                </Card>
            )}

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
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {message.content}
                                        </Typography>
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
