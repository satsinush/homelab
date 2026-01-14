import React, { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Grid,
    CircularProgress,
    Stack,
    IconButton,
    Tooltip,
    Paper,
    List,
    ListItem,
    ListItemText,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';

import {
    PlayArrow as PlayIcon,
    Close as CloseIcon,
    ArrowBack as BackspaceIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import GameSettingsDialog from './GameSettingsDialog';

// Character data matching C++ definition
const CHARACTERS = [
    { id: 'ar', name: 'Archer' },
    { id: 'kn', name: 'Knight' },
    { id: 'ma', name: 'Mage' },
    { id: 'bt', name: 'Bat' },
    { id: 'dr', name: 'Dragon' },
    { id: 'bo', name: 'Blade Orc' },
    { id: 'ne', name: 'Necromancer' },
    { id: 'ao', name: 'Axe Orc' },
    { id: 'sk', name: 'Skeleton' },
    { id: 'sp', name: 'Spider' },
    { id: 'bd', name: 'Bandit' },
    { id: 'tr', name: 'Troll' },
    { id: 'so', name: 'Sorcerer' },
    { id: 'ki', name: 'King' },
    { id: 'vi', name: 'Villager' },
    { id: 'co', name: 'Coins' },
    { id: 'ch', name: 'Chest' },
    { id: 're', name: 'Relic' },
    { id: 'fr', name: 'Frog' },
    { id: 'zo', name: 'Zombie' }
];

// Map for quick lookup
const CHARACTER_MAP = CHARACTERS.reduce((acc, char, index) => {
    acc[char.id] = { ...char, index };
    return acc;
}, {});

// Feedback styles using theme-compatible colors
const FEEDBACK_STYLES = {
    0: { borderColor: 'error.main', bgColor: 'error.main', badge: false }, // Not present (Red)
    1: { borderColor: 'warning.main', bgColor: 'warning.main', badge: false }, // Wrong pos (Yellow)
    2: { borderColor: 'success.main', bgColor: 'success.main', badge: false }, // Correct pos (Green)
    3: { borderColor: 'warning.main', bgColor: 'warning.main', badge: true },  // Wrong pos + 1 more
    4: { borderColor: 'success.main', bgColor: 'success.main', badge: true }   // Correct pos + 1 more
};

const getDungleonAssetPath = (charId) => {
    if (!charId) return null;
    const name = CHARACTER_MAP[charId]?.name?.toLowerCase().replace(' ', '_');
    return `/assets/dungleon/${name}.png`;
};

const DungleonPatternDisplay = ({ pattern }) => {
    if (!pattern) return null;
    const ids = pattern.trim().split(/\s+/);

    return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
            {ids.map((id, i) => (
                <Box key={i} sx={{
                    width: 32,
                    height: 32,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper'
                }}>
                    <Tooltip title={CHARACTER_MAP[id]?.name || id}>
                        <img
                            src={getDungleonAssetPath(id)}
                            alt={id}
                            style={{ width: 28, height: 28, objectFit: 'contain' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </Tooltip>
                </Box>
            ))}
        </Box>
    );
};

const DungleonResults = ({
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

    return (
        <Grid container spacing={3}>
            {/* Possible Patterns */}
            <Grid item xs={12} md={guessesWithEntropy.length > 0 || (lastGameData && lastGameData.guessesCount > 0) ? 6 : 12}>
                <Card>
                    {(possibleWords.length > 0) ? (
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Possible Patterns ({possibleWords.length}/{lastGameData?.possibleWordsCount || possibleWords.length})
                                    </Typography>
                                    {onPossibleSolutionSelect && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Click a pattern to fill the guess form
                                        </Typography>
                                    )}
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
                            <Paper
                                variant="outlined"
                                sx={{
                                    maxHeight: 300,
                                    overflowY: 'auto',
                                    bgcolor: 'background.default'
                                }}
                            >
                                <List dense>
                                    {possibleWords.map((pattern, index) => (
                                        <React.Fragment key={index}>
                                            <ListItem
                                                onClick={() => onPossibleSolutionSelect ? onPossibleSolutionSelect(pattern) : onCopyToClipboard(pattern)}
                                                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                            >
                                                <ListItemText
                                                    primary={<DungleonPatternDisplay pattern={pattern} />}
                                                />
                                            </ListItem>
                                            {index < possibleWords.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            </Paper>
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
                        </CardContent>) :
                        <CardContent>
                            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                Possible Patterns ({possibleWords.length}/{lastGameData?.possibleWordsCount || 0})
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No patterns found. Check that all guesses are valid and try again.
                            </Typography>
                        </CardContent>
                    }
                </Card>
            </Grid>

            {/* Suggested Guesses with Entropy */}
            {(guessesWithEntropy.length > 0) && (
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Suggested Guesses ({guessesWithEntropy.length}/{lastGameData?.guessesCount || guessesWithEntropy.length})
                                    </Typography>
                                    {onSuggestedGuessSelect && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Click a pattern to fill the guess form
                                        </Typography>
                                    )}
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
                                    <TableContainer
                                        component={Paper}
                                        variant="outlined"
                                        sx={{
                                            maxHeight: 300,
                                            overflowY: 'auto',
                                            bgcolor: 'background.default'
                                        }}
                                    >
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>Pattern</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>ENT</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {guessesWithEntropy.map((guess, index) => (
                                                    <TableRow
                                                        key={index}
                                                        hover
                                                        onClick={() => onSuggestedGuessSelect && onSuggestedGuessSelect(guess.word)}
                                                        sx={{
                                                            cursor: onSuggestedGuessSelect ? 'pointer' : 'default',
                                                            '&:hover': onSuggestedGuessSelect ? {
                                                                backgroundColor: 'action.hover'
                                                            } : {}
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                <DungleonPatternDisplay pattern={guess.word} />
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2">
                                                                {formatRoundedNum(guess.probability * 100)}%
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2">
                                                                {guess.entropy !== null ? formatRoundedNum(guess.entropy) : 'N/A'}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
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

const DungleonGame = forwardRef(({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }, ref) => {
    const [guesses, setGuesses] = useState([]);
    const [solutions, setSolutions] = useState([]);
    const [currentPattern, setCurrentPattern] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        maxDepth: 1,
        excludeImpossible: true
    });

    const settingsFields = [
        {
            name: 'maxDepth',
            label: 'Search Depth',
            type: 'select',
            options: [
                { value: 0, label: '0 (Fastest)' },
                { value: 1, label: '1 (Balanced)' },
                { value: 2, label: '2 (Deep)' }
            ]
        },
        {
            name: 'excludeImpossible',
            label: 'Exclude Impossible Patterns',
            type: 'checkbox'
        }
    ];

    const fillSuggestedGuess = useCallback((patternStr) => {
        const newPattern = patternStr.trim().split(/\s+/);
        if (newPattern.length === 5) {
            setCurrentPattern(newPattern);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        fillSuggestedGuess
    }), [fillSuggestedGuess]);

    const handleCharacterClick = useCallback((charId) => {
        if (currentPattern.length < 5) {
            setCurrentPattern([...currentPattern, charId]);
        }
    }, [currentPattern]);

    const handleBackspace = useCallback(() => {
        setCurrentPattern(prev => prev.slice(0, -1));
    }, []);

    const handleSlotClick = useCallback((index) => {
        setCurrentPattern(prev => prev.filter((_, i) => i !== index));
    }, []);

    const submitGuess = useCallback(() => {
        if (currentPattern.length !== 5) {
            showError('Please select exactly 5 characters');
            return;
        }

        const newGuess = {
            pattern: currentPattern.join(' '),
            patternArray: [...currentPattern],
            feedback: [0, 0, 0, 0, 0]
        };
        setGuesses([...guesses, newGuess]);
        setCurrentPattern([]);
    }, [currentPattern, guesses, showError]);

    const submitSolution = useCallback(() => {
        if (currentPattern.length !== 5) {
            showError('Please select exactly 5 characters');
            return;
        }

        const newSolution = {
            pattern: currentPattern.join(' '),
            patternArray: [...currentPattern]
        };
        setSolutions([...solutions, newSolution]);
        setCurrentPattern([]);
    }, [currentPattern, solutions, showError]);

    const removeGuess = useCallback((index) => {
        setGuesses(prev => prev.filter((_, i) => i !== index));
    }, []);

    const removeSolution = useCallback((index) => {
        setSolutions(prev => prev.filter((_, i) => i !== index));
    }, []);

    const toggleFeedback = useCallback((guessIndex, slotIndex) => {
        setGuesses(prev => {
            const newGuesses = [...prev];
            const guess = { ...newGuesses[guessIndex] };
            const newFeedback = [...guess.feedback];
            newFeedback[slotIndex] = (newFeedback[slotIndex] + 1) % 5;
            guess.feedback = newFeedback;
            newGuesses[guessIndex] = guess;
            return newGuesses;
        });
    }, []);

    const handleSolve = useCallback(async () => {
        if (guesses.length === 0 && solutions.length === 0) {
            showError('Please add at least one guess or past solution');
            return;
        }

        await onSolve('dungleon', {
            guesses: guesses.map(g => ({
                pattern: g.pattern,
                feedback: g.feedback.join('')
            })),
            solutions: solutions.map(s => ({
                pattern: s.pattern
            })),
            maxDepth: config.maxDepth,
            excludeImpossiblePatterns: config.excludeImpossible ? 1 : 0,
            start: 0,
            end: 100
        });
    }, [guesses, solutions, config, onSolve, showError]);

    const handleClear = useCallback(() => {
        setGuesses([]);
        setSolutions([]);
        setCurrentPattern([]);
        onClear();
    }, [onClear]);

    const getAssetPath = (charId) => {
        if (!charId) return null;
        const name = CHARACTER_MAP[charId]?.name?.toLowerCase().replace(' ', '_');
        return `/assets/dungleon/${name}.png`;
    };

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
                        Dungleon Solver
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Select characters, add guesses, and set feedback colors to solve
                    </Typography>
                </Box>

                <Grid container spacing={3} justifyContent="center">
                    <Grid size={{ xs: 12, md: 10 }}>
                        <Stack spacing={3}>
                            {/* Character Bank */}
                            <Box sx={{
                                p: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1,
                                justifyContent: 'center',
                                backgroundColor: 'action.hover'
                            }}>
                                {CHARACTERS.map((char) => (
                                    <Tooltip key={char.id} title={char.name}>
                                        <IconButton
                                            onClick={() => handleCharacterClick(char.id)}
                                            disabled={currentPattern.length >= 5}
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                backgroundColor: 'background.paper',
                                                p: 0.5,
                                                '&:hover': { backgroundColor: 'action.selected' }
                                            }}
                                        >
                                            <img
                                                src={getAssetPath(char.id)}
                                                alt={char.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                        </IconButton>
                                    </Tooltip>
                                ))}
                            </Box>

                            {/* Current Input */}
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1,
                                minHeight: 60
                            }}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Box
                                        key={i}
                                        onClick={() => handleSlotClick(i)}
                                        sx={{
                                            width: 50,
                                            height: 50,
                                            border: '2px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: currentPattern[i] ? 'pointer' : 'default',
                                            backgroundColor: currentPattern[i] ? 'background.paper' : 'action.disabledBackground'
                                        }}
                                    >
                                        {currentPattern[i] && (
                                            <img
                                                src={getAssetPath(currentPattern[i])}
                                                alt={currentPattern[i]}
                                                style={{ width: 40, height: 40, objectFit: 'contain' }}
                                            />
                                        )}
                                    </Box>
                                ))}
                                <IconButton
                                    onClick={handleBackspace}
                                    disabled={currentPattern.length === 0}
                                    color="error"
                                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                                >
                                    <BackspaceIcon />
                                </IconButton>
                            </Box>

                            {/* Submit Buttons - Separate like Qt UI */}
                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant="contained"
                                    onClick={submitGuess}
                                    disabled={currentPattern.length !== 5}
                                    fullWidth
                                    color="primary"
                                >
                                    Submit Guess
                                </Button>
                                <Tooltip title="Gauntlet Mode: Add past solutions to exclude">
                                    <Button
                                        variant="contained"
                                        onClick={submitSolution}
                                        disabled={currentPattern.length !== 5}
                                        fullWidth
                                        color="secondary"
                                    >
                                        Submit Solution
                                    </Button>
                                </Tooltip>
                            </Stack>

                            {/* Side-by-side Guesses and Solutions */}
                            <Grid container spacing={2}>
                                {/* Guesses Column */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        Guesses:
                                    </Typography>
                                    <Box sx={{
                                        maxHeight: 320,
                                        overflow: 'auto',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        minHeight: 100,
                                        backgroundColor: 'background.default'
                                    }}>
                                        {guesses.length > 0 ? (
                                            <Stack spacing={1}>
                                                {guesses.map((guess, guessIndex) => (
                                                    <Box key={guessIndex} sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5
                                                    }}>
                                                        {guess.patternArray.map((charId, slotIndex) => {
                                                            const feedbackState = guess.feedback[slotIndex];
                                                            const style = FEEDBACK_STYLES[feedbackState];
                                                            return (
                                                                <Box
                                                                    key={slotIndex}
                                                                    onClick={() => toggleFeedback(guessIndex, slotIndex)}
                                                                    sx={{
                                                                        width: 48,
                                                                        height: 48,
                                                                        border: '2px solid',
                                                                        borderColor: style.borderColor,
                                                                        backgroundColor: style.bgColor,
                                                                        borderRadius: 1,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        position: 'relative'
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={getAssetPath(charId)}
                                                                        alt={charId}
                                                                        style={{ width: 38, height: 38, objectFit: 'contain' }}
                                                                    />
                                                                    {style.badge && (
                                                                        <Box
                                                                            component="img"
                                                                            src="/assets/dungleon/plus.png"
                                                                            sx={{
                                                                                position: 'absolute',
                                                                                top: 2,
                                                                                right: 2,
                                                                                width: 14,
                                                                                height: 14
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Box>
                                                            );
                                                        })}
                                                        <IconButton
                                                            onClick={() => removeGuess(guessIndex)}
                                                            color="error"
                                                            size="small"
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                                No guesses yet
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>

                                {/* Solutions Column */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                                        Past Solutions:
                                    </Typography>
                                    <Box sx={{
                                        maxHeight: 320,
                                        overflow: 'auto',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        minHeight: 100,
                                        backgroundColor: 'background.default'
                                    }}>
                                        {solutions.length > 0 ? (
                                            <Stack spacing={1}>
                                                {solutions.map((sol, index) => (
                                                    <Box key={index} sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 0.5
                                                    }}>
                                                        {sol.patternArray.map((charId, slotIndex) => (
                                                            <Box
                                                                key={slotIndex}
                                                                sx={{
                                                                    width: 48,
                                                                    height: 48,
                                                                    border: '2px solid',
                                                                    borderColor: 'divider',
                                                                    backgroundColor: 'background.paper',
                                                                    borderRadius: 1,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}
                                                            >
                                                                <img
                                                                    src={getAssetPath(charId)}
                                                                    alt={charId}
                                                                    style={{ width: 38, height: 38, objectFit: 'contain' }}
                                                                />
                                                            </Box>
                                                        ))}
                                                        <IconButton
                                                            onClick={() => removeSolution(index)}
                                                            color="error"
                                                            size="small"
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                                No past solutions
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>
                            </Grid>

                            {/* Solve Button */}
                            <Button
                                variant="contained"
                                onClick={handleSolve}
                                disabled={isLoading || gameStatus?.status !== 'available' || (guesses.length === 0 && solutions.length === 0)}
                                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                fullWidth
                                size="large"
                            >
                                Solve
                            </Button>
                        </Stack>
                    </Grid>
                </Grid>

                {/* Settings Dialog */}
                <GameSettingsDialog
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    onSave={setConfig}
                    title="Dungleon Settings"
                    config={config}
                    fields={settingsFields}
                />

                {/* Results Component */}
                {results && (
                    <Box sx={{ mt: 3 }}>
                        <DungleonResults
                            possibleWords={results.possibleWords || []}
                            guessesWithEntropy={results.guessesWithEntropy || []}
                            lastGameData={results.gameData}
                            isLoading={isLoading}
                            onLoadMore={onLoadMore}
                            onCopyToClipboard={(text) => navigator.clipboard.writeText(text)}
                            onPossibleSolutionSelect={(pattern) => {
                                fillSuggestedGuess(pattern);
                            }}
                            onSuggestedGuessSelect={(pattern) => {
                                fillSuggestedGuess(pattern);
                            }}
                        />
                    </Box>
                )}
            </CardContent>
        </Card>
    );
});

DungleonGame.displayName = 'DungleonGame';

export default React.memo(DungleonGame);
