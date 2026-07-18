import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
    Button,
    Grid,
    Card,
    CardContent,
    CardActions,
    Typography,
    Avatar,
    Container
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    HelpOutline as HelpIcon,
    ArrowBack as ArrowBackIcon,
    Apps as AppsIcon
} from '@mui/icons-material';
import PageHeader from './PageHeader';
import { tryApiCall } from '../utils/api';
import { getErrorMessage } from '../utils/errors';
import { useNotification } from '../contexts/useNotification';
import LetterBoxedGame from './LetterBoxedGame';
import SpellingBeeGame from './SpellingBeeGame';
import WordleGame from './WordleGame';
import MastermindGame from './MastermindGame';
import HangmanGame from './HangmanGame';
import DungleonGame from './DungleonGame';
import GameHelpModal from './GameHelpModal';
import letterBoxedIcon from '../assets/letter_boxed_icon.svg';
import spellingBeeIcon from '../assets/spelling_bee_icon.svg';
import wordleIcon from '../assets/wordle_icon.svg';
import mastermindIcon from '../assets/mastermind_icon.svg';
import hangmanIcon from '../assets/hangman_icon.svg';
import dungleonIcon from '../assets/dungleon_icon.png';
import puzzleIcon from '../assets/puzzle_icon.svg';
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

const GAME_ICONS = {
    letterboxed: letterBoxedIcon,
    spellingbee: spellingBeeIcon,
    wordle: wordleIcon,
    mastermind: mastermindIcon,
    hangman: hangmanIcon,
    dungleon: dungleonIcon
} as const;

const GameIcon = ({
    src,
    alt,
    size = 24
}: {
    src: string;
    alt: string;
    size?: number;
}) => (
    <Box
        component="img"
        src={src}
        alt={alt}
        sx={{
            width: size,
            height: size,
            objectFit: 'contain',
            display: 'block',
            imageRendering: src.endsWith('.png') ? 'pixelated' : 'auto'
        }}
    />
);

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

    const gameCards = useMemo(() => [
        {
            key: 'letterboxed',
            title: 'Letter Boxed',
            description: 'Find word chains that use every letter on the square.',
            iconSrc: GAME_ICONS.letterboxed,
            color: 'primary' as const
        },
        {
            key: 'spellingbee',
            title: 'Spelling Bee',
            description: 'Discover valid words using the center letter and hive.',
            iconSrc: GAME_ICONS.spellingbee,
            color: 'primary' as const
        },
        {
            key: 'wordle',
            title: 'Wordle',
            description: 'Rank guesses by expected turns with color feedback.',
            iconSrc: GAME_ICONS.wordle,
            color: 'primary' as const
        },
        {
            key: 'mastermind',
            title: 'Mastermind',
            description: 'Solve peg-and-color codes with ENT-based suggestions.',
            iconSrc: GAME_ICONS.mastermind,
            color: 'primary' as const
        },
        {
            key: 'hangman',
            title: 'Hangman',
            description: 'Pick the best next letter for single- or multi-word puzzles.',
            iconSrc: GAME_ICONS.hangman,
            color: 'primary' as const
        },
        {
            key: 'dungleon',
            title: 'Dungleon',
            description: 'Narrow character patterns with entropy-guided guesses.',
            iconSrc: GAME_ICONS.dungleon,
            color: 'primary' as const
        }
    ], []);

    const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSolving, setIsSolving] = useState(false);
    const isCancelledRef = useRef(false);
    const [activeTab, setActiveTab] = useState<number>(() => {
        if (gameName) {
            return GAME_TABS[gameName.toLowerCase()] ?? 0;
        }
        return 0;
    });
    const [helpModalOpen, setHelpModalOpen] = useState(false);
    const showHome = !gameName;

    // Sync route change to tab state
    useEffect(() => {
        if (gameName) {
            const mappedTab = GAME_TABS[gameName.toLowerCase()];
            if (mappedTab === undefined) {
                navigate('/wordgames', { replace: true });
                return;
            }
            if (mappedTab !== activeTab) {
                setActiveTab(mappedTab);
            }
        }
    }, [gameName, activeTab, GAME_TABS, navigate]);



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
            setGameStatus({
                status: 'offline',
                healthy: false,
                message: 'Word games service is not available',
                error: getErrorMessage(error)
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
        setIsSolving(true);
        isCancelledRef.current = false;
        try {
            if (gameType === 'letterboxed') {
                const req = gameData as LetterBoxedRequest;
                const response = await tryApiCall<LetterBoxedResponse>('/wordgames/letterboxed', {
                    method: 'POST',
                    data: req,
                    timeout: 300000
                });
                if (isCancelledRef.current) return;
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
                if (isCancelledRef.current) return;
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
                if (isCancelledRef.current) return;
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
                if (isCancelledRef.current) return;
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
                if (isCancelledRef.current) return;
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
                if (isCancelledRef.current) return;

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
            if (isCancelledRef.current) {
                // Ignore the error and do not show any error/results notification when cancelled
                return;
            }
            console.error(`Failed to solve ${gameType}:`, error);
            showError(getErrorMessage(error, `Failed to solve ${gameType} puzzle`));
        } finally {
            setIsSolving(false);
        }
    }, [showError, showSuccess]);

    const handleCancel = useCallback(async () => {
        isCancelledRef.current = true;
        setIsSolving(false);
        try {
            await tryApiCall('/wordgames/cancel', {
                method: 'POST'
            });
            showSuccess('Solve operation cancelled');
        } catch (error: unknown) {
            console.error('Failed to cancel solve operation:', error);
            showError(getErrorMessage(error, 'Failed to cancel solve operation'));
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

    const statusControls = (
        <>
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
        </>
    );

    if (showHome) {
        return (
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <PageHeader
                    title="Puzzle++"
                    icon={<Box component="img" src={puzzleIcon} alt="Puzzle++ Logo" />}
                    actions={statusControls}
                />

                {gameStatus && !gameStatus.healthy && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {gameStatus.message || 'Word games service is not available'}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {gameCards.map((game) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={game.key}>
                            <Card
                                component={RouterLink}
                                to={`/wordgames/${game.key}`}
                                sx={{
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: 4
                                    }
                                }}
                            >
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar
                                            sx={{
                                                bgcolor: 'transparent',
                                                mr: 2,
                                                width: 48,
                                                height: 48
                                            }}
                                        >
                                            <GameIcon src={game.iconSrc} alt={game.title} size={40} />
                                        </Avatar>
                                        <Typography variant="h6" component="h2">
                                            {game.title}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {game.description}
                                    </Typography>
                                </CardContent>
                                <CardActions>
                                    <Button
                                        size="small"
                                        color={game.color}
                                        component="div"
                                        sx={{ ml: 'auto' }}
                                    >
                                        Open
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        );
    }

    return (
        <Box sx={{
            height: { md: '100vh' },
            maxHeight: { md: '100vh' },
            display: 'flex',
            flexDirection: 'column',
            p: { xs: 2, sm: 2.5, md: 3 },
            overflow: { xs: 'visible', md: 'hidden' },
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
                    <Tooltip title="All games">
                        <IconButton onClick={() => navigate('/wordgames')} size="small" color="primary">
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Box component="img" src={puzzleIcon} sx={{ width: 28, height: 28 }} alt="Puzzle++ Logo" />
                    <Box sx={{ typography: 'h5', fontWeight: 600 }}>Puzzle++</Box>
                    {statusControls}
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
                                    <GameIcon src={GAME_ICONS.letterboxed} alt="" size={20} /> Letter Boxed
                                </Box>
                            </MenuItem>
                            <MenuItem value={1}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GameIcon src={GAME_ICONS.spellingbee} alt="" size={20} /> Spelling Bee
                                </Box>
                            </MenuItem>
                            <MenuItem value={2}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GameIcon src={GAME_ICONS.wordle} alt="" size={20} /> Wordle
                                </Box>
                            </MenuItem>
                            <MenuItem value={3}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GameIcon src={GAME_ICONS.mastermind} alt="" size={20} /> Mastermind
                                </Box>
                            </MenuItem>
                            <MenuItem value={4}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GameIcon src={GAME_ICONS.hangman} alt="" size={20} /> Hangman
                                </Box>
                            </MenuItem>
                            <MenuItem value={5}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GameIcon src={GAME_ICONS.dungleon} alt="" size={20} /> Dungleon
                                </Box>
                            </MenuItem>
                        </Select>
                    </FormControl>

                    <Tooltip title="All games">
                        <IconButton onClick={() => navigate('/wordgames')} size="small">
                            <AppsIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>

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
                        isSolving={isSolving}
                        onSolve={handleSolve}
                        onCancel={handleCancel}
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
                        isSolving={isSolving}
                        onSolve={handleSolve}
                        onCancel={handleCancel}
                        onClear={() => handleClear('spellingbee')}
                        showError={showError}
                        results={spellingBeeResults}
                        onLoadMore={() => handleLoadMore('solutions')}
                    />
                )}
                {activeTab === 2 && (
                    <WordleGame
                        isLoading={isLoading}
                        isSolving={isSolving}
                        onSolve={handleSolve}
                        onCancel={handleCancel}
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
                        isSolving={isSolving}
                        onSolve={handleSolve}
                        onCancel={handleCancel}
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
                        isSolving={isSolving}
                        onSolve={handleSolve}
                        onCancel={handleCancel}
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
                        isSolving={isSolving}
                        onSolve={handleSolve}
                        onCancel={handleCancel}
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
