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
import GameSettingsDialog from './GameSettingsDialog';

const WordleResults = ({
    possibleWords,
    guessesWithEntropy,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard,
    onPossibleSolutionSelect,
    onSuggestedGuessSelect
}) => {
    const copyPossibleWords = () => {
        const wordsText = possibleWords.join('\n');
        onCopyToClipboard(wordsText);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.word} - ${g.probability} - ${g.entropy}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const formatRoundedNum = (num) => {
        if (!num) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    if (possibleWords.length === 0 && guessesWithEntropy.length === 0 && !lastGameData) return null;

    return (
        <Grid container spacing={3} sx={{ mt: 3 }}>
            {/* Possible Words */}
            <Grid size={{ xs: 12, md: guessesWithEntropy.length > 0 || (lastGameData && lastGameData.guessesCount > 0) ? 6 : 12 }}>
                <Card>
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
                    <Card>
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
                                            <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>Win %</Grid>
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
                                                        {formatRoundedNum(guess.probability * 100)}%
                                                    </Grid>
                                                    <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>
                                                        {guess.entropy !== null ? formatRoundedNum(guess.entropy) : 'N/A'}
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
};

const WordleGame = forwardRef(({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }, ref) => {
    const [wordleGuesses, setWordleGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [currentGuessColors, setCurrentGuessColors] = useState([0, 0, 0, 0, 0]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        wordLength: 5,
        maxDepth: 1,
        excludeUncommonWords: true
    });

    const settingsFields = [
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
                { value: 0, label: 'Get all possible words' },
                { value: 1, label: 'Calculate best guesses' }
            ]
        },
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        }
    ];

    // Memoized color map
    const colorMap = useMemo(() => ({
        0: { bg: '#787c7e', color: 'white', symbol: null }, // grey
        1: { bg: '#c9b458', color: 'white', symbol: '●' }, // yellow
        2: { bg: '#6aaa64', color: 'white', symbol: '■' }  // green
    }), []);

    // Handle config changes (especially wordLength)
    const handleConfigSave = useCallback((newConfig) => {
        if (newConfig.wordLength !== config.wordLength) {
            setCurrentGuessColors(Array(newConfig.wordLength).fill(0));
            setCurrentGuess('');
            setWordleGuesses([]);
        }
        setConfig(newConfig);
    }, [config.wordLength]);

    useImperativeHandle(ref, () => ({
        fillSuggestedGuess: (word) => {
            const cleanWord = word.trim().toUpperCase();
            if (cleanWord.length === config.wordLength && /^[A-Z]+$/.test(cleanWord)) {
                setCurrentGuess(cleanWord);
                setCurrentGuessColors(Array(config.wordLength).fill(0));
            }
        }
    }), [config.wordLength]);

    const handleCurrentGuessChange = useCallback((e) => {
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

        const feedback = currentGuessColors.join('');
        const newGuess = { word: guess, feedback: feedback, colors: [...currentGuessColors] };
        setWordleGuesses([...wordleGuesses, newGuess]);
        setCurrentGuess('');
        setCurrentGuessColors(Array(config.wordLength).fill(0));
    }, [currentGuess, currentGuessColors, wordleGuesses, config.wordLength, showError]);

    const toggleLetterColor = useCallback((index) => {
        const newColors = [...currentGuessColors];
        newColors[index] = (newColors[index] + 1) % 3;
        setCurrentGuessColors(newColors);
    }, [currentGuessColors]);

    const toggleExistingGuessColor = useCallback((guessIndex, letterIndex) => {
        setWordleGuesses(prev => prev.map((guess, idx) => {
            if (idx !== guessIndex) return guess;
            const newColors = [...guess.colors];
            newColors[letterIndex] = (newColors[letterIndex] + 1) % 3;
            return {
                ...guess,
                colors: newColors,
                feedback: newColors.join('')
            };
        }));
    }, []);

    const removeWordleGuess = useCallback((index) => {
        const newGuesses = wordleGuesses.filter((_, i) => i !== index);
        setWordleGuesses(newGuesses);
    }, [wordleGuesses]);

    const handleSolve = useCallback(async () => {
        if (wordleGuesses.length === 0) {
            showError('Please add at least one guess with feedback');
            return;
        }

        await onSolve('wordle', {
            guesses: wordleGuesses,
            wordLength: config.wordLength,
            maxDepth: config.maxDepth,
            excludeUncommonWords: config.excludeUncommonWords ? 1 : 0,
            start: 0,
            end: 100
        });
    }, [wordleGuesses, config, onSolve, showError]);

    const handleClear = useCallback(() => {
        setWordleGuesses([]);
        setCurrentGuess('');
        setCurrentGuessColors(Array(config.wordLength).fill(0));
        onClear();
    }, [config.wordLength, onClear]);

    return (
        <Card>
            <CardContent>
                {/* Top Left Control Layout */}
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <Button variant="outlined" onClick={handleClear} disabled={isLoading} size="small">
                        New Game
                    </Button>
                    <Tooltip title="Settings">
                        <IconButton onClick={() => setSettingsOpen(true)} size="small">
                            <SettingsIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                        Wordle Solver
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Enter your Wordle guesses and their color feedback to find possible solutions
                    </Typography>
                </Box>

                <Grid container spacing={3} justifyContent="center">
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Stack spacing={3}>
                            {/* Add Guess Section */}
                            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>Add Word</Typography>
                                <Stack spacing={2}>
                                    <TextField
                                        label={`${config.wordLength}-letter word`}
                                        value={currentGuess}
                                        onChange={handleCurrentGuessChange}
                                        fullWidth
                                        slotProps={{
                                            htmlInput: {
                                                maxLength: config.wordLength,
                                                style: {
                                                    textAlign: 'center',
                                                    fontSize: '1.1rem',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
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
                                            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', textAlign: 'center' }}>
                                                Click each letter to set its color:
                                            </Typography>
                                            <Box sx={{
                                                display: 'flex',
                                                gap: { xs: 0.5, sm: 1 },
                                                justifyContent: 'center',
                                                flexWrap: 'wrap'
                                            }}>
                                                {currentGuess.split('').map((letter, index) => {
                                                    const colors = colorMap[currentGuessColors[index]];
                                                    return (
                                                        <Box
                                                            key={index}
                                                            onClick={() => toggleLetterColor(index)}
                                                            sx={{
                                                                width: { xs: 45, sm: 50 },
                                                                height: { xs: 45, sm: 50 },
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                backgroundColor: colors.bg,
                                                                color: colors.color,
                                                                fontSize: { xs: '1.2rem', sm: '1.5rem' },
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                border: '2px solid #d3d6da',
                                                                position: 'relative',
                                                                borderRadius: 1,
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
                                                                        bottom: { xs: 2, sm: 4 },
                                                                        right: { xs: 2, sm: 4 },
                                                                        fontSize: { xs: '0.9rem', sm: '1.0rem' },
                                                                        lineHeight: 0.5,
                                                                        opacity: 1,
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
                                        variant="contained"
                                        onClick={addWordleGuess}
                                        disabled={currentGuess.length !== config.wordLength}
                                        startIcon={<AddIcon />}
                                        size="large"
                                        fullWidth
                                    >
                                        Add Word
                                    </Button>
                                </Stack>
                            </Box>

                            {/* Current Guesses */}
                            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    {`Current Guesses (${wordleGuesses.length})`}
                                </Typography>
                                {wordleGuesses.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                        {wordleGuesses.map((guess, index) => (
                                            <Box key={index} sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: { xs: 1, sm: 2 },
                                                flexWrap: 'wrap',
                                                justifyContent: 'center'
                                            }}>
                                                <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 0.5 } }}>
                                                    {guess.word.split('').map((letter, letterIndex) => {
                                                        // Reconstruct color index from feedback or colors array if available
                                                        let colorIndex;
                                                        if (guess.colors) {
                                                            colorIndex = guess.colors[letterIndex];
                                                        } else if (guess.feedback) {
                                                            colorIndex = parseInt(guess.feedback[letterIndex], 10);
                                                        }

                                                        const colors = colorMap[colorIndex || 0];

                                                        return (
                                                            <Box
                                                                key={letterIndex}
                                                                onClick={() => toggleExistingGuessColor(index, letterIndex)}
                                                                sx={{
                                                                    width: { xs: 35, sm: 40 },
                                                                    height: { xs: 35, sm: 40 },
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.color,
                                                                    fontSize: { xs: '1rem', sm: '1.2rem' },
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
                                                                            bottom: 2,
                                                                            right: 2,
                                                                            fontSize: '0.7rem',
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
                                                >
                                                    <CloseIcon />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                                        No guesses added yet.
                                    </Typography>
                                )}
                            </Box>

                            <Button
                                variant="contained"
                                onClick={handleSolve}
                                disabled={isLoading || wordleGuesses.length === 0}
                                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                                fullWidth
                                size="large"
                            >
                                {isLoading ? 'Solving...' : 'Solve'}
                            </Button>
                        </Stack>
                    </Grid>
                </Grid>

                {/* Results Component */}
                {results && (
                    <WordleResults
                        possibleWords={results.possibleWords || []}
                        guessesWithEntropy={results.guessesWithEntropy || []}
                        lastGameData={results.gameData}
                        isLoading={isLoading}
                        onLoadMore={onLoadMore}
                        onCopyToClipboard={(text) => navigator.clipboard.writeText(text)}
                        onPossibleSolutionSelect={(word) => {
                            setCurrentGuess(word);
                            // Reset colors for new word
                            setCurrentGuessColors(Array(word.length).fill(0));
                            // Scroll to input
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onSuggestedGuessSelect={(word) => {
                            setCurrentGuess(word);
                            setCurrentGuessColors(Array(word.length).fill(0));
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    />
                )}

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
    );
});

WordleGame.displayName = 'WordleGame';

export default React.memo(WordleGame);
