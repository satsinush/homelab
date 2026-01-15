// src/components/WordGames.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Container,
    Grid,
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
    Games as GamesIcon,
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
import { useNotification } from '../contexts/NotificationContext';
import LetterBoxedGame from './LetterBoxedGame';
import SpellingBeeGame from './SpellingBeeGame';
import WordleGame from './WordleGame';
import MastermindGame from './MastermindGame';
import HangmanGame from './HangmanGame';
import DungleonGame from './DungleonGame';
import GameHelpModal from './GameHelpModal';

const WordGames = () => {
    const [gameStatus, setGameStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [helpModalOpen, setHelpModalOpen] = useState(false);

    // Game refs
    const [wordleRef, setWordleRef] = useState(null);
    const [mastermindRef, setMastermindRef] = useState(null);
    const [hangmanRef, setHangmanRef] = useState(null);
    const [dungleonRef, setDungleonRef] = useState(null);

    // Game refs callbacks
    const handleWordleRef = useCallback(node => setWordleRef(node), []);
    const handleMastermindRef = useCallback(node => setMastermindRef(node), []);
    const handleHangmanRef = useCallback(node => setHangmanRef(node), []);
    const handleDungleonRef = useCallback(node => setDungleonRef(node), []);

    // Game results state - separate for each game
    const [letterBoxedResults, setLetterBoxedResults] = useState({
        solutions: [],
        gameData: null
    });
    const [spellingBeeResults, setSpellingBeeResults] = useState({
        solutions: [],
        gameData: null
    });
    const [wordleResults, setWordleResults] = useState({
        possibleWords: [],
        guessesWithEntropy: [],
        gameData: null
    });
    const [mastermindResults, setMastermindResults] = useState({
        possiblePatterns: [],
        guessesWithEntropy: [],
        gameData: null
    });
    const [hangmanResults, setHangmanResults] = useState({
        letterSuggestions: [],
        possibleWords: [],
        gameData: null
    });
    const [dungleonResults, setDungleonResults] = useState({
        possiblePatterns: [],
        guessesWithEntropy: [],
        gameData: null
    });

    const { showError, showSuccess } = useNotification();

    useEffect(() => {
        checkGameStatus();
    }, []);

    const checkGameStatus = async () => {
        setIsLoading(true);
        try {
            const response = await tryApiCall('/wordgames/status', {
                method: 'GET'
            });
            setGameStatus(response.data);
        } catch (error) {
            console.error('Failed to check game status:', error);
            setGameStatus({
                status: 'unavailable',
                message: 'Word games service is not available',
                error: error.message
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = useCallback((event, newValue) => {
        setActiveTab(newValue);
        handleClear('all');
    }, []);

    const handleSolve = useCallback(async (gameType, gameData) => {
        setIsLoading(true);
        try {
            let response;

            if (gameType === 'letterboxed') {
                response = await tryApiCall('/wordgames/letterboxed', {
                    method: 'POST',
                    data: gameData,
                    timeout: 300000
                });
                const newGameData = {
                    letters: response.data.letters,
                    config: gameData.config || 1,
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
                response = await tryApiCall('/wordgames/spellingbee', {
                    method: 'POST',
                    data: gameData,
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
                response = await tryApiCall('/wordgames/wordle', {
                    method: 'POST',
                    data: gameData,
                    timeout: 300000
                });
                const newGameData = {
                    guesses: gameData.guesses,
                    wordLength: gameData.wordLength,
                    maxDepth: gameData.maxDepth,
                    excludeUncommonWords: gameData.excludeUncommonWords,
                    possibleWordsCount: response.data.possibleWordsCount,
                    guessesCount: response.data.guessesCount,
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
                response = await tryApiCall('/wordgames/mastermind', {
                    method: 'POST',
                    data: gameData,
                    timeout: 300000
                });
                const newGameData = {
                    guesses: gameData.guesses,
                    pegs: gameData.pegs,
                    colors: gameData.colors,
                    allowDuplicates: gameData.allowDuplicates,
                    maxDepth: gameData.maxDepth,
                    colorMapping: gameData.colorMapping, // Pass through color mapping
                    possibleCount: response.data.possibleCount,
                    guessesCount: response.data.guessesCount,
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
                response = await tryApiCall('/wordgames/hangman', {
                    method: 'POST',
                    data: gameData,
                    timeout: 300000
                });
                const newGameData = {
                    pattern: response.data.pattern,
                    excludedLetters: response.data.excludedLetters,
                    maxDepth: gameData.maxDepth,
                    possibleWordsCount: response.data.possibleWordsCount,
                    letterGuessesCount: response.data.letterGuessesCount,
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
                response = await tryApiCall('/wordgames/dungleon', {
                    method: 'POST',
                    data: gameData,
                    timeout: 300000
                });

                const newGameData = {
                    guesses: gameData.guesses,
                    wordLength: gameData.wordLength,
                    maxDepth: gameData.maxDepth,
                    excludeUncommonWords: gameData.excludeUncommonWords,
                    possibleWordsCount: response.data.possiblePatternsCount,
                    guessesCount: response.data.guessesCount,
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
                const message = `Found ${response.data.possiblePatternsCount} possible words and ${response.data.guessesCount} suggested guesses in ${response.data.executionTime}ms`;
                showSuccess(message);
            }
        } catch (error) {
            console.error(`Failed to solve ${gameType}:`, error);
            showError(error.message || `Failed to solve ${gameType} puzzle`);
        } finally {
            setIsLoading(false);
        }
    }, [showError, showSuccess]);

    const handleClear = useCallback((gameType) => {
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

    const handleSuggestedGuessSelect = useCallback((pattern) => {
        // Handle selecting a suggested guess for both wordle and mastermind
        if (activeTab === 2 && wordleRef) {
            // For Wordle, pattern is a word string
            wordleRef.fillSuggestedGuess(pattern);
        } else if (activeTab === 3 && mastermindRef) {
            // For Mastermind, pattern is a space-separated string of numbers
            mastermindRef.fillSuggestedGuess(pattern);
        } else if (activeTab === 5 && dungleonRef) {
            // For Dungleon, pattern is a word string
            dungleonRef.fillSuggestedGuess(pattern);
        }
    }, [activeTab, wordleRef, mastermindRef, dungleonRef]);

    const handlePossibleSolutionSelect = useCallback((solution) => {
        // Handle selecting a possible solution for both wordle and mastermind
        if (activeTab === 2 && wordleRef) {
            // For Wordle, solution is a word string
            wordleRef.fillSuggestedGuess(solution);
        } else if (activeTab === 3 && mastermindRef) {
            // For Mastermind, solution is a space-separated string of numbers
            mastermindRef.fillSuggestedGuess(solution);
        } else if (activeTab === 5 && dungleonRef) {
            // For Dungleon, solution is a word string
            dungleonRef.fillSuggestedGuess(solution);
        }
    }, [activeTab, wordleRef, mastermindRef, dungleonRef]);

    const handleLoadMore = useCallback(async (type) => {
        // Implementation for loading more results
        let gameData;
        let currentResults;
        if (activeTab === 0) {
            gameData = letterBoxedResults.gameData;
            currentResults = letterBoxedResults;
        } else if (activeTab === 1) {
            gameData = spellingBeeResults.gameData;
            currentResults = spellingBeeResults;
        } else if (activeTab === 2) {
            gameData = wordleResults.gameData;
            currentResults = wordleResults;
        } else if (activeTab === 3) {
            gameData = mastermindResults.gameData;
            currentResults = mastermindResults;
        } else if (activeTab === 5) { // Dungleon
            gameData = dungleonResults.gameData;
            currentResults = dungleonResults;
        }

        if (!gameData) return;

        setIsLoading(true);
        try {
            let endpoint = '';
            let dataToSend = {};
            let currentCount = 0;

            if (activeTab === 2 || activeTab === 3 || activeTab === 5) { // Wordle, Mastermind, or Dungleon
                if (type === 'possible') {
                    currentCount = currentResults.possibleWords.length;
                    endpoint = '/wordgames/load';
                    dataToSend = {
                        start: currentCount,
                        end: currentCount + 100,
                        gameMode: activeTab === 2 ? 'wordle' : activeTab === 3 ? 'mastermind' : 'dungleon',
                        fileType: 'possible',
                        filePath: gameData.resultsFile
                    };
                } else if (type === 'guesses') {
                    currentCount = currentResults.guessesWithEntropy.length;
                    endpoint = '/wordgames/load';
                    dataToSend = {
                        start: currentCount,
                        end: currentCount + 100,
                        gameMode: activeTab === 2 ? 'wordle' : activeTab === 3 ? 'mastermind' : 'dungleon',
                        fileType: 'guesses',
                        filePath: gameData.resultsFile
                    };
                }

                const response = await tryApiCall(endpoint, {
                    method: 'POST',
                    data: dataToSend
                });

                if (type === 'possible') {
                    if (activeTab === 2) {
                        const newSolutions = response.data.solutions || {};
                        setWordleResults(prev => ({
                            ...prev,
                            possibleWords: [...prev.possibleWords, ...(newSolutions.possibleWords || [])]
                        }));
                    } else if (activeTab === 3) {
                        const newSolutions = response.data.solutions || {};
                        setMastermindResults(prev => ({
                            ...prev,
                            possiblePatterns: [...prev.possiblePatterns, ...(newSolutions.possiblePatterns || [])]
                        }));
                    } else if (activeTab === 5) {
                        const newSolutions = response.data.solutions || {};
                        setDungleonResults(prev => ({
                            ...prev,
                            possiblePatterns: [...prev.possiblePatterns, ...(newSolutions.possiblePatterns || [])]
                        }));
                    }
                } else if (type === 'guesses') {
                    if (activeTab === 2) {
                        const newSolutions = response.data.solutions || {};
                        setWordleResults(prev => ({
                            ...prev,
                            guessesWithEntropy: [...prev.guessesWithEntropy, ...(newSolutions.guessesWithEntropy || [])]
                        }));
                    } else if (activeTab === 3) {
                        const newSolutions = response.data.solutions || {};
                        setMastermindResults(prev => ({
                            ...prev,
                            guessesWithEntropy: [...prev.guessesWithEntropy, ...(newSolutions.guessesWithEntropy || [])]
                        }));
                    } else if (activeTab === 5) {
                        const newSolutions = response.data.solutions || {};
                        setDungleonResults(prev => ({
                            ...prev,
                            guessesWithEntropy: [...prev.guessesWithEntropy, ...(newSolutions.guessesWithEntropy || [])]
                        }));
                    }
                }
            } else {
                // Letter Boxed or Spelling Bee
                currentCount = currentResults.solutions.length;

                if (activeTab === 0) {
                    endpoint = '/wordgames/load';
                    dataToSend = {
                        start: currentCount,
                        end: currentCount + 100,
                        gameMode: 'letterboxed',
                        fileType: 'results',
                        filePath: gameData.resultsFile
                    };
                } else {
                    endpoint = '/wordgames/load';
                    dataToSend = {
                        start: currentCount,
                        end: currentCount + 100,
                        gameMode: 'spellingbee',
                        fileType: 'results',
                        filePath: gameData.resultsFile
                    };
                }

                const response = await tryApiCall(endpoint, {
                    method: 'POST',
                    data: dataToSend
                });

                if (activeTab === 0) {
                    setLetterBoxedResults(prev => ({
                        ...prev,
                        solutions: [...prev.solutions, ...(response.data.solutions || [])]
                    }));
                } else {
                    setSpellingBeeResults(prev => ({
                        ...prev,
                        solutions: [...prev.solutions, ...(response.data.solutions || [])]
                    }));
                }
            }

            showSuccess(`Loaded more ${type} results`);
        } catch (error) {
            showError('Failed to load more results');
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, letterBoxedResults, spellingBeeResults, wordleResults, mastermindResults, dungleonResults, showError, showSuccess]);
    const copyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess('Copied to clipboard');
        }).catch(() => {
            showError('Failed to copy to clipboard');
        });
    }, [showSuccess, showError]);

    const handleHelpOpen = useCallback(() => {
        setHelpModalOpen(true);
    }, []);

    const handleHelpClose = useCallback(() => {
        setHelpModalOpen(false);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'available':
                return 'success';
            case 'unavailable':
                return 'error';
            default:
                return 'warning';
        }
    };

    return (
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 1, sm: 2, md: 3 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <GamesIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                        <Box sx={{ typography: 'h4', fontWeight: 600 }}>Word Games</Box>
                    </Box>
                    <Box sx={{ typography: 'body1', color: 'text.secondary' }}>
                        Solve Letter Boxed, Spelling Bee, Wordle, Mastermind, and Hangman puzzles
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {gameStatus && (
                        <Chip
                            label={gameStatus.status === 'available' ? 'Online' : 'Offline'}
                            color={getStatusColor(gameStatus.status)}
                            size="small"
                        />
                    )}
                    <Tooltip title="Refresh Status">
                        <IconButton onClick={checkGameStatus} color="primary" disabled={isLoading}>
                            {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Status Alert */}
            {gameStatus && gameStatus.status !== 'available' && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {gameStatus.message || 'Word games service is not available'}
                </Alert>
            )}

            {/* Game Selection Dropdown */}
            <Box sx={{ mb: 3 }}>
                <FormControl fullWidth variant="outlined">
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
                                <LetterBoxedIcon /> Letter Boxed
                            </Box>
                        </MenuItem>
                        <MenuItem value={1}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Bee /> Spelling Bee
                            </Box>
                        </MenuItem>
                        <MenuItem value={2}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <QuizIcon /> Wordle
                            </Box>
                        </MenuItem>
                        <MenuItem value={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <MastermindIcon /> Mastermind
                            </Box>
                        </MenuItem>
                        <MenuItem value={4}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HangmanIcon /> Hangman
                            </Box>
                        </MenuItem>
                        <MenuItem value={5}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DungleonIcon /> Dungleon
                            </Box>
                        </MenuItem>
                    </Select>
                </FormControl>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                        startIcon={<HelpIcon />}
                        onClick={handleHelpOpen}
                        size="small"
                    >
                        How to Play
                    </Button>
                </Box>
            </Box>

            {/* Game Content */}
            <Grid container spacing={3}>
                <Grid size={12}>
                    {activeTab === 0 && (
                        <LetterBoxedGame
                            gameStatus={gameStatus}
                            isLoading={isLoading}
                            onSolve={handleSolve}
                            onClear={() => handleClear('letterboxed')}
                            showError={showError}
                            results={letterBoxedResults}
                            onLoadMore={() => handleLoadMore('solutions')}
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
                            ref={handleWordleRef}
                            gameStatus={gameStatus}
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
                            ref={handleMastermindRef}
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
                        />
                    )}
                    {activeTab === 5 && (
                        <DungleonGame
                            ref={handleDungleonRef}
                            gameStatus={gameStatus}
                            isLoading={isLoading}
                            onSolve={handleSolve}
                            onClear={() => handleClear('dungleon')}
                            showError={showError}
                            results={dungleonResults}
                            onLoadMore={handleLoadMore}
                        />
                    )}
                </Grid>
            </Grid>

            {/* Results */}
            <Box sx={{ mt: 3 }}>

            </Box>

            {/* Help Modal */}
            <GameHelpModal
                open={helpModalOpen}
                onClose={handleHelpClose}
                gameType={activeTab === 0 ? 'letterboxed' : activeTab === 1 ? 'spellingbee' : activeTab === 2 ? 'wordle' : activeTab === 3 ? 'mastermind' : activeTab === 4 ? 'hangman' : 'dungleon'}
            />
        </Container>
    );
};

export default WordGames;
