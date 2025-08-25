import React, { useState, useCallback, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Grid,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    IconButton
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Add as AddIcon,
    Close as CloseIcon
} from '@mui/icons-material';

const WordleGame = ({ gameStatus, isLoading, onSolve, onClear, showError }) => {
    const [wordleGuesses, setWordleGuesses] = useState([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [currentGuessColors, setCurrentGuessColors] = useState([0, 0, 0, 0, 0]); // 0=grey, 1=yellow, 2=green
    const [wordleMaxDepth, setWordleMaxDepth] = useState(1);

    // Memoized color map to prevent recreation on every render
    const colorMap = useMemo(() => ({
        0: { bg: '#787c7e', color: 'white' }, // grey
        1: { bg: '#c9b458', color: 'white' }, // yellow
        2: { bg: '#6aaa64', color: 'white' }  // green
    }), []);

    const handleCurrentGuessChange = useCallback((e) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 5);
        setCurrentGuess(cleanValue);
    }, []);

    const handleWordleMaxDepthChange = useCallback((e) => {
        setWordleMaxDepth(e.target.value);
    }, []);

    const addWordleGuess = useCallback(() => {
        const guess = currentGuess.trim().toUpperCase();

        // Validate guess
        if (guess.length !== 5) {
            showError('Guess must be exactly 5 letters');
            return;
        }

        if (!/^[A-Z]+$/.test(guess)) {
            showError('Guess must contain only letters');
            return;
        }

        // Convert colors to feedback string
        const feedback = currentGuessColors.join('');
        const newGuess = { word: guess, feedback: feedback, colors: [...currentGuessColors] };
        setWordleGuesses([...wordleGuesses, newGuess]);
        setCurrentGuess('');
        setCurrentGuessColors([0, 0, 0, 0, 0]);
    }, [currentGuess, currentGuessColors, wordleGuesses, showError]);

    const toggleLetterColor = useCallback((index) => {
        const newColors = [...currentGuessColors];
        newColors[index] = (newColors[index] + 1) % 3; // Cycle through 0, 1, 2
        setCurrentGuessColors(newColors);
    }, [currentGuessColors]);

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
            maxDepth: wordleMaxDepth,
            start: 0,
            end: 100
        });
    }, [wordleGuesses, wordleMaxDepth, onSolve, showError]);

    const handleClear = useCallback(() => {
        setWordleGuesses([]);
        setCurrentGuess('');
        setCurrentGuessColors([0, 0, 0, 0, 0]);
        setWordleMaxDepth(0);
        onClear();
    }, [onClear]);

    return (
        <Card>
            <CardContent>
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
                                <Typography variant="h6" sx={{ mb: 2 }}>Add Guess</Typography>
                                <Stack spacing={2}>
                                    {/* Word Input */}
                                    <Stack spacing={2} sx={{ width: '100%' }}>
                                        <TextField
                                            label="5-letter word"
                                            value={currentGuess}
                                            onChange={handleCurrentGuessChange}
                                            fullWidth
                                            slotProps={{
                                                htmlInput: {
                                                    maxLength: 5,
                                                    style: {
                                                        textAlign: 'center',
                                                        fontSize: '1.1rem',
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase'
                                                    }
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
                                                                    borderRadius: 1,
                                                                    '&:hover': {
                                                                        opacity: 0.8
                                                                    }
                                                                }}
                                                            >
                                                                {letter}
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        )}

                                        <Button
                                            variant="contained"
                                            onClick={addWordleGuess}
                                            disabled={currentGuess.length !== 5}
                                            startIcon={<AddIcon />}
                                            size="large"
                                            fullWidth
                                        >
                                            Add Guess
                                        </Button>
                                    </Stack>

                                </Stack>
                            </Box>

                            {/* Current Guesses */}
                            {wordleGuesses.length > 0 && (
                                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>Current Guesses</Typography>
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
                                                        const colors = colorMap[guess.colors[letterIndex]];
                                                        return (
                                                            <Box
                                                                key={letterIndex}
                                                                sx={{
                                                                    width: { xs: 40, sm: 50 },
                                                                    height: { xs: 40, sm: 50 },
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    backgroundColor: colors.bg,
                                                                    color: colors.color,
                                                                    fontSize: { xs: '1.2rem', sm: '1.5rem' },
                                                                    fontWeight: 'bold',
                                                                    border: '2px solid #d3d6da',
                                                                    borderRadius: 1
                                                                }}
                                                            >
                                                                {letter}
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => removeWordleGuess(index)}
                                                    sx={{ ml: { xs: 0, sm: 1 } }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {/* Solver Mode Setting */}
                            <FormControl fullWidth>
                                <InputLabel>Solver Mode</InputLabel>
                                <Select
                                    value={wordleMaxDepth}
                                    label="Solver Mode"
                                    onChange={handleWordleMaxDepthChange}
                                >
                                    <MenuItem value={0}>Get all possible words</MenuItem>
                                    <MenuItem value={1}>Calculate best guesses</MenuItem>
                                </Select>
                            </FormControl>

                            {/* Action Buttons */}
                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant="contained"
                                    onClick={handleSolve}
                                    disabled={isLoading || gameStatus?.status !== 'available' || wordleGuesses.length === 0}
                                    startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                    fullWidth
                                    size="large"
                                    color="primary"
                                >
                                    Solve Wordle
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={handleClear}
                                    disabled={isLoading}
                                    size="large"
                                >
                                    Clear
                                </Button>
                            </Stack>
                        </Stack>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default WordleGame;
