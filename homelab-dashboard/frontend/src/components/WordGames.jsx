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
    Tabs,
    Tab
} from '@mui/material';
import {
    Games as GamesIcon,
    Refresh as RefreshIcon,
    Quiz as QuizIcon,
    ViewModule as LetterBoxedIcon,
    EmojiNature as Bee,
    HelpOutline as HelpIcon,
    Psychology as MastermindIcon
} from '@mui/icons-material';
import { tryApiCall } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import LetterBoxedGame from './LetterBoxedGame';
import SpellingBeeGame from './SpellingBeeGame';
import WordleGame from './WordleGame';
import MastermindGame from './MastermindGame';
import GameResults from './GameResults';
import GameHelpModal from './GameHelpModal';

const WordGames = () => {
    const [gameStatus, setGameStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [helpModalOpen, setHelpModalOpen] = useState(false);

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
        possibleWords: [],
        guessesWithEntropy: [],
        gameData: null
    });

    // Ref to access MastermindGame component
    const mastermindGameRef = useRef(null);
    // Ref to access WordleGame component  
    const wordleGameRef = useRef(null);

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
                    timeout: 30000
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
                    timeout: 30000
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
                    timeout: 30000
                });
                const newGameData = {
                    guesses: gameData.guesses,
                    maxDepth: gameData.maxDepth,
                    possibleWordsCount: response.data.possibleWordsCount,
                    guessesCount: response.data.guessesCount,
                    actualPossibleWordsFound: response.data.actualPossibleWordsFound,
                    actualGuessesFound: response.data.actualGuessesFound,
                    isLimitedPossible: response.data.isLimitedPossible,
                    isLimitedGuesses: response.data.isLimitedGuesses,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    possibleFile: response.data.possibleFile,
                    guessesFile: response.data.guessesFile
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
                    timeout: 30000
                });
                const newGameData = {
                    guess: gameData.guess,
                    numPegs: gameData.numPegs,
                    numColors: gameData.numColors,
                    allowDuplicates: gameData.allowDuplicates,
                    maxDepth: gameData.maxDepth,
                    colorMapping: gameData.colorMapping, // Pass through color mapping
                    possibleWordsCount: response.data.possibleWordsCount,
                    guessesCount: response.data.guessesCount,
                    actualPossibleWordsFound: response.data.actualPossibleWordsFound,
                    actualGuessesFound: response.data.actualGuessesFound,
                    isLimitedPossible: response.data.isLimitedPossible,
                    isLimitedGuesses: response.data.isLimitedGuesses,
                    executionTime: response.data.executionTime,
                    start: response.data.start,
                    end: response.data.end,
                    possibleFile: response.data.possibleFile,
                    guessesFile: response.data.guessesFile
                };
                setMastermindResults({
                    possibleWords: response.data.possibleWords || [],
                    guessesWithEntropy: response.data.guessesWithEntropy || [],
                    gameData: newGameData
                });
                const message = `Found ${response.data.possibleWordsCount} possible patterns and ${response.data.guessesCount} suggested guesses in ${response.data.executionTime}ms`;
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
        if (gameType === 'letterboxed' || gameType == 'all') {
            setLetterBoxedResults({ solutions: [], gameData: null });
        }
        if (gameType === 'spellingbee' || gameType == 'all') {
            setSpellingBeeResults({ solutions: [], gameData: null });
        }
        if (gameType === 'wordle' || gameType == 'all') {
            setWordleResults({ possibleWords: [], guessesWithEntropy: [], gameData: null });
        }
        if (gameType === 'mastermind' || gameType == 'all') {
            setMastermindResults({ possibleWords: [], guessesWithEntropy: [], gameData: null });
        }
    }, []);

    const handleSuggestedGuessSelect = useCallback((pattern) => {
        // Handle selecting a suggested guess for both wordle and mastermind
        if (activeTab === 2 && wordleGameRef.current) {
            // For Wordle, pattern is a word string
            wordleGameRef.current.fillSuggestedGuess(pattern);
        } else if (activeTab === 3 && mastermindGameRef.current) {
            // For Mastermind, pattern is a space-separated string of numbers
            mastermindGameRef.current.fillSuggestedGuess(pattern);
        }
    }, [activeTab]);

    const handlePossibleSolutionSelect = useCallback((solution) => {
        // Handle selecting a possible solution for both wordle and mastermind
        if (activeTab === 2 && wordleGameRef.current) {
            // For Wordle, solution is a word string
            wordleGameRef.current.fillSuggestedGuess(solution);
        } else if (activeTab === 3 && mastermindGameRef.current) {
            // For Mastermind, solution is a space-separated string of numbers
            mastermindGameRef.current.fillSuggestedGuess(solution);
        }
    }, [activeTab]);

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
        }

        if (!gameData) return;

        setIsLoading(true);
        try {
            let endpoint = '';
            let dataToSend = {};
            let currentCount = 0;

            if (activeTab === 2 || activeTab === 3) { // Wordle or Mastermind
                if (type === 'possible') {
                    currentCount = currentResults.possibleWords.length;
                    endpoint = '/wordgames/load';
                    dataToSend = {
                        start: currentCount,
                        end: currentCount + 100,
                        gameMode: activeTab === 2 ? 'wordle' : 'mastermind',
                        fileType: 'possible',
                        filePath: gameData.possibleFile
                    };
                } else if (type === 'guesses') {
                    currentCount = currentResults.guessesWithEntropy.length;
                    endpoint = '/wordgames/load';
                    dataToSend = {
                        start: currentCount,
                        end: currentCount + 100,
                        gameMode: activeTab === 2 ? 'wordle' : 'mastermind',
                        fileType: 'guesses',
                        filePath: gameData.guessesFile
                    };
                }

                const response = await tryApiCall(endpoint, {
                    method: 'POST',
                    data: dataToSend
                });

                if (type === 'possible') {
                    if (activeTab === 2) {
                        setWordleResults(prev => ({
                            ...prev,
                            possibleWords: [...prev.possibleWords, ...(response.data.solutions || [])]
                        }));
                    } else {
                        setMastermindResults(prev => ({
                            ...prev,
                            possibleWords: [...prev.possibleWords, ...(response.data.solutions || [])]
                        }));
                    }
                } else if (type === 'guesses') {
                    if (activeTab === 2) {
                        setWordleResults(prev => ({
                            ...prev,
                            guessesWithEntropy: [...prev.guessesWithEntropy, ...(response.data.solutions || [])]
                        }));
                    } else {
                        setMastermindResults(prev => ({
                            ...prev,
                            guessesWithEntropy: [...prev.guessesWithEntropy, ...(response.data.solutions || [])]
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
    }, [activeTab, letterBoxedResults, spellingBeeResults, wordleResults, mastermindResults, showError, showSuccess]); const copyToClipboard = useCallback((text) => {
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
                        Solve Letter Boxed, Spelling Bee, and Wordle puzzles
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

            {/* Game Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{
                            flex: 1,
                            '& .MuiTab-root': {
                                minHeight: 72,
                                textTransform: 'none',
                                fontSize: { xs: '0.875rem', sm: '1rem' },
                                fontWeight: 500,
                                minWidth: { xs: 120, sm: 'auto' }
                            }
                        }}
                    >
                        <Tab
                            icon={<LetterBoxedIcon />}
                            label="Letter Boxed"
                            iconPosition="top"
                        />
                        <Tab
                            icon={<Bee />}
                            label="Spelling Bee"
                            iconPosition="top"
                        />
                        <Tab
                            icon={<QuizIcon />}
                            label="Wordle"
                            iconPosition="top"
                        />
                        <Tab
                            icon={<MastermindIcon />}
                            label="Mastermind"
                            iconPosition="top"
                        />
                    </Tabs>
                    <Tooltip title="Help & Rules">
                        <IconButton
                            onClick={handleHelpOpen}
                            color="primary"
                            sx={{ ml: 1 }}
                        >
                            <HelpIcon />
                        </IconButton>
                    </Tooltip>
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
                        />
                    )}
                    {activeTab === 1 && (
                        <SpellingBeeGame
                            gameStatus={gameStatus}
                            isLoading={isLoading}
                            onSolve={handleSolve}
                            onClear={() => handleClear('spellingbee')}
                            showError={showError}
                        />
                    )}
                    {activeTab === 2 && (
                        <WordleGame
                            ref={wordleGameRef}
                            gameStatus={gameStatus}
                            isLoading={isLoading}
                            onSolve={handleSolve}
                            onClear={() => handleClear('wordle')}
                            showError={showError}
                        />
                    )}
                    {activeTab === 3 && (
                        <MastermindGame
                            ref={mastermindGameRef}
                            gameStatus={gameStatus}
                            isLoading={isLoading}
                            onSolve={handleSolve}
                            onClear={() => handleClear('mastermind')}
                            showError={showError}
                        />
                    )}
                </Grid>
            </Grid>

            {/* Results */}
            <Box sx={{ mt: 3 }}>
                {activeTab === 0 && (
                    <GameResults
                        gameType="letterboxed"
                        solutions={letterBoxedResults.solutions}
                        possibleWords={[]}
                        guessesWithEntropy={[]}
                        lastGameData={letterBoxedResults.gameData}
                        lastGameType="letterboxed"
                        isLoading={isLoading}
                        onLoadMore={handleLoadMore}
                        onCopyToClipboard={copyToClipboard}
                    />
                )}
                {activeTab === 1 && (
                    <GameResults
                        gameType="spellingbee"
                        solutions={spellingBeeResults.solutions}
                        possibleWords={[]}
                        guessesWithEntropy={[]}
                        lastGameData={spellingBeeResults.gameData}
                        lastGameType="spellingbee"
                        isLoading={isLoading}
                        onLoadMore={handleLoadMore}
                        onCopyToClipboard={copyToClipboard}
                    />
                )}
                {activeTab === 2 && (
                    <GameResults
                        gameType="wordle"
                        solutions={[]}
                        possibleWords={wordleResults.possibleWords}
                        guessesWithEntropy={wordleResults.guessesWithEntropy}
                        lastGameData={wordleResults.gameData}
                        lastGameType="wordle"
                        isLoading={isLoading}
                        onLoadMore={handleLoadMore}
                        onCopyToClipboard={copyToClipboard}
                        onSuggestedGuessSelect={handleSuggestedGuessSelect}
                        onPossibleSolutionSelect={handlePossibleSolutionSelect}
                    />
                )}
                {activeTab === 3 && (
                    <GameResults
                        gameType="mastermind"
                        solutions={[]}
                        possibleWords={mastermindResults.possibleWords}
                        guessesWithEntropy={mastermindResults.guessesWithEntropy}
                        lastGameData={mastermindResults.gameData}
                        lastGameType="mastermind"
                        isLoading={isLoading}
                        onLoadMore={handleLoadMore}
                        onCopyToClipboard={copyToClipboard}
                        onSuggestedGuessSelect={handleSuggestedGuessSelect}
                        onPossibleSolutionSelect={handlePossibleSolutionSelect}
                    />
                )}
            </Box>

            {/* Help Modal */}
            <GameHelpModal
                open={helpModalOpen}
                onClose={handleHelpClose}
                gameType={activeTab === 0 ? 'letterboxed' : activeTab === 1 ? 'spellingbee' : activeTab === 2 ? 'wordle' : 'mastermind'}
            />
        </Container>
    );
};

export default WordGames;
