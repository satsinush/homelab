// src/components/Chat.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Box,
    Card,
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import {
    Send as SendIcon,
    Person as PersonIcon,
    SmartToy as BotIcon,
    Refresh as RefreshIcon,
    Clear as ClearIcon,
    Download as DownloadIcon,
    Storage as StorageIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import {
    OllamaStatus,
    ChatModelsResponse,
    ChatConversationResponse,
    ChatModelsDetailedResponse,
} from '../types/api';

import { getErrorMessage } from '../utils/errors';

interface HistoryMessageItem {
    role: 'user' | 'assistant';
    content: string;
    message?: string;
    actions?: { status: string; message: string }[];
    timestamp?: string;
}

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'error';
    content: string;
    message?: string;
    actions?: { status?: string; message?: string; action?: string }[];
    timestamp: string;
    thinking?: boolean;
}

interface AvailableModel {
    name: string;
    size: string;
}

interface DetailedModel {
    name: string;
    sizeFormatted: string;
    modified: string;
}

const Chat = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
    const [currentModel, setCurrentModel] = useState('');
    const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
    const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
    const [modelToDownload, setModelToDownload] = useState('');
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [manageModelsOpen, setManageModelsOpen] = useState(false);
    const [detailedModels, setDetailedModels] = useState<DetailedModel[]>([]);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLDivElement | null>(null);
    const { showError, showSuccess, showConfirmDialog } = useNotification();

    const checkOllamaStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await tryApiCall<OllamaStatus>('/chat/status');
            setOllamaStatus(response.data);
        } catch (error) {
            console.error('Failed to check Ollama status:', error);
            setOllamaStatus({ status: 'offline', error: 'Failed to connect' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchModels = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await tryApiCall<ChatModelsResponse>('/chat/models');
            setAvailableModels(
                (response.data.models || []).map((m) => ({
                    name: m.name,
                    size: String(m.size ?? ''),
                }))
            );
            if (response.data.currentModel) {
                setCurrentModel(response.data.currentModel);
            }
        } catch (err) {
            console.error('Failed to fetch models:', err);
            showError(getErrorMessage(err) || 'Failed to fetch available models');
        } finally {
            setIsLoading(false);
        }
    }, [showError]);

    const fetchConversationHistory = useCallback(async () => {
        try {
            const response = await tryApiCall<ChatConversationResponse & { conversationHistory?: HistoryMessageItem[] }>('/chat/conversation');
            if (response.data.conversationHistory) {
                const historyMessages = response.data.conversationHistory.map((msg, index) => ({
                    id: `history-${Date.now() + index}`,
                    type: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    message: (msg as HistoryMessageItem).message || msg.content,
                    actions: (msg as HistoryMessageItem).actions || [],
                    timestamp: (msg as HistoryMessageItem).timestamp || new Date().toISOString()
                })) as ChatMessage[];
                setMessages(historyMessages);
            }
        } catch (error) {
            console.error('Failed to fetch conversation history:', error);
        }
    }, []);

    useEffect(() => {
        checkOllamaStatus();
        fetchModels();
        fetchConversationHistory();
    }, [checkOllamaStatus, fetchModels, fetchConversationHistory]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading || ollamaStatus?.status === 'offline' || availableModels.length === 0) return;

        if (inputMessage.trim().length > 1000) {
            showError('Message is too long. Please limit your message to 1000 characters.');
            return;
        }

        if (!currentModel) {
            showError('No model selected. Please select a model or download one first.');
            return;
        }

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            content: inputMessage.trim(),
            message: inputMessage.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        const thinkingMessage: ChatMessage = {
            id: `thinking-${Date.now() + 1}`,
            type: 'assistant',
            content: '',
            message: '',
            thinking: true,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, thinkingMessage]);

        try {
            const response = await tryApiCall<{
                conversationHistory?: HistoryMessageItem[];
                actions?: { status: string; message: string }[];
            }>('/chat/message', {
                method: 'POST',
                timeout: 300000,
                data: {
                    message: userMessage.content,
                    stream: false
                }
            });

            if (response.data.conversationHistory) {
                const frontendMessages = response.data.conversationHistory.map((msg, index) => ({
                    id: `history-${Date.now() + index}`,
                    type: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    message: msg.message || msg.content,
                    actions: msg.actions || [],
                    timestamp: msg.timestamp || new Date().toISOString()
                })) as ChatMessage[];
                setMessages(frontendMessages);
            }

            if (response.data.actions) {
                response.data.actions.forEach(action => {
                    if (action.status === 'success') {
                        showSuccess(action.message);
                    } else {
                        showError(action.message);
                    }
                });
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            setMessages(prevMessages => {
                const filteredMessages = prevMessages.filter(msg => msg.id !== thinkingMessage.id);
                const errorMessage: ChatMessage = {
                    id: `err-${Date.now() + 3}`,
                    type: 'error',
                    content: getErrorMessage(err) || 'Failed to get response',
                    message: getErrorMessage(err) || 'Failed to get response',
                    actions: [],
                    timestamp: new Date().toISOString()
                };
                return [...filteredMessages, errorMessage];
            });
            showError(getErrorMessage(err) || 'Failed to send message');
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleModelChange = async (newModel: string) => {
        try {
            await tryApiCall('/chat/model', {
                method: 'POST',
                data: { modelName: newModel }
            });
            setCurrentModel(newModel);
            showSuccess(`Switched to model: ${newModel}`);
        } catch (err) {
            console.error('Failed to change model:', err);
            showError(getErrorMessage(err) || 'Failed to change model');
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
                } catch (err) {
            console.error('Failed to clear conversation:', err);
                    showError(getErrorMessage(err) || 'Failed to clear conversation');
                }
            }
        });
    };



    const getStatusColor = (status: string): 'success' | 'error' | 'warning' => {
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
            const response = await tryApiCall<{ message?: string }>('/chat/download-model', {
                method: 'POST',
                timeout: 600000,
                data: {
                    modelName: modelToDownload.trim()
                }
            });

            showSuccess(response.data.message || `Model "${modelToDownload}" downloaded successfully`);
            setDownloadDialogOpen(false);
            setModelToDownload('');
            fetchModels();
        } catch (err) {
            console.error('Failed to download model:', err);
            showError(getErrorMessage(err) || 'Failed to download model');
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
            const response = await tryApiCall<ChatModelsDetailedResponse>('/chat/models-detailed');
            setDetailedModels(
                (response.data.models || []).map((m) => ({
                    name: m.name,
                    sizeFormatted: m.size || '',
                    modified: '',
                }))
            );
        } catch (err) {
            console.error('Failed to fetch detailed models:', err);
            showError(getErrorMessage(err) || 'Failed to fetch model details');
        }
    };

    const handleDeleteModel = async (modelName: string) => {
        showConfirmDialog({
            title: 'Delete Model',
            message: `Are you sure you want to delete the model "${modelName}"? This action cannot be undone and will free up disk space.`,
            confirmText: 'Delete',
            confirmColor: 'error',
            onConfirm: async () => {
                try {
                    const response = await tryApiCall<{ message?: string }>(`/chat/delete-model/${encodeURIComponent(modelName)}`, {
                        method: 'DELETE'
                    });

                    showSuccess(response.data.message || `Model "${modelName}" deleted successfully`);
                    await fetchDetailedModels();
                    await fetchModels();
                } catch (err) {
            console.error('Failed to delete model:', err);
                    showError(getErrorMessage(err) || 'Failed to delete model');
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
                                    onChange={(e) => handleModelChange(e.target.value as string)}
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
                                    Download Model
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

            {ollamaStatus && ollamaStatus.status === 'offline' && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Ollama is offline. Please ensure Ollama is installed and running to use the chat feature.
                </Alert>
            )}

            {availableModels.length > 0 ? (
                <Card sx={{ height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
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
                                        {message.type === 'assistant' && message.thinking ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CircularProgress size={16} />
                                                <Typography variant="body2" color="text.secondary">
                                                    Thinking...
                                                </Typography>
                                            </Box>
                                        ) : (
                                            message.type === 'assistant' ? (
                                                <>
                                                    <ReactMarkdown
                                                        components={{
                                                            code: ({ children, className }) => {
                                                                const isInline = !className || !className.startsWith('language-');
                                                                return isInline ? (
                                                                    <Box
                                                                        component="span"
                                                                        sx={{
                                                                            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
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
                                                                    <Box
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
                                                                );
                                                            },
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
                                                        {message.message || ''}
                                                    </ReactMarkdown>
                                                 </>
                                            ) : (
                                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {message.message || ''}
                                                </Typography>
                                            )
                                        )}
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
            ) : (
                <Card sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No Models Downloaded
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3, maxWidth: 400 }}>
                        Ollama is online, but no AI models are currently downloaded. Please click the button below to download a model first.
                    </Typography>
                    <Button
                        onClick={handleDownloadClick}
                        variant="contained"
                        startIcon={<DownloadIcon />}
                    >
                        Download Model
                    </Button>
                </Card>
            )}

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
                                                <Tooltip title="Delete model">
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