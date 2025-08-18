// src/components/WordGames.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Container,
    Grid,
    Alert,
    Chip,
    CircularProgress,
    Paper,
    List,
    ListItem,
    ListItemText,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tooltip,
    IconButton,
    Tabs,
    Tab,
    Stack
} from '@mui/material';
import {
    Games as GamesIcon,
    PlayArrow as PlayIcon,
    Refresh as RefreshIcon,
    ContentCopy as CopyIcon,
    Quiz as QuizIcon,
    ViewModule as LetterBoxedIcon,
    EmojiNature as Bee
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

const WordGames = () => {
    const [gameStatus, setGameStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [solutions, setSolutions] = useState([]);
    const [lastGameType, setLastGameType] = useState(null);
    const [lastGameData, setLastGameData] = useState(null);
    const [activeTab, setActiveTab] = useState(0);

    // Letter Boxed state
    const [letterBoxedLetters, setLetterBoxedLetters] = useState('');
    const [letterBoxedConfig, setLetterBoxedConfig] = useState(1);
    const [customConfig, setCustomConfig] = useState({
        maxDepth: 2,
        minWordLength: 3,
        minUniqueLetters: 2,
        pruneRedundantPaths: 1,
        pruneDominatedClasses: 0
    });

    // Preset configurations
    const presetConfigs = {
        1: { maxDepth: 2, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: 1, pruneDominatedClasses: 0 },
        2: { maxDepth: 2, minWordLength: 4, minUniqueLetters: 3, pruneRedundantPaths: 1, pruneDominatedClasses: 1 },
        3: { maxDepth: 3, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: 0, pruneDominatedClasses: 0 }
    };

    // Get current config values (preset or custom)
    const getCurrentConfig = () => {
        return letterBoxedConfig === 0 ? customConfig : presetConfigs[letterBoxedConfig];
    };

    // Validate if all config fields are filled
    const isConfigValid = () => {
        const config = getCurrentConfig();
        return config &&
            config.maxDepth !== "" && config.maxDepth > 0 &&
            config.minWordLength !== "" && config.minWordLength > 0 &&
            config.minUniqueLetters !== "" && config.minUniqueLetters > 0 &&
            config.pruneRedundantPaths !== "" &&
            config.pruneDominatedClasses !== "";
    };

    // Spelling Bee state
    const [spellingBeeLetters, setSpellingBeeLetters] = useState('');

    const { showError, showSuccess } = useNotification();

    useEffect(() => {
        checkGameStatus();
    }, []);

    const checkGameStatus = async () => {
        setIsLoading(true);
        try {
            const response = await tryApiCall('/wordgames/status');
            setGameStatus(response.data);
        } catch (error) {
            console.error('Failed to check word games status:', error);
            setGameStatus({
                status: 'unavailable',
                message: error.message || 'Failed to check word games status',
                error: error.message
            });
            // Don't show error notification for status check failures as it's handled in UI
        } finally {
            setIsLoading(false);
        }
    };

    const [startIdx, setStartIdx] = useState(0);
    const [endIdx, setEndIdx] = useState(100);

    const solveLetterBoxed = async (start = 0, end = 100) => {
        // Minimal client-side validation - just check if letters are provided
        if (!letterBoxedLetters.trim()) {
            showError('Please enter letters for Letter Boxed');
            return;
        }

        setIsLoading(true);
        setSolutions([]);
        setStartIdx(start);
        setEndIdx(end);

        try {
            const config = getCurrentConfig();
            const response = await tryApiCall('/wordgames/letterboxed', {
                method: 'POST',
                data: {
                    letters: letterBoxedLetters.trim(),
                    maxDepth: config.maxDepth,
                    minWordLength: config.minWordLength,
                    minUniqueLetters: config.minUniqueLetters,
                    pruneRedundantPaths: config.pruneRedundantPaths,
                    pruneDominatedClasses: config.pruneDominatedClasses,
                    start,
                    end
                }
            });

            setSolutions(response.data.solutions);
            setLastGameType('letterboxed');
            setLastGameData({
                letters: response.data.letters,
                config: letterBoxedConfig,
                totalSolutions: response.data.totalSolutions,
                actualTotalFound: response.data.actualTotalFound,
                isLimited: response.data.isLimited,
                executionTime: response.data.executionTime,
                configDetails: config,
                start: response.data.start,
                end: response.data.end,
                resultsFile: response.data.actualResultsFile || response.data.resultsFile
            });

            const message = response.data.isLimited
                ? `Found ${response.data.actualTotalFound} solutions (showing first 100) in ${response.data.executionTime}ms`
                : `Found ${response.data.totalSolutions} solutions in ${response.data.executionTime}ms`;
            showSuccess(message);
        } catch (error) {
            console.error('Failed to solve Letter Boxed:', error);
            // Show the specific error message from the API
            showError(error.message || 'Failed to solve Letter Boxed puzzle');
        } finally {
            setIsLoading(false);
        }
    };

    const solveSpellingBee = async (start = 0, end = 100) => {
        // Minimal client-side validation - just check if letters are provided
        if (!spellingBeeLetters.trim()) {
            showError('Please enter letters for Spelling Bee');
            return;
        }

        setIsLoading(true);
        setSolutions([]);
        setStartIdx(start);
        setEndIdx(end);

        try {
            const response = await tryApiCall('/wordgames/spellingbee', {
                method: 'POST',
                data: {
                    letters: spellingBeeLetters.trim(),
                    start,
                    end
                }
            });

            setSolutions(response.data.solutions);
            setLastGameType('spellingbee');
            setLastGameData({
                letters: response.data.letters,
                totalSolutions: response.data.totalSolutions,
                actualTotalFound: response.data.actualTotalFound,
                isLimited: response.data.isLimited,
                executionTime: response.data.executionTime,
                start: response.data.start,
                end: response.data.end,
                resultsFile: response.data.actualResultsFile || response.data.resultsFile
            });

            const message = response.data.isLimited
                ? `Found ${response.data.actualTotalFound} solutions (showing first 100) in ${response.data.executionTime}ms`
                : `Found ${response.data.totalSolutions} solutions in ${response.data.executionTime}ms`;
            showSuccess(message);
        } catch (error) {
            console.error('Failed to solve Spelling Bee:', error);
            // Show the specific error message from the API
            showError(error.message || 'Failed to solve Spelling Bee puzzle');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('Copied to clipboard');
        }).catch(() => {
            showError('Failed to copy to clipboard');
        });
    };

    const copySolutions = () => {
        const solutionsText = solutions.join('\n');
        copyToClipboard(solutionsText);
    };

    const formatLetters = (letters) => {
        return letters.toUpperCase().split('').join(' ');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'success';
            case 'unavailable': return 'error';
            default: return 'warning';
        }
    };

    // Letter Boxed grid component (display only, no input)
    const LetterBoxedGrid = ({ letters }) => {
        const letterArray = letters.toUpperCase().split('');

        // Pad with empty strings to ensure we have 12 slots
        while (letterArray.length < 12) {
            letterArray.push('');
        }

        // Arrange letters around the box edges: top (3), right (3), bottom (3), left (3)
        const topLetters = letterArray.slice(0, 3);
        const rightLetters = letterArray.slice(3, 6);
        const bottomLetters = letterArray.slice(6, 9);
        const leftLetters = letterArray.slice(9, 12);

        const LetterDisplay = ({ letter, position }) => (
            <Box
                sx={{
                    width: 50,
                    height: 50,
                    border: '2px solid',
                    borderColor: letter ? 'primary.main' : 'grey.300',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: letter ? 'primary.light' : 'background.paper',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: letter ? 'primary.contrastText' : 'text.disabled',
                }}
            >
                {letter || '?'}
            </Box>
        );

        return (
            <Box sx={{ my: 4, mb: 5 }}>
                {/* Letter Grid Display */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <Box sx={{
                        position: 'relative',
                        width: 220,
                        height: 220,
                        border: '3px solid',
                        borderColor: 'primary.main',
                        borderRadius: 2
                    }}>
                        {/* Top edge */}
                        <Box sx={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
                            {topLetters.map((letter, index) => (
                                <LetterDisplay key={`top-${index}`} letter={letter} position={index} />
                            ))}
                        </Box>
                        {/* Right edge */}
                        <Box sx={{ position: 'absolute', right: -30, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {rightLetters.map((letter, index) => (
                                <LetterDisplay key={`right-${index}`} letter={letter} position={3 + index} />
                            ))}
                        </Box>
                        {/* Bottom edge */}
                        <Box sx={{ position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
                            {[...bottomLetters].reverse().map((letter, index) => (
                                <LetterDisplay key={`bottom-${index}`} letter={letter} position={6 + index} />
                            ))}
                        </Box>
                        {/* Left edge */}
                        <Box sx={{ position: 'absolute', left: -30, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {[...leftLetters].reverse().map((letter, index) => (
                                <LetterDisplay key={`left-${index}`} letter={letter} position={9 + index} />
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    };

    // Spelling Bee hexagon component (display only, no input)
    const SpellingBeeHexagon = ({ letters }) => {
        const letterArray = letters.toUpperCase().split('');

        // Pad with empty strings to ensure we have 7 slots
        while (letterArray.length < 7) {
            letterArray.push('');
        }

        const centerLetter = letterArray[0];
        const outerLetters = letterArray.slice(1);

        const hexagonPositions = [
            { top: -5, left: '50%', transform: 'translateX(-50%)' },
            { top: '25%', right: -5 },
            { bottom: '25%', right: -5 },
            { bottom: -5, left: '50%', transform: 'translateX(-50%)' },
            { bottom: '25%', left: -5 },
            { top: '25%', left: -5 }
        ]; const LetterDisplay = ({ letter, position, isCenter = false }) => (
            <Box
                sx={{
                    width: isCenter ? 70 : 50,
                    height: isCenter ? 70 : 50,
                    border: '2px solid',
                    borderColor: letter ? (isCenter ? 'secondary.main' : 'primary.main') : 'grey.300',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: letter ? (isCenter ? 'secondary.light' : 'primary.light') : 'background.paper',
                    fontSize: isCenter ? '2rem' : '1.5rem',
                    fontWeight: 'bold',
                    color: letter ? (isCenter ? 'secondary.contrastText' : 'primary.contrastText') : 'text.disabled'
                }}
            >
                {letter || '?'}
            </Box>
        );

        return (
            <Box sx={{ my: 4 }}>
                {/* Hexagon Display */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Box sx={{
                        position: 'relative',
                        width: 250,
                        height: 250
                    }}>
                        {/* Center letter (mandatory) */}
                        <Box sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }}>
                            <LetterDisplay letter={centerLetter} position={0} isCenter={true} />
                        </Box>
                        {/* Outer letters */}
                        {outerLetters.map((letter, index) => (
                            <Box
                                key={`outer-${index}`}
                                sx={{
                                    position: 'absolute',
                                    ...hexagonPositions[index]
                                }}
                            >
                                <LetterDisplay letter={letter} position={index + 1} />
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        // Clear solutions when switching tabs
        setSolutions([]);
        setLastGameType(null);
        setLastGameData(null);
    };

    const readMoreResults = async (start, end, gameType) => {
        setIsLoading(true);
        try {
            const response = await tryApiCall('/wordgames/read', {
                method: 'POST',
                data: {
                    start,
                    end,
                    resultsFile: lastGameData?.resultsFile
                }
            });
            setSolutions(prev => [...prev, ...response.data.solutions]);
            setLastGameData(prev => ({
                ...prev,
                end: end
            }));
        } catch (error) {
            showError(error.message || 'Failed to load more results');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadMore = async () => {
        const newStart = lastGameData?.end || 0;
        const newEnd = newStart + 100;
        if (lastGameType === 'letterboxed' || lastGameType === 'spellingbee') {
            await readMoreResults(newStart, newEnd, lastGameType);
        }
    };

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                        Word Games Solver
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {gameStatus && (
                            <Chip
                                label={gameStatus.status === 'available' ? 'Available' : 'Unavailable'}
                                color={getStatusColor(gameStatus.status)}
                                icon={<GamesIcon />}
                                size="small"
                            />
                        )}
                        <Tooltip title="Refresh Status">
                            <span>
                                <IconButton onClick={checkGameStatus} color="primary" disabled={isLoading}>
                                    <RefreshIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {/* Status Alert */}
            {gameStatus && gameStatus.status === 'unavailable' && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Word games executable is not available. Please ensure the word_games executable is in the correct path.
                    <br />
                    <Typography variant="caption" color="text.secondary">
                        {gameStatus.message}
                    </Typography>
                </Alert>
            )}

            {/* Game Tabs */}
            <Card sx={{ mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    centered
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab
                        icon={<LetterBoxedIcon />}
                        label="Letter Boxed"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<Bee />}
                        label="Spelling Bee"
                        iconPosition="start"
                    />
                </Tabs>

                {/* Letter Boxed Tab */}
                {activeTab === 0 && (
                    <CardContent>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                                Letter Boxed
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                Connect letters to form words. Each word must use letters from different sides of the box.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Enter 12 letters in the text box below
                            </Typography>
                        </Box>

                        {/* Input Field */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                            <TextField
                                label="Enter 12 letters"
                                value={letterBoxedLetters}
                                onChange={(e) => {
                                    const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 12);
                                    setLetterBoxedLetters(cleanValue);
                                }}
                                placeholder="Type letters here..."
                                slotProps={{
                                    htmlInput: {
                                        maxLength: 12,
                                        style: {
                                            textAlign: 'center',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            letterSpacing: '2px',
                                            textTransform: 'uppercase'
                                        },
                                        autoCorrect: 'off',
                                        autoComplete: 'off'
                                    }
                                }}
                                sx={{ width: 300 }}
                                variant="outlined"
                                helperText={`${letterBoxedLetters.length}/12 letters`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        solveLetterBoxed();
                                    }
                                }}
                            />
                        </Box>

                        {/* Letter Grid Display */}
                        <LetterBoxedGrid letters={letterBoxedLetters} />

                        <Grid container spacing={3} justifyContent="center">
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Stack spacing={2}>
                                    <FormControl fullWidth>
                                        <InputLabel>Config Preset</InputLabel>
                                        <Select
                                            value={letterBoxedConfig}
                                            label="Config Preset"
                                            onChange={(e) => setLetterBoxedConfig(e.target.value)}
                                        >
                                            <MenuItem value={1}>Default</MenuItem>
                                            <MenuItem value={2}>Fast</MenuItem>
                                            <MenuItem value={3}>Thorough</MenuItem>
                                            <MenuItem value={0}>Custom</MenuItem>
                                        </Select>
                                    </FormControl>

                                    {/* Configuration Display - Always Show */}
                                    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                            Configuration {letterBoxedConfig === 0 ? '(Custom)' : '(Preset)'}
                                        </Typography>

                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    label="Max Depth"
                                                    type="number"
                                                    value={getCurrentConfig()?.maxDepth || ""}
                                                    onChange={(e) => letterBoxedConfig === 0 && setCustomConfig(prev => ({
                                                        ...prev,
                                                        maxDepth: parseInt(e.target.value) || ""
                                                    }))}
                                                    slotProps={{
                                                        htmlInput: {
                                                            min: 1,
                                                            max: 10
                                                        }
                                                    }}
                                                    size="small"
                                                    disabled={letterBoxedConfig !== 0}
                                                    error={getCurrentConfig()?.maxDepth === "" || getCurrentConfig()?.maxDepth <= 0}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    label="Min Word Length"
                                                    type="number"
                                                    value={getCurrentConfig()?.minWordLength || ""}
                                                    onChange={(e) => letterBoxedConfig === 0 && setCustomConfig(prev => ({
                                                        ...prev,
                                                        minWordLength: parseInt(e.target.value) || ""
                                                    }))}
                                                    slotProps={{
                                                        htmlInput: {
                                                            min: 2,
                                                            max: 8
                                                        }
                                                    }}
                                                    size="small"
                                                    disabled={letterBoxedConfig !== 0}
                                                    error={getCurrentConfig()?.minWordLength === "" || getCurrentConfig()?.minWordLength <= 0}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 6 }}>
                                                <TextField
                                                    fullWidth
                                                    label="Min Unique Letters"
                                                    type="number"
                                                    value={getCurrentConfig()?.minUniqueLetters || ""}
                                                    onChange={(e) => letterBoxedConfig === 0 && setCustomConfig(prev => ({
                                                        ...prev,
                                                        minUniqueLetters: parseInt(e.target.value) || ""
                                                    }))}
                                                    slotProps={{
                                                        htmlInput: {
                                                            min: 1,
                                                            max: 12
                                                        }
                                                    }}
                                                    size="small"
                                                    disabled={letterBoxedConfig !== 0}
                                                    error={getCurrentConfig()?.minUniqueLetters === "" || getCurrentConfig()?.minUniqueLetters <= 0}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 6 }}>
                                                <FormControl fullWidth size="small" disabled={letterBoxedConfig !== 0}>
                                                    <InputLabel>Prune Redundant Paths</InputLabel>
                                                    <Select
                                                        value={getCurrentConfig()?.pruneRedundantPaths !== undefined ? getCurrentConfig().pruneRedundantPaths : ""}
                                                        label="Prune Redundant Paths"
                                                        onChange={(e) => letterBoxedConfig === 0 && setCustomConfig(prev => ({
                                                            ...prev,
                                                            pruneRedundantPaths: parseInt(e.target.value)
                                                        }))}
                                                        error={getCurrentConfig()?.pruneRedundantPaths === ""}
                                                    >
                                                        <MenuItem value={0}>Disabled</MenuItem>
                                                        <MenuItem value={1}>Enabled</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid size={{ xs: 12 }}>
                                                <FormControl fullWidth size="small" disabled={letterBoxedConfig !== 0}>
                                                    <InputLabel>Prune Dominated Classes</InputLabel>
                                                    <Select
                                                        value={getCurrentConfig()?.pruneDominatedClasses !== undefined ? getCurrentConfig().pruneDominatedClasses : ""}
                                                        label="Prune Dominated Classes"
                                                        onChange={(e) => letterBoxedConfig === 0 && setCustomConfig(prev => ({
                                                            ...prev,
                                                            pruneDominatedClasses: parseInt(e.target.value)
                                                        }))}
                                                        error={getCurrentConfig()?.pruneDominatedClasses === ""}
                                                    >
                                                        <MenuItem value={0}>Disabled</MenuItem>
                                                        <MenuItem value={1}>Enabled</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        onClick={() => solveLetterBoxed()}
                                        disabled={isLoading || gameStatus?.status !== 'available' || !letterBoxedLetters.trim() || !isConfigValid()}
                                        startIcon={isLoading && activeTab === 0 ? <CircularProgress size={20} /> : <PlayIcon />}
                                        fullWidth
                                        size="large"
                                    >
                                        Solve Letter Boxed
                                        {letterBoxedConfig === 0 && ' - Custom'}
                                        {!isConfigValid() && letterBoxedLetters.trim() && ' - Config Required'}
                                    </Button>

                                    {letterBoxedLetters.length > 0 && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => setLetterBoxedLetters('')}
                                            fullWidth
                                        >
                                            Clear All Letters
                                        </Button>
                                    )}
                                </Stack>
                            </Grid>
                        </Grid>
                    </CardContent>
                )}

                {/* Spelling Bee Tab */}
                {activeTab === 1 && (
                    <CardContent>
                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                            <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                                Spelling Bee
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                                Make words using the center letter (required) and any combination of outer letters.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Enter 7 letters (center letter first, then 6 outer letters)
                            </Typography>
                        </Box>

                        {/* Input Field */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                            <TextField
                                label="Enter 7 letters (center first)"
                                value={spellingBeeLetters}
                                onChange={(e) => {
                                    const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 7);
                                    setSpellingBeeLetters(cleanValue);
                                }}
                                placeholder="Type letters here..."
                                slotProps={{
                                    htmlInput: {
                                        maxLength: 7,
                                        style: {
                                            textAlign: 'center',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            letterSpacing: '2px',
                                            textTransform: 'uppercase'
                                        },
                                        autoCorrect: 'off',
                                        autoComplete: 'off'
                                    }
                                }}
                                sx={{ width: 300 }}
                                variant="outlined"
                                helperText={`${spellingBeeLetters.length}/7 letters`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        solveSpellingBee();
                                    }
                                }}
                            />
                        </Box>

                        {/* Hexagon Display */}
                        <SpellingBeeHexagon letters={spellingBeeLetters} />

                        <Grid container spacing={3} justifyContent="center">
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Stack spacing={2}>
                                    <Button
                                        variant="contained"
                                        onClick={() => solveSpellingBee()}
                                        disabled={isLoading || gameStatus?.status !== 'available' || !spellingBeeLetters.trim()}
                                        startIcon={isLoading && activeTab === 1 ? <CircularProgress size={20} /> : <PlayIcon />}
                                        fullWidth
                                        size="large"
                                        color="secondary"
                                    >
                                        Solve Spelling Bee
                                    </Button>

                                    {spellingBeeLetters.length > 0 && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => setSpellingBeeLetters('')}
                                            fullWidth
                                        >
                                            Clear All Letters
                                        </Button>
                                    )}
                                </Stack>
                            </Grid>
                        </Grid>
                    </CardContent>
                )}
            </Card>

            {/* Solutions Display */}
            {(solutions.length > 0 || lastGameData) && (
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                                Solutions
                            </Typography>
                            {solutions.length > 0 && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={copySolutions}
                                    startIcon={<CopyIcon />}
                                >
                                    Copy All
                                </Button>
                            )}
                        </Box>

                        {lastGameData && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Game: {lastGameType === 'letterboxed' ? 'Letter Boxed' : 'Spelling Bee'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Letters: {formatLetters(lastGameData.letters)}
                                </Typography>
                                {lastGameData.config !== undefined && (
                                    <Typography variant="body2" color="text.secondary">
                                        Config: {lastGameData.config === 1 ? 'Default' :
                                            lastGameData.config === 2 ? 'Fast' :
                                                lastGameData.config === 3 ? 'Thorough' :
                                                    lastGameData.config === 0 ? 'Custom' : 'Unknown'}
                                    </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                    Found: {lastGameData.isLimited ?
                                        `${lastGameData.actualTotalFound} solutions (showing first 100)` :
                                        `${lastGameData.totalSolutions} solutions`} in {lastGameData.executionTime}ms
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Showing {lastGameData.start}-{Math.min(lastGameData.end, lastGameData.actualTotalFound)} of {lastGameData.actualTotalFound} solutions
                                </Typography>
                            </Box>
                        )}

                        {solutions.length > 0 ? (
                            <>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        maxHeight: 400,
                                        overflowY: 'auto',
                                        bgcolor: 'background.default'
                                    }}
                                >
                                    <List dense>
                                        {solutions.map((solution, index) => (
                                            <React.Fragment key={index}>
                                                <ListItem
                                                    onClick={() => copyToClipboard(solution)}
                                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                                >
                                                    <ListItemText
                                                        primary={solution}
                                                        primaryTypographyProps={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '0.875rem'
                                                        }}
                                                    />
                                                </ListItem>
                                                {index < solutions.length - 1 && <Divider />}
                                            </React.Fragment>
                                        ))}
                                    </List>
                                </Paper>
                                {lastGameData && lastGameData.end < lastGameData.actualTotalFound && (
                                    <Button
                                        variant="contained"
                                        onClick={handleLoadMore}
                                        disabled={isLoading}
                                        sx={{ mt: 2 }}
                                    >
                                        Load More
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No solutions found yet. Try solving a puzzle above.
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            )}
        </Container>
    );
};

export default WordGames;
