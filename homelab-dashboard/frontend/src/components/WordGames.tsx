// src/components/WordGames.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Alert,
    Chip,
    CircularProgress,
    Tooltip,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Quiz as QuizIcon,
    ViewModule as LetterBoxedIcon,
    EmojiNature as Bee,
    HelpOutline as HelpIcon,
    Psychology as MastermindIcon,
    TextFields as HangmanIcon,
    Castle as DungleonIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/useNotification';
import LetterBoxedGame from './LetterBoxedGame';
import SpellingBeeGame from './SpellingBeeGame';
import WordleGame from './WordleGame';
import MastermindGame from './MastermindGame';
import HangmanGame from './HangmanGame';
import DungleonGame from './DungleonGame';
import GameHelpModal from './GameHelpModal';
import {
    LetterBoxedResultState,
    SpellingBeeResultState,
    WordleResultState,
    MastermindResultState,
    HangmanResultState,
    DungleonResultState,
    GameStatus,
    LetterBoxedResponse,
    SpellingBeeResponse,
    WordleResponse,
    MastermindResponse,
    HangmanResponse,
    DungleonResponse,
    LoadMoreResponse,
    LetterBoxedRequest,
    SpellingBeeRequest,
    WordleRequest,
    MastermindRequest,
    HangmanRequest,
    DungleonRequest
} from '../types/api';

const WordGames = () => {
    const { gameName } = useParams<{ gameName?: string }>();
    const navigate = useNavigate();

    const GAME_TABS = useMemo<Record<string, number>>(() => ({
        'letterboxed': 0,
        'spellingbee': 1,
        'wordle': 2,
        'mastermind': 3,
        'hangman': 4,
        'dungleon': 5
    }), []);

    const tabKeys = useMemo(() => ['letterboxed', 'spellingbee', 'wordle', 'mastermind', 'hangman', 'dungleon'], []);

    const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<number>(() => {
        if (gameName) {
            return GAME_TABS[gameName.toLowerCase()] ?? 0;
        }
        return 0;
    });
    const [helpModalOpen, setHelpModalOpen] = useState(false);

    // Sync route change to tab state
    useEffect(() => {
        if (gameName) {
            const mappedTab = GAME_TABS[gameName.toLowerCase()];
            if (mappedTab !== undefined && mappedTab !== activeTab) {
                setActiveTab(mappedTab);
            }
        }
    }, [gameName, activeTab, GAME_TABS]);

    // Redirect to default game if URL is just "/wordgames"
    useEffect(() => {
        if (!gameName) {
            navigate('/wordgames/letterboxed', { replace: true });
        }
    }, [gameName, navigate]);



    // Game results state - separate for each game
    const [letterBoxedResults, setLetterBoxedResults] = useState<LetterBoxedResultState>({
        solutions: [],
        gameData: null
    });
    const [spellingBeeResults, setSpellingBeeResults] = useState<SpellingBeeResultState>({
        solutions: [],
        gameData: null
    });
    const [wordleResults, setWordleResults] = useState<WordleResultState>({
        possibleWords: [],
        guessesWithEntropy: [],
        gameData: null
    });
    const [mastermindResults, setMastermindResults] = useState<MastermindResultState>({
        possiblePatterns: [],
        guessesWithEntropy: [],
        gameData: null
    });
    const [hangmanResults, setHangmanResults] = useState<HangmanResultState>({
        letterSuggestions: [],
        possibleWords: [],
        gameData: null
    });
    const [dungleonResults, setDungleonResults] = useState<DungleonResultState>({
        possiblePatterns: [],
        guessesWithEntropy: [],
        gameData: null
    });

    const { showError, showSuccess } = useNotification();

    const checkGameStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await tryApiCall('/wordgames/status', {
                method: 'GET'
            });
            setGameStatus(response.data as GameStatus);
        } catch (error: unknown) {
            console.error('Failed to check game status:', error);
            const err = error as Error;
            setGameStatus({
                status: 'offline',
                healthy: false,
                message: 'Word games service is not available',
                error: err.message || 'Unknown error'
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkGameStatus();
    }, [checkGameStatus]);

    const handleClear = useCallback((gameType: string) => {
        if (gameType === 'letterboxed' || gameType === 'all') {
            setLetterBoxedResults({ solutions: [], gameData: null });
        }
        if (gameType === 'spellingbee' || gameType === 'all') {
            setSpellingBeeResults({ solutions: [], gameData: null });
        }
        if (gameType === 'wordle' || gameType === 'all') {
            setWordleResults({ possibleWords: [], guessesWithEntropy: [], gameData: null });
        }
        if (gameType === 'mastermind' || gameType === 'all') {
            setMastermindResults({ possiblePatterns: [], guessesWithEntropy: [], gameData: null });
        }
        if (gameType === 'hangman' || gameType === 'all') {
            setHangmanResults({ letterSuggestions: [], possibleWords: [], gameData: null });
        }
        if (gameType === 'dungleon' || gameType === 'all') {
            setDungleonResults({ possiblePatterns: [], guessesWithEntropy: [], gameData: null });
        }
    }, []);

    const handleTabChange = useCallback((_event: unknown, newValue: unknown) => {
        const tabIndex = Number(newValue);
        setActiveTab(tabIndex);
        handleClear('all');
        navigate(`/wordgames/${tabKeys[tabIndex]}`);
    }, [handleClear, navigate, tabKeys]);

    const handleSolve = useCallback(async (gameType: string, gameData: unknown) => {
        setIsLoading(true);
        try {
            if (gameType === 'letterboxed') {
                const req = gameData as LetterBoxedRequest;
                const response = await tryApiCall<LetterBoxedResponse>('/wordgames/letterboxed', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });
                const newGameData = {
                    letters: response.data.letters,
                    config: req.preset || 1,
                    totalSolutions: response.data.totalSolutions,
                    actualTotalFound: response.data.actualTotalFound,
                    isLimited: response.data.isLimited,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    resultsFile: response.data.actualResultsFile || response.data.resultsFile
                };
                setLetterBoxedResults({
                    solutions: response.data.solutions,
                    gameData: newGameData
                });
                const message = response.data.isLimited
                    ? `Found ${response.data.actualTotalFound} solutions (showing first 100) in ${response.data.executionTime}ms`
                    : `Found ${response.data.totalSolutions} solutions in ${response.data.executionTime}ms`;
                showSuccess(message);
            } else if (gameType === 'spellingbee') {
                const req = gameData as SpellingBeeRequest;
                const response = await tryApiCall<SpellingBeeResponse>('/wordgames/spellingbee', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });
                const newGameData = {
                    letters: response.data.letters,
                    totalSolutions: response.data.totalSolutions,
                    actualTotalFound: response.data.actualTotalFound,
                    isLimited: response.data.isLimited,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    resultsFile: response.data.actualResultsFile || response.data.resultsFile
                };
                setSpellingBeeResults({
                    solutions: response.data.solutions,
                    gameData: newGameData
                });
                const message = response.data.isLimited
                    ? `Found ${response.data.actualTotalFound} solutions (showing first 100) in ${response.data.executionTime}ms`
                    : `Found ${response.data.totalSolutions} solutions in ${response.data.executionTime}ms`;
                showSuccess(message);
            } else if (gameType === 'wordle') {
                const req = gameData as WordleRequest;
                const response = await tryApiCall<WordleResponse>('/wordgames/wordle', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });
                const newGameData = {
                    guesses: req.guesses,
                    wordLength: req.wordLength,
                    maxDepth: req.maxDepth,
                    excludeUncommonWords: req.excludeUncommonWords,
                    possibleWordsCount: response.data.possibleWordsCount,
                    guessesCount: response.data.guessesCount,
                    searchDepth: response.data.searchDepth,
                    isLimitedPossible: response.data.isLimitedPossible,
                    isLimitedGuesses: response.data.isLimitedGuesses,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    resultsFile: response.data.resultsFile
                };
                setWordleResults({
                    possibleWords: response.data.possibleWords || [],
                    guessesWithEntropy: response.data.guessesWithEntropy || [],
                    gameData: newGameData
                });
                const message = `Found ${response.data.possibleWordsCount} possible words and ${response.data.guessesCount} suggested guesses in ${response.data.executionTime}ms`;
                showSuccess(message);
            } else if (gameType === 'mastermind') {
                const req = gameData as MastermindRequest;
                const response = await tryApiCall<MastermindResponse>('/wordgames/mastermind', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });
                const newGameData = {
                    guesses: req.guesses,
                    pegs: req.pegs,
                    colors: req.colors,
                    allowDuplicates: req.allowDuplicates,
                    colorMapping: req.colorMapping,
                    possibleCount: response.data.possibleCount,
                    guessesCount: response.data.guessesCount,
                    searchDepth: response.data.searchDepth,
                    isLimitedPossible: response.data.isLimitedPossible,
                    isLimitedGuesses: response.data.isLimitedGuesses,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    resultsFile: response.data.resultsFile
                };
                setMastermindResults({
                    possiblePatterns: response.data.possiblePatterns || [],
                    guessesWithEntropy: response.data.guessesWithEntropy || [],
                    gameData: newGameData
                });
                const message = `Found ${response.data.possibleCount} possible patterns and ${response.data.guessesCount} suggested guesses in ${response.data.executionTime}ms`;
                showSuccess(message);
            } else if (gameType === 'hangman') {
                const req = gameData as HangmanRequest;
                const response = await tryApiCall<HangmanResponse>('/wordgames/hangman', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });
                const newGameData = {
                    pattern: response.data.pattern,
                    excludedLetters: response.data.excludedLetters,
                    possibleWordsCount: response.data.possibleWordsCount,
                    possiblePatternsCount: response.data.possiblePatternsCount,
                    letterGuessesCount: response.data.letterGuessesCount,
                    searchDepth: response.data.searchDepth,
                    isLimited: response.data.isLimited,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    resultsFile: response.data.resultsFile
                };
                setHangmanResults({
                    letterSuggestions: response.data.letterSuggestions || [],
                    possibleWords: response.data.possibleWords || [],
                    gameData: newGameData
                });
                const message = `Found ${response.data.possibleWordsCount} possible words and ${response.data.letterGuessesCount} letter suggestions in ${response.data.executionTime}ms`;
                showSuccess(message);
            } else if (gameType === 'dungleon') {
                const req = gameData as DungleonRequest;
                const response = await tryApiCall<DungleonResponse>('/wordgames/dungleon', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });

                const newGameData = {
                    guesses: req.guesses,
                    possiblePatternsCount: response.data.possiblePatternsCount,
                    guessesCount: response.data.guessesCount,
                    searchDepth: response.data.searchDepth,
                    isLimitedPossible: response.data.isLimitedPossible,
                    isLimitedGuesses: response.data.isLimitedGuesses,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    resultsFile: response.data.resultsFile
                };
                setDungleonResults({
                    possiblePatterns: response.data.possiblePatterns || [],
                    guessesWithEntropy: response.data.guessesWithEntropy || [],
                    gameData: newGameData
                });
                const message = `Found ${response.data.possiblePatternsCount} possible patterns and ${response.data.guessesCount} suggested guesses in ${response.data.executionTime}ms`;
                showSuccess(message);
            }
        } catch (error: unknown) {
            console.error(`Failed to solve ${gameType}:`, error);
            const err = error as Error;
            showError(err.message || `Failed to solve ${gameType} puzzle`);
        } finally {
            setIsLoading(false);
        }
    }, [showError, showSuccess]);

    const handleLoadMore = useCallback(async (type: string) => {
        let resultsFile = '';
        let currentCount = 0;
        let gameMode = '';
        let fileType = '';

        if (activeTab === 0) {
            if (!letterBoxedResults.gameData) return;
            resultsFile = letterBoxedResults.gameData.resultsFile;
            currentCount = letterBoxedResults.solutions.length;
            gameMode = 'letterboxed';
            fileType = 'results';
        } else if (activeTab === 1) {
            if (!spellingBeeResults.gameData) return;
            resultsFile = spellingBeeResults.gameData.resultsFile;
            currentCount = spellingBeeResults.solutions.length;
            gameMode = 'spellingbee';
            fileType = 'results';
        } else if (activeTab === 2) {
            if (!wordleResults.gameData) return;
            resultsFile = wordleResults.gameData.resultsFile;
            currentCount = type === 'possible' ? wordleResults.possibleWords.length : wordleResults.guessesWithEntropy.length;
            gameMode = 'wordle';
            fileType = type;
        } else if (activeTab === 3) {
            if (!mastermindResults.gameData) return;
            resultsFile = mastermindResults.gameData.resultsFile;
            currentCount = type === 'possible' ? mastermindResults.possiblePatterns.length : mastermindResults.guessesWithEntropy.length;
            gameMode = 'mastermind';
            fileType = type;
        } else if (activeTab === 4) {
            if (!hangmanResults.gameData) return;
            resultsFile = hangmanResults.gameData.resultsFile;
            currentCount = hangmanResults.possibleWords.length;
            gameMode = 'hangman';
            fileType = 'possible';
        } else if (activeTab === 5) {
            if (!dungleonResults.gameData) return;
            resultsFile = dungleonResults.gameData.resultsFile;
            currentCount = type === 'possible' ? dungleonResults.possiblePatterns.length : dungleonResults.guessesWithEntropy.length;
            gameMode = 'dungleon';
            fileType = type;
        } else {
            return;
        }

        setIsLoading(true);
        try {
            const response = await tryApiCall<LoadMoreResponse>('/wordgames/load', {
                method: 'POST',
                data: {
                    start: currentCount,
                    end: currentCount + 100,
                    gameMode,
                    fileType,
                    filePath: resultsFile,
                    possibleCount: gameMode === 'wordle' ? wordleResults.gameData?.possibleWordsCount :
                                   gameMode === 'mastermind' ? mastermindResults.gameData?.possibleCount :
                                   gameMode === 'dungleon' ? dungleonResults.gameData?.possiblePatternsCount : 0
                }
            });

            if (activeTab === 0) {
                setLetterBoxedResults(prev => ({
                    ...prev,
                    solutions: [...prev.solutions, ...(response.data.solutionsList || [])]
                }));
            } else if (activeTab === 1) {
                setSpellingBeeResults(prev => ({
                    ...prev,
                    solutions: [...prev.solutions, ...(response.data.solutionsList || [])]
                }));
            } else if (activeTab === 2) {
                if (type === 'possible') {
                    setWordleResults(prev => ({
                        ...prev,
                        possibleWords: [
                            ...prev.possibleWords,
                            ...(response.data.solutions?.possibleWords || []).map(w => {
                                if (typeof w === 'string') {
                                    return { word: w, probability: 1.0, entropy: 0.0, wnt: 0.0 };
                                }
                                const obj = w as unknown as { word?: string; probability?: number; entropy?: number; wnt?: number };
                                return {
                                    word: obj.word || '',
                                    probability: obj.probability ?? null,
                                    entropy: obj.entropy ?? null,
                                    wnt: obj.wnt ?? null
                                };
                            }) as { word: string; probability: number | null; entropy: number | null; wnt: number | null }[]
                        ]
                    }));
                } else {
                    setWordleResults(prev => ({
                        ...prev,
                        guessesWithEntropy: [
                            ...prev.guessesWithEntropy,
                            ...(response.data.solutions?.guessesWithEntropy || []).map(g => ({
                                word: g.word || '',
                                probability: g.probability,
                                entropy: g.entropy,
                                wnt: g.wnt
                            }))
                        ]
                    }));
                }
            } else if (activeTab === 3) {
                if (type === 'possible') {
                    setMastermindResults(prev => ({
                        ...prev,
                        possiblePatterns: [
                            ...prev.possiblePatterns,
                            ...(response.data.solutions?.possiblePatterns || []).map(p => {
                                if (typeof p === 'string') {
                                    return { pattern: p, probability: 1.0, entropy: 0.0, wnt: 0.0 };
                                }
                                const obj = p as unknown as { pattern?: string; probability?: number; entropy?: number; wnt?: number };
                                return {
                                    pattern: obj.pattern || '',
                                    probability: obj.probability ?? null,
                                    entropy: obj.entropy ?? null,
                                    wnt: obj.wnt ?? null
                                };
                            }) as { pattern: string; probability: number | null; entropy: number | null; wnt: number | null }[]
                        ]
                    }));
                } else {
                    setMastermindResults(prev => ({
                        ...prev,
                        guessesWithEntropy: [
                            ...prev.guessesWithEntropy,
                            ...(response.data.solutions?.guessesWithEntropy || []).map(g => ({
                                pattern: g.pattern || '',
                                probability: g.probability,
                                entropy: g.entropy,
                                wnt: g.wnt
                            }))
                        ]
                    }));
                }
            } else if (activeTab === 4) {
                setHangmanResults(prev => ({
                    ...prev,
                    possibleWords: [
                        ...prev.possibleWords,
                        ...(response.data.solutions?.possibleWords || []).map(w => {
                            if (typeof w === 'string') return w;
                            return (w as unknown as { word?: string }).word || '';
                        }) as string[]
                    ]
                }));
            } else if (activeTab === 5) {
                if (type === 'possible') {
                    setDungleonResults(prev => ({
                        ...prev,
                        possiblePatterns: [
                            ...prev.possiblePatterns,
                            ...(response.data.solutions?.possiblePatterns || []).map(p => {
                                if (typeof p === 'string') {
                                    return { pattern: p, probability: 1.0, entropy: 0.0, wnt: 0.0 };
                                }
                                const obj = p as unknown as { pattern?: string; probability?: number; entropy?: number; wnt?: number };
                                return {
                                    pattern: obj.pattern || '',
                                    probability: obj.probability ?? null,
                                    entropy: obj.entropy ?? null,
                                    wnt: obj.wnt ?? null
                                };
                            }) as { pattern: string; probability: number | null; entropy: number | null; wnt: number | null }[]
                        ]
                    }));
                } else {
                    setDungleonResults(prev => ({
                        ...prev,
                        guessesWithEntropy: [
                            ...prev.guessesWithEntropy,
                            ...(response.data.solutions?.guessesWithEntropy || []).map(g => ({
                                pattern: g.pattern || '',
                                probability: g.probability,
                                entropy: g.entropy,
                                wnt: g.wnt
                            }))
                        ]
                    }));
                }
            }

            showSuccess(`Loaded more ${type} results`);
        } catch (_error) {
            showError('Failed to load more results');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, letterBoxedResults, spellingBeeResults, wordleResults, mastermindResults, hangmanResults, dungleonResults, showSuccess, showError]);

    const handleHelpOpen = useCallback(() => {
        setHelpModalOpen(true);
    }, []);

    const handleHelpClose = useCallback(() => {
        setHelpModalOpen(false);
    }, []);

    const getStatusColor = (healthy?: boolean) => {
        return healthy ? 'success' : 'error';
    };

    return (
        <Box sx={{
            height: { md: '100vh' },
            maxHeight: { md: '100vh' },
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 1.5, sm: 2, md: 3 },
            overflow: 'hidden',
            boxSizing: 'border-box'
        }}>
            {/* Header / Game Selector Row */}
            <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', md: 'row' }, 
                justifyContent: 'space-between', 
                alignItems: { xs: 'stretch', md: 'center' }, 
                mb: 2, 
                gap: 2,
                flexShrink: 0
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box component="img" src="/assets/puzzle_icon.svg" sx={{ width: 28, height: 28 }} alt="Puzzle++ Logo" />
                    <Box sx={{ typography: 'h5', fontWeight: 600 }}>Puzzle++</Box>
                    {gameStatus && (
                        <Chip
                            label={gameStatus.healthy ? 'Online' : 'Offline'}
                            color={getStatusColor(gameStatus.healthy)}
                            size="small"
                        />
                    )}
                    <Tooltip title="Refresh Status">
                        <span>
                            <IconButton onClick={checkGameStatus} color="primary" disabled={isLoading} size="small">
                                {isLoading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: { xs: '100%', md: '280px' } }}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="game-select-label">Select Game</InputLabel>
                        <Select
                            labelId="game-select-label"
                            id="game-select"
                            value={activeTab}
                            onChange={(e) => handleTabChange(e, e.target.value)}
                            label="Select Game"
                        >
                            <MenuItem value={0}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LetterBoxedIcon fontSize="small" /> Letter Boxed
                                </Box>
                            </MenuItem>
                            <MenuItem value={1}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Bee fontSize="small" /> Spelling Bee
                                </Box>
                            </MenuItem>
                            <MenuItem value={2}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <QuizIcon fontSize="small" /> Wordle
                                </Box>
                            </MenuItem>
                            <MenuItem value={3}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <MastermindIcon fontSize="small" /> Mastermind
                                </Box>
                            </MenuItem>
                            <MenuItem value={4}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <HangmanIcon fontSize="small" /> Hangman
                                </Box>
                            </MenuItem>
                            <MenuItem value={5}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <DungleonIcon fontSize="small" /> Dungleon
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <Button
                        startIcon={<HelpIcon />}
                        onClick={handleHelpOpen}
                        size="small"
                        sx={{ whiteSpace: 'nowrap' }}
                    >
                        Help
                    </Button>
                </Box>
            </Box>

            {/* Status Alert */}
            {gameStatus && !gameStatus.healthy && (
                <Alert severity="error" sx={{ mb: 2, py: 0.5, flexShrink: 0 }}>
                    {gameStatus.message || 'Word games service is not available'}
                </Alert>
            )}

            {/* Game Content */}
            <Box sx={{ 
                flexGrow: 1, 
                height: { xs: 'auto', md: 0 }, 
                minHeight: 0, 
                display: 'flex', 
                flexDirection: 'column',
                overflowY: { xs: 'auto', md: 'visible' }
            }}>
                {activeTab === 0 && (
                    <LetterBoxedGame
                        gameStatus={gameStatus}
                        isLoading={isLoading}
                        onSolve={handleSolve}
                        onClear={() => handleClear('letterboxed')}
                        showError={showError}
                        results={letterBoxedResults}
                        onLoadMore={handleLoadMore}
                    />
                )}
                {activeTab === 1 && (
                    <SpellingBeeGame
                        gameStatus={gameStatus}
                        isLoading={isLoading}
                        onSolve={handleSolve}
                        onClear={() => handleClear('spellingbee')}
                        showError={showError}
                        results={spellingBeeResults}
                        onLoadMore={() => handleLoadMore('solutions')}
                    />
                )}
                {activeTab === 2 && (
                    <WordleGame
                        isLoading={isLoading}
                        onSolve={handleSolve}
                        onClear={() => handleClear('wordle')}
                        showError={showError}
                        results={wordleResults}
                        onLoadMore={handleLoadMore}
                    />
                )}
                {activeTab === 3 && (
                    <MastermindGame
                        gameStatus={gameStatus}
                        isLoading={isLoading}
                        onSolve={handleSolve}
                        onClear={() => handleClear('mastermind')}
                        showError={showError}
                        results={mastermindResults}
                        onLoadMore={handleLoadMore}
                    />
                )}
                {activeTab === 4 && (
                    <HangmanGame
                        gameStatus={gameStatus}
                        isLoading={isLoading}
                        onSolve={handleSolve}
                        onClear={() => handleClear('hangman')}
                        showError={showError}
                        results={hangmanResults}
                        onLoadMore={handleLoadMore}
                    />
                )}
                {activeTab === 5 && (
                    <DungleonGame
                        gameStatus={gameStatus}
                        isLoading={isLoading}
                        onSolve={handleSolve}
                        onClear={() => handleClear('dungleon')}
                        showError={showError}
                        results={dungleonResults}
                        onLoadMore={handleLoadMore}
                    />
                )}
            </Box>

            {/* Help Modal */}
            <GameHelpModal
                open={helpModalOpen}
                onClose={handleHelpClose}
                gameType={activeTab === 0 ? 'letterboxed' : activeTab === 1 ? 'spellingbee' : activeTab === 2 ? 'wordle' : activeTab === 3 ? 'mastermind' : activeTab === 4 ? 'hangman' : 'dungleon'}
            />
        </Box>
    );
};

export default WordGames;
