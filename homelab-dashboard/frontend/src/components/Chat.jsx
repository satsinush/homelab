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
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import {
    Send as SendIcon,
    Person as PersonIcon,
    SmartToy as BotIcon,
    Settings as SettingsIcon, // This icon seems unused, consider removing if not needed.
    Refresh as RefreshIcon,
    Clear as ClearIcon,
    Download as DownloadIcon,
    Storage as StorageIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { formatDevicesForDisplay, formatMacForDisplay, normalizeMacForApi } from '../utils/formatters';

const Chat = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false); // Indicates if any API call (fetch, send) is in progress
    const [availableModels, setAvailableModels] = useState([]);
    const [currentModel, setCurrentModel] = useState('');
    const [ollamaStatus, setOllamaStatus] = useState(null);
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [modelToDownload, setModelToDownload] = useState('');
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [manageModelsOpen, setManageModelsOpen] = useState(false);
    const [detailedModels, setDetailedModels] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const { showError, showSuccess, showConfirmDialog } = useNotification();

    useEffect(() => {
        checkOllamaStatus();
        fetchModels();
        fetchConversationHistory();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const checkOllamaStatus = async () => {
        setIsLoading(true); // Indicate loading for status check
        try {
            const response = await tryApiCall('/chat/status');
            setOllamaStatus(response.data);
        } catch (error) {
            console.error('Failed to check Ollama status:', error);
            setOllamaStatus({ status: 'offline', error: 'Failed to connect' });
        } finally {
            setIsLoading(false); // End loading after status check
        }
    };

    const fetchModels = async () => {
        setIsLoading(true); // Indicate loading for model fetch
        try {
            const response = await tryApiCall('/chat/models');
            setAvailableModels(response.data.models || []);
            if (response.data.currentModel) {
                setCurrentModel(response.data.currentModel);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            // Use the specific error message from the API
            showError(error.message || 'Failed to fetch available models');
        } finally {
            setIsLoading(false); // End loading after model fetch
        }
    };

    const fetchConversationHistory = async () => {
        try {
            const response = await tryApiCall('/chat/conversation');
            if (response.data.conversationHistory) {
                // Ensure unique IDs for history messages as well
                const historyMessages = response.data.conversationHistory.map((msg, index) => ({
                    id: `history-${Date.now() + index}`, // Unique ID for history items
                    type: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    message: msg.message || msg.content, // Use message if available, otherwise content
                    actions: msg.actions || [],
                    timestamp: msg.timestamp || new Date().toISOString() // Use existing timestamp or new one
                }));
                setMessages(historyMessages);
            }
        } catch (error) {
            console.error('Failed to fetch conversation history:', error);
            // Don't show error to user as this is a background operation, maybe a console error is enough
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading || ollamaStatus?.status === 'offline' || availableModels.length === 0) return;

        // Client-side character limit check
        if (inputMessage.trim().length > 1000) {
            showError('Message is too long. Please limit your message to 1000 characters.');
            return;
        }

        // Check if we have a current model
        if (!currentModel) {
            showError('No model selected. Please select a model or download one first.');
            return;
        }

        const userMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: inputMessage.trim(),
            message: inputMessage.trim(),
            timestamp: new Date().toISOString()
        };

        // Add user message immediately
        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true); // Start global loading indicator

        // Add a "thinking" message placeholder immediately
        const thinkingMessage = {
            id: `thinking-${Date.now() + 1}`,
            type: 'assistant',
            content: '', // No content yet
            message: '', // No content yet
            thinking: true, // Custom flag for thinking state
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, thinkingMessage]);

        // Send message and await full response (non-streaming)
        try {
            const response = await tryApiCall('/chat/message', {
                method: 'POST',
                timeout: 300000, // 5 minutes for chat responses
                data: {
                    message: userMessage.content,
                    stream: false // Explicitly set to false
                }
            });

            if (response.data.conversationHistory) {
                // Replace messages with the full conversation history from the server
                // This ensures consistency and proper ordering, especially if backend manages conversation state
                const frontendMessages = response.data.conversationHistory.map((msg, index) => ({
                    id: `history-${Date.now() + index}`,
                    type: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    message: msg.message || msg.content,
                    actions: msg.actions || [],
                    timestamp: msg.timestamp || new Date().toISOString()
                }));
                setMessages(frontendMessages);
            }

            if (response.data.actions) {
                // Handle any actions that were executed as a result of the message
                response.data.actions.forEach(action => {
                    if (action.status === 'success') {
                        showSuccess(action.message);
                    } else {
                        showError(action.message);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            // Remove the thinking message and add an error message
            setMessages(prevMessages => {
                const filteredMessages = prevMessages.filter(msg => msg.id !== thinkingMessage.id);
                const errorMessage = {
                    id: `error-${Date.now() + 3}`,
                    type: 'error',
                    content: error.message || 'Failed to get response',
                    message: error.message || 'Failed to get response',
                    actions: [],
                    timestamp: new Date().toISOString()
                };
                return [...filteredMessages, errorMessage];
            });
            // Use the specific error message from the API
            showError(error.message || 'Failed to send message');
        } finally {
            setIsLoading(false); // End global loading indicator
            // Ensure focus returns to input after send attempt
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (event) => {
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
            // Use the specific error message from the API
            showError(error.message || 'Failed to change model');
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
                    // Use the specific error message from the API
                    showError(error.message || 'Failed to clear conversation');
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

    const handleDownloadClick = () => {
        setDownloadDialogOpen(true);
        setModelToDownload('');
    };

    const handleConfirmDownload = async () => {
        if (!modelToDownload.trim()) {
            return;
        }

        setDownloadLoading(true);
        try {
            // Attempt to download the model
            const response = await tryApiCall('/chat/download-model', {
                method: 'POST',
                timeout: 600000, // 10 minutes for model download
                data: {
                    modelName: modelToDownload.trim()
                }
            });

            showSuccess(response.data.message || `Model "${modelToDownload}" downloaded successfully`);
            setDownloadDialogOpen(false);
            setModelToDownload('');

            // Refresh models list
            fetchModels();
        } catch (error) {
            console.error('Failed to download model:', error);
            showError(error.message || 'Failed to download model');
        } finally {
            setDownloadLoading(false);
        }
    };

    const handleCloseDownloadDialog = () => {
        if (!downloadLoading) {
            setDownloadDialogOpen(false);
            setModelToDownload('');
        }
    };

    const handleManageModelsClick = async () => {
        setManageModelsOpen(true);
        await fetchDetailedModels();
    };

    const fetchDetailedModels = async () => {
        try {
            const response = await tryApiCall('/chat/models-detailed');
            setDetailedModels(response.data.models || []);
        } catch (error) {
            console.error('Failed to fetch detailed models:', error);
            showError(error.message || 'Failed to fetch model details');
        }
    };

    const handleDeleteModel = async (modelName) => {
        showConfirmDialog({
            title: 'Delete Model',
            message: `Are you sure you want to delete the model "${modelName}"? This action cannot be undone and will free up disk space.`,
            confirmText: 'Delete',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    const response = await tryApiCall(`/chat/delete-model/${encodeURIComponent(modelName)}`, {
                        method: 'DELETE'
                    });

                    showSuccess(response.data.message || `Model "${modelName}" deleted successfully`);

                    // Refresh both model lists
                    await fetchDetailedModels();
                    await fetchModels();
                } catch (error) {
                    console.error('Failed to delete model:', error);
                    showError(error.message || 'Failed to delete model');
                }
            }
        });
    };

    const handleCloseManageModels = () => {
        setManageModelsOpen(false);
        setDetailedModels([]);
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
                        {availableModels.length > 0 ? (
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel>Model</InputLabel>
                                <Select
                                    value={currentModel}
                                    label="Model"
                                    onChange={(e) => handleModelChange(e.target.value)}
                                >
                                    {availableModels.map((model) => (
                                        <MenuItem key={model.name} value={model.name}>
                                            {model.name} ({model.size})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : ollamaStatus?.status === 'online' && (
                            <>
                                <Chip
                                    label="No models available"
                                    color="warning"
                                    size="small"
                                    variant="outlined"
                                />
                                <Button
                                    onClick={handleDownloadClick}
                                    variant="contained"
                                    startIcon={<DownloadIcon />}
                                >
                                    {'Download Model'}
                                </Button>
                            </>
                        )}
                        <Tooltip title="Refresh Status">
                            <span>
                                <IconButton onClick={checkOllamaStatus} color="primary" disabled={isLoading}>
                                    <RefreshIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Clear Conversation">
                            <span>
                                <IconButton onClick={handleClearConversation} color="secondary" disabled={isLoading}>
                                    <ClearIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Manage Models">
                            <span>
                                <IconButton onClick={handleManageModelsClick} color="secondary" disabled={isLoading || ollamaStatus?.status === 'offline'}>
                                    <StorageIcon />
                                </IconButton>
                            </span>
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
                                    {/* Show loading indicator when thinking */}
                                    {message.type === 'assistant' && message.thinking ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={16} />
                                            <Typography variant="body2" color="text.secondary">
                                                Thinking...
                                            </Typography>
                                        </Box>
                                    ) : (
                                        // Render markdown for assistant messages, plain text for others
                                        message.type === 'assistant' ? (
                                            <>
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ children }) => {
                                                            // Instead of Typography component="p", use a plain Box or Typography without "component" prop
                                                            // to avoid strict <p> tag nesting rules, allowing <pre> as a child.
                                                            // Typography defaults to 'p' if component prop is not passed, which is still problematic.
                                                            // So, using a Box is the safest bet for a generic container.
                                                            return (
                                                                <Box sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
                                                                    {children}
                                                                </Box>
                                                            );
                                                        },
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
                                                        code: ({ inline, children }) =>
                                                            inline ? (
                                                                <Box
                                                                    component="code"
                                                                    sx={{
                                                                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                                                                        color: (theme) => theme.palette.mode === 'dark' ? 'primary.light' : 'primary.dark',
                                                                        padding: '2px 4px',
                                                                        borderRadius: '4px',
                                                                        fontFamily: 'monospace',
                                                                        fontSize: '0.875em'
                                                                    }}
                                                                >
                                                                    {children}
                                                                </Box>
                                                            ) : (
                                                                <Box // This Box with component="pre" is fine as it's the custom component for code blocks
                                                                    component="pre"
                                                                    sx={{
                                                                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                                                                        color: (theme) => theme.palette.mode === 'dark' ? 'primary.light' : 'primary.dark',
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
                                                    {message.message}
                                                </ReactMarkdown>
                                            </>
                                        ) : (
                                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                                {message.message}
                                            </Typography>
                                        )
                                    )}
                                    {/* Render action chips for assistant messages with actions */}
                                    {Array.isArray(message.actions) && message.actions.length > 0 && (
                                        <>
                                            <Box sx={{ borderTop: 1, borderColor: 'divider', my: 1 }} />
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                                                {message.actions.map((action, idx) => (
                                                    <Chip
                                                        key={idx}
                                                        label={action.message || action.action}
                                                        color={
                                                            action.message && action.status === 'success'
                                                                ? 'info'
                                                                : 'error'
                                                        }
                                                        variant="filled"
                                                        size="small"
                                                    />
                                                ))}
                                            </Box>
                                        </>
                                    )}
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
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    availableModels.length === 0
                                        ? "Download a model first to start chatting..."
                                        : "Type your message... (Shift+Enter for new line)"
                                }
                                disabled={isLoading || ollamaStatus?.status === 'offline' || availableModels.length === 0}
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
                            disabled={!inputMessage.trim() || isLoading || ollamaStatus?.status === 'offline' || availableModels.length === 0 || inputMessage.length > 1000}
                            sx={{ minWidth: 'auto', px: 2, alignSelf: 'flex-start' }}
                        >
                            <SendIcon />
                        </Button>
                    </Box>
                </Box>
            </Card>

            {/* Download Model Dialog */}
            <Dialog
                open={downloadDialogOpen}
                onClose={handleCloseDownloadDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Download Model</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            fullWidth
                            label="Model Name"
                            value={modelToDownload}
                            onChange={(e) => setModelToDownload(e.target.value)}
                            placeholder="e.g., llama3.1, codellama, mistral"
                            disabled={downloadLoading}
                            helperText="Enter the name of the model from Ollama library (e.g., llama3.1, codellama, mistral)"
                            sx={{ mb: 2 }}
                        />

                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                Models will be downloaded from the Ollama library. Download size may be several GB and can take several minutes.
                            </Typography>
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDownloadDialog} disabled={downloadLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDownload}
                        variant="contained"
                        disabled={!modelToDownload.trim() || downloadLoading}
                        startIcon={downloadLoading ? <CircularProgress size={16} /> : <DownloadIcon />}
                    >
                        {downloadLoading ? 'Downloading...' : 'Download Model'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Manage Models Dialog */}
            <Dialog
                open={manageModelsOpen}
                onClose={handleCloseManageModels}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Manage Models</DialogTitle>
                <DialogContent>
                    {detailedModels.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <Typography variant="body1" color="text.secondary">
                                No models downloaded yet.
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Model Name</TableCell>
                                        <TableCell align="right">Size</TableCell>
                                        <TableCell align="right">Modified</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {detailedModels.map((model) => (
                                        <TableRow key={model.name}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="body1">
                                                        {model.name}
                                                    </Typography>
                                                    {currentModel === model.name && (
                                                        <Chip label="Current" size="small" color="primary" />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2">
                                                    {model.sizeFormatted}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Typography variant="body2" color="text.secondary">
                                                    {new Date(model.modified).toLocaleDateString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title={"Delete model"}>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteModel(model.name)}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseManageModels}>
                        Close
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => {
                            handleCloseManageModels();
                            handleDownloadClick();
                        }}
                    >
                        Download New Model
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default Chat;