import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Grid,
    CircularProgress,
    Stack,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Add as AddIcon,
    Close as CloseIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import GameSettingsDialog, { FieldDefinition, DialogConfig } from './GameSettingsDialog';
import { WordleResultState } from '../types/api';

interface GuessWithEntropyItem {
    word: string;
    probability: number | null;
    entropy: number | null;
}

interface WordleResultsProps {
    possibleWords: string[];
    guessesWithEntropy: GuessWithEntropyItem[];
    lastGameData: WordleResultState['gameData'];
    isLoading: boolean;
    onLoadMore: (type: string) => void;
    onCopyToClipboard: (text: string) => void;
    onPossibleSolutionSelect: (word: string) => void;
    onSuggestedGuessSelect: (word: string) => void;
}

const WordleResults = React.memo(({
    possibleWords,
    guessesWithEntropy,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard,
    onPossibleSolutionSelect,
    onSuggestedGuessSelect
}: WordleResultsProps) => {
    const copyPossibleWords = () => {
        const wordsText = possibleWords.join('\n');
        onCopyToClipboard(wordsText);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.word} - ${g.probability} - ${g.entropy}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const formatRoundedNum = (num: number) => {
        if (!num) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    if (possibleWords.length === 0 && guessesWithEntropy.length === 0 && !lastGameData) return null;

    return (
        <Grid container spacing={3} sx={{ mt: 3 }}>
            {/* Possible Words */}
            <Grid size={{ xs: 12, md: guessesWithEntropy.length > 0 || (lastGameData && lastGameData.guessesCount > 0) ? 6 : 12 }}>
                <Card sx={{ height: '100%' }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box>
                                <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                    Possible Words ({possibleWords.length}/{lastGameData?.possibleWordsCount || possibleWords.length})
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Click to fill guess form
                                </Typography>
                            </Box>
                            {possibleWords.length > 0 && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={copyPossibleWords}
                                    startIcon={<CopyIcon />}
                                >
                                    Copy
                                </Button>
                            )}
                        </Box>

                        {(possibleWords.length > 0) ? (
                            <>
                                <Box
                                    sx={{
                                        maxHeight: 300,
                                        overflowY: 'auto',
                                        bgcolor: 'background.default',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1
                                    }}
                                >
                                    <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                                        {possibleWords.map((word, index) => (
                                            <Box
                                                key={index}
                                                onClick={() => onPossibleSolutionSelect(word)}
                                                sx={{
                                                    p: 1,
                                                    cursor: 'pointer',
                                                    '&:hover': { bgcolor: 'action.hover' },
                                                    fontFamily: 'monospace',
                                                    fontSize: '1rem',
                                                    fontWeight: 'bold',
                                                    pl: 2
                                                }}
                                            >
                                                {word}
                                            </Box>
                                        ))}
                                    </Stack>
                                </Box>
                                {lastGameData && lastGameData.isLimitedPossible && possibleWords.length < (lastGameData.possibleWordsCount || 0) && (
                                    <Button
                                        variant="contained"
                                        onClick={() => onLoadMore('possible')}
                                        disabled={isLoading}
                                        sx={{ mt: 2 }}
                                        size="small"
                                    >
                                        Load More
                                    </Button>
                                )}
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No solutions found.
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            </Grid>

            {/* Suggested Guesses */}
            {(guessesWithEntropy.length > 0 || (lastGameData && lastGameData.guessesCount > 0)) && (
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Suggested Guesses ({guessesWithEntropy.length}/{lastGameData?.guessesCount || guessesWithEntropy.length})
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Click to fill guess form
                                    </Typography>
                                </Box>
                                {guessesWithEntropy.length > 0 && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={copyGuesses}
                                        startIcon={<CopyIcon />}
                                    >
                                        Copy
                                    </Button>
                                )}
                            </Box>

                            {guessesWithEntropy.length > 0 ? (
                                <>
                                    <Box
                                        sx={{
                                            maxHeight: 300,
                                            overflowY: 'auto',
                                            bgcolor: 'background.default',
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1
                                        }}
                                    >
                                        <Grid container sx={{ p: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 'bold' }}>
                                            <Grid size={{ xs: 4 }} sx={{ pl: 1 }}>Word</Grid>
                                            <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>Probability</Grid>
                                            <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>ENT</Grid>
                                        </Grid>
                                        <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                                            {guessesWithEntropy.map((guess, index) => (
                                                <Grid
                                                    container
                                                    key={index}
                                                    onClick={() => onSuggestedGuessSelect(guess.word)}
                                                    sx={{
                                                        p: 1,
                                                        cursor: 'pointer',
                                                        '&:hover': { bgcolor: 'action.hover' },
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Grid size={{ xs: 4 }} sx={{ fontFamily: 'monospace', fontWeight: 'bold', pl: 1 }}>
                                                        {guess.word}
                                                    </Grid>
                                                    <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
                                                        {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                    </Grid>
                                                    <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>
                                                        {guess.entropy !== null ? formatRoundedNum(guess.entropy) : '-'}
                                                    </Grid>
                                                </Grid>
                                            ))}
                                        </Stack>
                                    </Box>
                                    {lastGameData && lastGameData.isLimitedGuesses && guessesWithEntropy.length < (lastGameData.guessesCount || 0) && (
                                        <Button
                                            variant="contained"
                                            onClick={() => onLoadMore('guesses')}
                                            disabled={isLoading}
                                            sx={{ mt: 2 }}
                                            size="small"
                                        >
                                            Load More
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    No suggested guesses available.
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            )}
        </Grid>
    );
});

WordleResults.displayName = 'WordleResults';

interface WordleGuessItem {
    word: string;
    feedback: string;
    colors: number[];
}

interface WordleGameProps {
    isLoading: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: WordleResultState | null;
    onLoadMore: (type: string) => void;
}

export interface WordleGameRef {
    fillSuggestedGuess: (word: string) => void;
}

const WordleGame = forwardRef<WordleGameRef, WordleGameProps>(({ isLoading, onSolve, onClear, showError, results, onLoadMore }, ref) => {
    const [wordleGuesses, setWordleGuesses] = useState<WordleGuessItem[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [currentGuessColors, setCurrentGuessColors] = useState<number[]>([0, 0, 0, 0, 0]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        wordLength: 5,
        maxDepth: 1,
        excludeUncommonWords: true
    });

    const settingsFields: FieldDefinition[] = [
        {
            name: 'wordLength',
            label: 'Word Length',
            type: 'number',
            min: 1,
            max: 32
        },
        {
            name: 'maxDepth',
            label: 'Solver Mode',
            type: 'select',
            options: [
                { value: 0, label: '0: Fastest' },
                { value: 1, label: '1: Balanced' },
                { value: 2, label: '2: Deep' }
            ]
        },
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        }
    ];

    // Memoized color map
    const colorMap = useMemo<Record<number, { bg: string; color: string; symbol: string | null }>>(() => ({
        0: { bg: '#787c7e', color: 'white', symbol: null },
        1: { bg: '#c9b458', color: 'white', symbol: '●' },
        2: { bg: '#6aaa64', color: 'white', symbol: '■' }
    }), []);

    // Handle config changes (especially wordLength)
    const handleConfigSave = useCallback((newConfig: DialogConfig) => {
        const newWordLength = Number(newConfig.wordLength);
        if (newWordLength !== config.wordLength) {
            setCurrentGuessColors(Array(newWordLength).fill(0));
            setCurrentGuess('');
            setWordleGuesses([]);
        }
        setConfig({
            wordLength: newWordLength,
            maxDepth: Number(newConfig.maxDepth),
            excludeUncommonWords: Boolean(newConfig.excludeUncommonWords)
        });
    }, [config.wordLength]);

    useImperativeHandle(ref, () => ({
        fillSuggestedGuess: (word: string) => {
            const cleanWord = word.trim().toUpperCase();
            if (cleanWord.length === config.wordLength && /^[A-Z]+$/.test(cleanWord)) {
                setCurrentGuess(cleanWord);
                setCurrentGuessColors(Array(config.wordLength).fill(0));
            }
        }
    }), [config.wordLength]);

    const handleCurrentGuessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, config.wordLength);
        setCurrentGuess(cleanValue);
    }, [config.wordLength]);

    const addWordleGuess = useCallback(() => {
        const guess = currentGuess.trim().toUpperCase();

        if (guess.length !== config.wordLength) {
            showError(`Guess must be exactly ${config.wordLength} letters`);
            return;
        }

        if (!/^[A-Z]+$/.test(guess)) {
            showError('Guess must contain only letters');
            return;
        }

        const feedbackMap = ['X', 'Y', 'G'];
        const feedback = currentGuessColors.map(c => feedbackMap[c] || 'X').join('');
        const newGuess: WordleGuessItem = { word: guess, feedback: feedback, colors: [...currentGuessColors] };
        setWordleGuesses([...wordleGuesses, newGuess]);
        setCurrentGuess('');
        setCurrentGuessColors(Array(config.wordLength).fill(0));
    }, [currentGuess, currentGuessColors, wordleGuesses, config.wordLength, showError]);

    const toggleLetterColor = useCallback((index: number) => {
        const newColors = [...currentGuessColors];
        newColors[index] = (newColors[index] + 1) % 3;
        setCurrentGuessColors(newColors);
    }, [currentGuessColors]);

    const toggleExistingGuessColor = useCallback((guessIndex: number, letterIndex: number) => {
        setWordleGuesses(prev => prev.map((guess, idx) => {
            if (idx !== guessIndex) return guess;
            const newColors = [...guess.colors];
            newColors[letterIndex] = (newColors[letterIndex] + 1) % 3;
            const feedbackMap = ['X', 'Y', 'G'];
            return {
                ...guess,
                colors: newColors,
                feedback: newColors.map(c => feedbackMap[c] || 'X').join('')
            };
        }));
    }, []);

    const removeWordleGuess = useCallback((index: number) => {
        const newGuesses = wordleGuesses.filter((_, i) => i !== index);
        setWordleGuesses(newGuesses);
    }, [wordleGuesses]);

    const handleSolve = useCallback(async () => {
        await onSolve('wordle', {
            guesses: wordleGuesses.map(g => g.word),
            results: wordleGuesses.map(g => g.feedback),
            wordLength: config.wordLength,
            maxDepth: config.maxDepth,
            excludeUncommonWords: config.excludeUncommonWords ? 1 : 0,
            start: 0,
            end: 100
        });
    }, [wordleGuesses, config, onSolve]);

    const handleClear = useCallback(() => {
        setWordleGuesses([]);
        setCurrentGuess('');
        setCurrentGuessColors(Array(config.wordLength).fill(0));
        onClear();
    }, [config.wordLength, onClear]);

    const handleCopyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const handlePossibleSolutionSelect = useCallback((word: string) => {
        setCurrentGuess(word);
        setCurrentGuessColors(Array(word.length).fill(0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleSuggestedGuessSelect = useCallback((word: string) => {
        setCurrentGuess(word);
        setCurrentGuessColors(Array(word.length).fill(0));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    return (
        <Grid container spacing={2}>
            {/* Input & Guess Controls Column */}
            <Grid size={{ xs: 12, md: 5, lg: 4 }}>
                <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        {/* Top Controls */}
                        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} justifyContent="space-between" alignItems="center">
                            <Button variant="outlined" onClick={handleClear} disabled={isLoading} size="small">
                                New Game
                            </Button>
                            <Tooltip title="Settings">
                                <IconButton onClick={() => setSettingsOpen(true)} size="small">
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Wordle Solver
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Enter your Wordle guesses and their color feedback.
                            </Typography>
                        </Box>

                        <Stack spacing={2}>
                            {/* Add Guess Section */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Add Guess</Typography>
                                <Stack spacing={1.5}>
                                    <TextField
                                        label={`${config.wordLength}-letter word`}
                                        size="small"
                                        value={currentGuess}
                                        onChange={handleCurrentGuessChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (currentGuess.length === config.wordLength) {
                                                    addWordleGuess();
                                                }
                                            }
                                        }}
                                        fullWidth
                                        slotProps={{
                                            htmlInput: {
                                                maxLength: config.wordLength,
                                                style: {
                                                    textAlign: 'center',
                                                    fontSize: '1rem',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase',
                                                    fontFamily: 'monospace',
                                                    letterSpacing: '0.1em'
                                                },
                                                autoComplete: 'off',
                                                autoCorrect: 'off',
                                                autoCapitalize: 'off',
                                                spellCheck: 'false'
                                            }
                                        }}
                                    />

                                    {/* Color Feedback Section */}
                                    {currentGuess.length > 0 && (
                                        <Box>
                                            <Typography variant="caption" sx={{ mb: 0.5, color: 'text.secondary', display: 'block', textAlign: 'center' }}>
                                                Set colors (click letters):
                                            </Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                gap: 0.5,
                                                justifyContent: 'center',
                                                flexWrap: 'wrap'
                                            }}>
                                                {currentGuess.split('').map((letter, index) => {
                                                    const colors = colorMap[currentGuessColors[index]] || colorMap[0];
                                                    return (
                                                        <Box
                                                            key={index}
                                                            onClick={() => toggleLetterColor(index)}
                                                            sx={{
                                                                width: 36,
                                                                height: 36,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                backgroundColor: colors.bg,
                                                                color: colors.color,
                                                                fontSize: '1.1rem',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                border: '2px solid #d3d6da',
                                                                position: 'relative',
                                                                borderRadius: 0.5,
                                                                userSelect: 'none',
                                                                '&:hover': {
                                                                    opacity: 0.8
                                                                }
                                                            }}
                                                        >
                                                            {letter}
                                                            {colors.symbol && (
                                                                <Box
                                                                    component="span"
                                                                    sx={{
                                                                        position: 'absolute',
                                                                        bottom: 1,
                                                                        right: 2,
                                                                        fontSize: '0.65rem',
                                                                        lineHeight: 0.5,
                                                                        opacity: 0.8,
                                                                    }}
                                                                >
                                                                    {colors.symbol}
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    )}

                                    <Button
                                        variant="outlined"
                                        onClick={addWordleGuess}
                                        disabled={currentGuess.length !== config.wordLength}
                                        startIcon={<AddIcon />}
                                        size="small"
                                        fullWidth
                                    >
                                        Add Word
                                    </Button>
                                </Stack>
                            </Box>

                            {/* Current Guesses */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                    {`Current Guesses (${wordleGuesses.length})`}
                                </Typography>
                                {wordleGuesses.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        {wordleGuesses.map((guess, index) => (
                                            <Box key={index} sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 1
                                            }}>
                                                <Box sx={{ display: 'flex', gap: 0.25 }}>
                                                    {guess.word.split('').map((letter, letterIndex) => {
                                                        let colorIndex = 0;
                                                        if (guess.colors) {
                                                            colorIndex = guess.colors[letterIndex];
                                                        } else if (guess.feedback) {
                                                            colorIndex = parseInt(guess.feedback[letterIndex], 10);
                                                        }

                                                        const colors = colorMap[colorIndex] || colorMap[0];

                                                        return (
                                                            <Box
                                                                key={letterIndex}
                                                                onClick={() => toggleExistingGuessColor(index, letterIndex)}
                                                                sx={{
                                                                    width: 28,
                                                                    height: 28,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.color,
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: 'bold',
                                                                    cursor: 'pointer',
                                                                    border: '1px solid #d3d6da',
                                                                    borderRadius: 0.5,
                                                                    userSelect: 'none',
                                                                    position: 'relative'
                                                                }}
                                                            >
                                                                {letter}
                                                                {colors.symbol && (
                                                                    <Box
                                                                        component="span"
                                                                        sx={{
                                                                            position: 'absolute',
                                                                            bottom: 1,
                                                                            right: 1,
                                                                            fontSize: '0.6rem',
                                                                            lineHeight: 1
                                                                        }}
                                                                    >
                                                                        {colors.symbol}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => removeWordleGuess(index)}
                                                    color="error"
                                                    sx={{ p: 0.5 }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', textAlign: 'center' }}>
                                        No guesses added yet.
                                    </Typography>
                                )}
                            </Box>

                            <Button
                                variant="contained"
                                onClick={handleSolve}
                                disabled={isLoading}
                                startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                                fullWidth
                                size="medium"
                            >
                                {isLoading ? 'Solving...' : 'Solve'}
                            </Button>
                        </Stack>

                        {/* Settings Dialog */}
                        <GameSettingsDialog
                            open={settingsOpen}
                            onClose={() => setSettingsOpen(false)}
                            onSave={handleConfigSave}
                            title="Wordle Settings"
                            config={config}
                            fields={settingsFields}
                        />
                    </CardContent>
                </Card>
            </Grid>

            {/* Results Column */}
            <Grid size={{ xs: 12, md: 7, lg: 8 }}>
                {results && (
                    <WordleResults
                        possibleWords={results.possibleWords || []}
                        guessesWithEntropy={results.guessesWithEntropy || []}
                        lastGameData={results.gameData}
                        isLoading={isLoading}
                        onLoadMore={onLoadMore}
                        onCopyToClipboard={handleCopyToClipboard}
                        onPossibleSolutionSelect={handlePossibleSolutionSelect}
                        onSuggestedGuessSelect={handleSuggestedGuessSelect}
                    />
                )}
            </Grid>
        </Grid>
    );
});

WordleGame.displayName = 'WordleGame';

export default React.memo(WordleGame);
