import React, { useCallback, useMemo, useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Grid,
    CircularProgress,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    IconButton,
    Switch,
    FormControlLabel,
    Tooltip,
    Chip
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Add as AddIcon,
    Close as CloseIcon,
    DragIndicator as DragIcon,
    KeyboardArrowUp as ArrowUpIcon,
    KeyboardArrowDown as ArrowDownIcon
} from '@mui/icons-material';

// Color palette for pegs (10 colors)
const PEG_COLORS = [
    '#df312b', // Red - 0
    '#5cda3c', // Green - 1
    '#1e65ff', // Blue - 2
    '#FFD700', // Yellow - 3
    '#e02f8e', // Magenta - 4
    '#40E0D0', // Cyan - 5
    '#FF8C00', // Orange - 6
    '#8A2BE2', // Purple - 7
    '#f1f1f1', // White - 8
    '#1d1d1d'  // Black - 9
];

const PEG_COLOR_NAMES = [
    'Red', 'Green', 'Blue', 'Yellow', 'Magenta',
    'Cyan', 'Orange', 'Purple', 'White', 'Black'
];

// Text colors for readability on each peg color
// const PEG_TEXT_COLORS = [
//     '#000000', // Black text on Red
//     '#000000', // White text on Green
//     '#FFFFFF', // White text on Blue
//     '#000000', // Black text on Yellow
//     '#000000', // White text on Magenta
//     '#000000', // Black text on Cyan
//     '#000000', // Black text on Orange
//     '#FFFFFF', // White text on Purple
//     '#000000', // Black text on White
//     '#FFFFFF'  // White text on Black
// ];
const PEG_TEXT_COLORS = [
    '#FFFFFF', // Red
    '#FFFFFF', // Green
    '#FFFFFF', // Blue
    '#FFFFFF', // Yellow
    '#FFFFFF', // Magenta
    '#FFFFFF', // Cyan
    '#FFFFFF', // Orange
    '#FFFFFF', // Purple
    '#FFFFFF', // White
    '#FFFFFF'  // Black
];

// Color Palette Component with click selection
const ColorPalette = ({ enabledColors, setEnabledColors, onColorSelect, colorMapping }) => {
    const handleColorToggle = (colorIndex) => {
        setEnabledColors(prev => ({
            ...prev,
            [colorIndex]: !prev[colorIndex]
        }));
    };

    const enabledCount = Object.values(enabledColors).filter(Boolean).length;

    return (
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Color Palette</Typography>
                <Chip
                    label={`${enabledCount} colors enabled`}
                    color={enabledCount >= 3 ? 'success' : 'warning'}
                    size="small"
                />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click a color to add it to the first open slot
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 }, justifyContent: 'center' }}>
                {Array.from({ length: 10 }, (_, colorIndex) => (
                    <Box key={colorIndex} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={enabledColors[colorIndex] || false}
                                    onChange={() => handleColorToggle(colorIndex)}
                                    size="small"
                                />
                            }
                            label=""
                            sx={{ m: 0 }}
                        />
                        <Box
                            onClick={() => enabledColors[colorIndex] && onColorSelect(colorIndex)}
                            sx={{
                                width: { xs: 40, sm: 45 },
                                height: { xs: 40, sm: 45 },
                                borderRadius: '50%',
                                backgroundColor: PEG_COLORS[colorIndex],
                                border: `0px solid ${enabledColors[colorIndex] ? '#aaa' : '#aaa'}`,
                                cursor: enabledColors[colorIndex] ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: PEG_TEXT_COLORS[colorIndex] || '#fff',
                                textShadow: `0px 0px 5px #000`,
                                fontSize: { xs: '0.9rem', sm: '1.0rem' },
                                fontWeight: 'bold',
                                opacity: enabledColors[colorIndex] ? 1 : 0.4,
                                transition: 'all 0.2s ease',
                                userSelect: 'none',
                                '&:hover': {
                                    transform: enabledColors[colorIndex] ? 'scale(1.1)' : 'none',
                                    border: `${enabledColors[colorIndex] ? '3px solid #fff' : '0px solid #fff'}`
                                }
                            }}
                            title={enabledColors[colorIndex] ? `Click ${PEG_COLOR_NAMES[colorIndex]} to add (${colorMapping.originalToMastermind[colorIndex] ?? colorIndex})` : `${PEG_COLOR_NAMES[colorIndex]} disabled`}
                        >
                            {enabledColors[colorIndex] ? (colorMapping.originalToMastermind[colorIndex] ?? colorIndex) : null}
                        </Box>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', textAlign: 'center' }}>
                            {PEG_COLOR_NAMES[colorIndex]}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

// Pattern Slots Component with click selection
const PatternSlots = ({ pattern, numPegs, onSlotClick, colorMapping }) => {
    return (
        <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
                Pattern Slots (click to remove color):
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, justifyContent: 'center', flexWrap: 'wrap' }}>
                {Array.from({ length: numPegs }, (_, slotIndex) => {
                    const colorValue = pattern[slotIndex];
                    const hasColor = colorValue !== undefined && colorValue !== null;

                    return (
                        <Box key={slotIndex} sx={{ textAlign: 'center' }}>
                            <Box
                                onClick={() => onSlotClick(slotIndex)}
                                sx={{
                                    width: { xs: 45, sm: 50 },
                                    height: { xs: 45, sm: 50 },
                                    borderRadius: '50%',
                                    backgroundColor: hasColor ? PEG_COLORS[colorValue] : 'transparent',
                                    border: hasColor ? '0px solid #aaa' : '3px dashed #ccc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: PEG_TEXT_COLORS[parseInt(colorValue, 10)] || '#fff',
                                    textShadow: `0px 0px 5px #000`,
                                    fontSize: { xs: '0.9rem', sm: '1.0rem' },
                                    fontWeight: 'bold',
                                    mb: 1,
                                    userSelect: 'none',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        transform: 'scale(1.05)',
                                        border: hasColor ? '3px solid #ccc' : '3px dashed #999'
                                    }
                                }}
                                title={hasColor ? `${PEG_COLOR_NAMES[colorValue]} - Click to remove` : `Empty slot ${slotIndex + 1}`}
                            >
                                {hasColor ? (colorMapping.originalToMastermind[colorValue] ?? colorValue) : ""}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

const MastermindGame = forwardRef(({ gameStatus, isLoading, onSolve, onClear, showError }, ref) => {
    // State is now local to this component
    const [state, setState] = useState({
        guesses: [],
        currentPattern: Array(4).fill(null), // Default 4 pegs, use null for empty slots
        correctPosition: 0,
        correctColor: 0,
        numPegs: 4,
        allowDuplicates: 1
    });
    // Local state for enabled colors - start with first 6 colors enabled by default
    const [enabledColors, setEnabledColors] = useState(() => {
        const initial = {};
        for (let i = 0; i < 10; i++) {
            initial[i] = i < 6; // Enable first 6 colors by default
        }
        return initial;
    });

    // Clear function to reset local state
    const handleLocalClear = useCallback(() => {
        setState({
            guesses: [],
            currentPattern: Array(state.numPegs).fill(null),
            correctPosition: 0,
            correctColor: 0,
            numPegs: state.numPegs,
            allowDuplicates: state.allowDuplicates
        });
        onClear(); // Call parent clear function for results
    }, [onClear, state.numPegs, state.allowDuplicates]);

    // Refs to track previous values for optimization
    const prevEnabledColorsRef = useRef(JSON.stringify(enabledColors));
    const prevNumPegsRef = useRef(state.numPegs);

    // Calculate number of colors based on enabled toggles
    const numColors = useMemo(() => {
        return Object.values(enabledColors).filter(Boolean).length;
    }, [enabledColors]);

    // Create mapping between original color indices and mastermind indices (0 to numColors-1)
    const colorMapping = useMemo(() => {
        const enabledIndices = Object.keys(enabledColors)
            .filter(key => enabledColors[key])
            .map(key => parseInt(key, 10))
            .sort((a, b) => a - b);

        const originalToMastermind = {};
        const mastermindToOriginal = {};

        enabledIndices.forEach((originalIndex, mastermindIndex) => {
            originalToMastermind[originalIndex] = mastermindIndex;
            mastermindToOriginal[mastermindIndex] = originalIndex;
        });

        return { originalToMastermind, mastermindToOriginal };
    }, [enabledColors]);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
        fillSuggestedGuess: (pattern) => {
            // Convert pattern from mastermind indices to original color indices
            const originalPattern = pattern.split(' ').map(color => {
                const mastermindIndex = parseInt(color, 10);
                return colorMapping.mastermindToOriginal[mastermindIndex] ?? mastermindIndex;
            });

            // Fill the current pattern
            setState(prev => ({
                ...prev,
                currentPattern: originalPattern,
                correctPosition: 0,
                correctColor: 0
            }));
        }
    }), [colorMapping]);

    // Clear game when colors or number of pegs changes - simplified approach
    useEffect(() => {
        const currentEnabledColors = JSON.stringify(enabledColors);
        const currentNumPegs = state.numPegs;

        // Check if colors or pegs actually changed
        if (currentEnabledColors !== prevEnabledColorsRef.current || currentNumPegs !== prevNumPegsRef.current) {
            // Clear results when configuration changes
            if (state.guesses && state.guesses.length > 0) {
                onClear(); // Clear parent results
            }

            // Update refs
            prevEnabledColorsRef.current = currentEnabledColors;
            prevNumPegsRef.current = currentNumPegs;
        }
    }); // No dependencies - runs after every render but only acts when needed

    // Clear local state when colors change
    useEffect(() => {
        setState(prev => ({
            ...prev,
            guesses: [], // Clear guesses when colors change since they may reference disabled colors
            currentPattern: Array(prev.numPegs).fill(null),
            correctPosition: 0,
            correctColor: 0
        }));
    }, [JSON.stringify(enabledColors)]);

    const handleColorSelect = useCallback((colorIndex) => {
        if (!enabledColors[colorIndex]) return;

        // Find first open slot and place the color there
        const currentPattern = state.currentPattern || Array(state.numPegs).fill(null);
        const firstEmptySlot = currentPattern.findIndex(slot => slot === null);

        if (firstEmptySlot !== -1) {
            const newPattern = [...currentPattern];
            newPattern[firstEmptySlot] = colorIndex;
            setState(prev => ({
                ...prev,
                currentPattern: newPattern
            }));
        }
    }, [enabledColors, state.currentPattern, state.numPegs]);

    const handleSlotClick = useCallback((slotIndex) => {
        // Click on a slot to remove the color from it
        const currentPattern = state.currentPattern || Array(state.numPegs).fill(null);
        const newPattern = [...currentPattern];
        newPattern[slotIndex] = null;
        setState(prev => ({
            ...prev,
            currentPattern: newPattern
        }));
    }, [state.currentPattern, state.numPegs]);
    const handlePatternChange = useCallback((index, color) => {
        const currentPattern = state.currentPattern || Array(state.numPegs).fill(0);
        const newPattern = [...currentPattern];
        newPattern[index] = color;
        setState(prev => ({
            ...prev,
            currentPattern: newPattern
        }));
    }, [state.currentPattern, state.numPegs, setState]);

    const handleCorrectPositionChange = useCallback((delta) => {
        setState(prev => {
            const newValue = Math.max(0, Math.min(prev.numPegs, prev.correctPosition + delta));
            const maxTotal = prev.numPegs;
            const currentTotal = newValue + prev.correctColor;

            if (currentTotal > maxTotal) {
                // If adding would exceed total, reduce the other value
                const adjustedCorrectColor = Math.max(0, maxTotal - newValue);
                return {
                    ...prev,
                    correctPosition: newValue,
                    correctColor: adjustedCorrectColor
                };
            }

            return {
                ...prev,
                correctPosition: newValue
            };
        });
    }, [setState]);

    const handleCorrectColorChange = useCallback((delta) => {
        setState(prev => {
            const newValue = Math.max(0, Math.min(prev.numPegs, prev.correctColor + delta));
            const maxTotal = prev.numPegs;
            const currentTotal = prev.correctPosition + newValue;

            if (currentTotal > maxTotal) {
                // If adding would exceed total, reduce the other value
                const adjustedCorrectPosition = Math.max(0, maxTotal - newValue);
                return {
                    ...prev,
                    correctPosition: adjustedCorrectPosition,
                    correctColor: newValue
                };
            }

            return {
                ...prev,
                correctColor: newValue
            };
        });
    }, [setState]);

    const handleNumPegsChange = useCallback((e) => {
        const newNumPegs = parseInt(e.target.value, 10);
        setState(prev => ({
            ...prev,
            numPegs: newNumPegs,
            currentPattern: Array(newNumPegs).fill(null),
            correctPosition: 0,
            correctColor: 0,
            guesses: [], // Clear guesses when changing pegs
            solutions: [], // Clear solutions when changing pegs
            possibleWords: [] // Clear possible words when changing pegs
        }));
    }, [setState]);

    const handleAllowDuplicatesChange = useCallback((e) => {
        setState(prev => ({
            ...prev,
            allowDuplicates: e.target.value
        }));
    }, [setState]);

    const addMastermindGuess = useCallback(() => {
        setState(prev => {
            // Validate pattern - check for null values
            if (!prev.currentPattern || prev.currentPattern.length !== prev.numPegs || prev.currentPattern.some(p => p === null || p === undefined)) {
                showError('Please set all peg colors');
                return prev;
            }

            // Validate feedback
            if (prev.correctPosition + prev.correctColor > prev.numPegs) {
                showError('Total feedback cannot exceed number of pegs');
                return prev;
            }

            // Convert original color indices to mastermind indices (0 to numColors-1)
            const mastermindPattern = prev.currentPattern.map(originalIndex =>
                colorMapping.originalToMastermind[originalIndex]
            );

            const pattern = mastermindPattern.join(' ');
            const feedback = `${prev.correctPosition} ${prev.correctColor}`;
            const newGuess = {
                pattern: pattern,
                feedback: feedback,
                correctPosition: prev.correctPosition,
                correctColor: prev.correctColor,
                displayPattern: prev.currentPattern.join(' ') // Keep original indices for display
            };

            return {
                ...prev,
                guesses: [...(prev.guesses || []), newGuess],
                currentPattern: Array(prev.numPegs).fill(null),
                correctPosition: 0,
                correctColor: 0
            };
        });
    }, [colorMapping.originalToMastermind, showError, setState]);

    const removeMastermindGuess = useCallback((index) => {
        setState(prev => ({
            ...prev,
            guesses: (prev.guesses || []).filter((_, i) => i !== index)
        }));
    }, [setState]);

    const handleSolve = useCallback(async () => {
        if (!state.guesses || state.guesses.length === 0) {
            showError('Please add at least one guess with feedback');
            return;
        }

        // Format guesses for the API
        const guessString = state.guesses.map(g => `${g.pattern}|${g.feedback}`).join(',');

        await onSolve('mastermind', {
            guess: guessString,
            numPegs: state.numPegs,
            numColors: numColors,
            allowDuplicates: state.allowDuplicates,
            maxDepth: 0, // Only allow depth 0 for mastermind
            start: 0,
            end: 100,
            colorMapping: colorMapping // Pass the color mapping to results
        });
    }, [state.guesses, state.numPegs, numColors, state.allowDuplicates, colorMapping, onSolve, showError]);

    const handleClear = useCallback(() => {
        setState(prev => ({
            ...prev,
            guesses: [],
            currentPattern: Array(prev.numPegs).fill(null),
            correctPosition: 0,
            correctColor: 0
        }));
        onClear();
    }, [setState, onClear]);

    return (
        <Card>
            <CardContent>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                        Mastermind
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Solve Mastermind puzzles by entering guesses and feedback
                    </Typography>
                </Box>

                <Grid container spacing={3} justifyContent="center">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={2}>
                            {/* Game Settings */}
                            <Grid container spacing={2}>
                                <Grid size={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Number of Pegs</InputLabel>
                                        <Select
                                            value={state.numPegs}
                                            label="Number of Pegs"
                                            onChange={handleNumPegsChange}
                                        >
                                            {[3, 4, 5, 6].map(num => (
                                                <MenuItem key={num} value={num}>{num}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Allow Duplicates</InputLabel>
                                        <Select
                                            value={state.allowDuplicates}
                                            label="Allow Duplicates"
                                            onChange={handleAllowDuplicatesChange}
                                        >
                                            <MenuItem value={1}>Yes</MenuItem>
                                            <MenuItem value={0}>No</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>

                            {/* Color Palette */}
                            <ColorPalette
                                enabledColors={enabledColors}
                                setEnabledColors={setEnabledColors}
                                onColorSelect={handleColorSelect}
                                colorMapping={colorMapping}
                            />

                            {/* Add Guess */}
                            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>Add Guess</Typography>
                                <Stack spacing={2}>
                                    {/* Pattern Input */}
                                    <PatternSlots
                                        pattern={state.currentPattern || Array(state.numPegs).fill(null)}
                                        numPegs={state.numPegs}
                                        onSlotClick={handleSlotClick}
                                        colorMapping={colorMapping}
                                    />

                                    {/* Feedback Input */}
                                    <Box sx={{ mt: 4 }}>
                                        <Typography variant="body2" sx={{ mb: 2 }}>
                                            Feedback for this guess:
                                        </Typography>
                                        <Grid container spacing={3}>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexDirection: 'column',
                                                    gap: 1,
                                                    p: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 1
                                                }}>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        Correct Color + Position
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <IconButton
                                                            onClick={() => handleCorrectPositionChange(-1)}
                                                            disabled={state.correctPosition === 0}
                                                            size="small"
                                                        >
                                                            <ArrowDownIcon />
                                                        </IconButton>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                            minWidth: 60,
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                                {state.correctPosition}
                                                            </Typography>
                                                            <Typography variant="h6">
                                                                ⚫
                                                            </Typography>
                                                        </Box>
                                                        <IconButton
                                                            onClick={() => handleCorrectPositionChange(1)}
                                                            disabled={state.correctPosition >= state.numPegs}
                                                            size="small"
                                                        >
                                                            <ArrowUpIcon />
                                                        </IconButton>
                                                    </Box>
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexDirection: 'column',
                                                    gap: 1,
                                                    p: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    borderRadius: 1
                                                }}>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        Correct Color
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <IconButton
                                                            onClick={() => handleCorrectColorChange(-1)}
                                                            disabled={state.correctColor === 0}
                                                            size="small"
                                                        >
                                                            <ArrowDownIcon />
                                                        </IconButton>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                            minWidth: 60,
                                                            justifyContent: 'center'
                                                        }}>
                                                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                                                {state.correctColor}
                                                            </Typography>
                                                            <Typography variant="h6">
                                                                ⚪
                                                            </Typography>
                                                        </Box>
                                                        <IconButton
                                                            onClick={() => handleCorrectColorChange(1)}
                                                            disabled={state.correctColor >= state.numPegs}
                                                            size="small"
                                                        >
                                                            <ArrowUpIcon />
                                                        </IconButton>
                                                    </Box>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    </Box>

                                    <Button
                                        variant="contained"
                                        onClick={addMastermindGuess}
                                        disabled={!state.currentPattern || state.currentPattern.some(c => c === null || c === undefined)}
                                        startIcon={<AddIcon />}
                                        size="large"
                                        fullWidth
                                    >
                                        Add Guess
                                    </Button>
                                </Stack>
                            </Box>

                            {/* Current Guesses */}
                            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="h6" sx={{ mb: 2 }}>
                                    Current Guesses ({state.guesses ? state.guesses.length : 0})
                                </Typography>
                                {state.guesses && state.guesses.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {state.guesses.map((guess, index) => (
                                            <Box key={index} sx={{
                                                display: 'flex',
                                                flexDirection: { xs: 'column', sm: 'row' },
                                                alignItems: { xs: 'center', sm: 'center' },
                                                justifyContent: { xs: 'center', sm: 'space-between' },
                                                gap: { xs: 1.5, sm: 2 },
                                                p: { xs: 2, sm: 2 },
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                position: 'relative'
                                            }}>
                                                {/* Pattern display */}
                                                <Box sx={{
                                                    display: 'flex',
                                                    gap: { xs: 0.5, sm: 0.5 },
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {(guess.displayPattern || guess.pattern).split(' ').map((color, pegIndex) => (
                                                        <Tooltip key={pegIndex} title={`${PEG_COLOR_NAMES[parseInt(color, 10)]} (${color})`}>
                                                            <Box
                                                                sx={{
                                                                    width: { xs: 30, sm: 35 },
                                                                    height: { xs: 30, sm: 35 },
                                                                    borderRadius: '50%',
                                                                    backgroundColor: PEG_COLORS[parseInt(color, 10)],
                                                                    border: '2px solid #333',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: PEG_TEXT_COLORS[parseInt(color, 10)] || '#fff',
                                                                    textShadow: `0px 0px 5px #000`,
                                                                    fontSize: { xs: '0.8rem', sm: '1.0rem' },
                                                                    fontWeight: 'bold',
                                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                                }}
                                                            >
                                                                {color}
                                                            </Box>
                                                        </Tooltip>
                                                    ))}
                                                </Box>

                                                {/* Feedback display */}
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flex: { xs: 'none', sm: 1 }
                                                }}>
                                                    <Typography
                                                        variant="h6"
                                                        sx={{
                                                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                                                            fontWeight: 'bold',
                                                            color: 'text.primary',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        {guess.correctPosition}⚫ {guess.correctColor}⚪
                                                    </Typography>
                                                </Box>

                                                {/* Remove button */}
                                                <IconButton
                                                    onClick={() => removeMastermindGuess(index)}
                                                    size="small"
                                                    color="error"
                                                    sx={{
                                                        position: { xs: 'absolute', sm: 'static' },
                                                        top: { xs: 8, sm: 'auto' },
                                                        right: { xs: 8, sm: 'auto' }
                                                    }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        No guesses added yet. Add a guess above to see it here.
                                    </Typography>
                                )}
                            </Box>

                            {/* Action Buttons */}
                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant="contained"
                                    onClick={handleSolve}
                                    disabled={isLoading || gameStatus?.status !== 'available' || !state.guesses || state.guesses.length === 0}
                                    startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                    fullWidth
                                    size="large"
                                    color="primary"
                                >
                                    Solve Mastermind
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
});

MastermindGame.displayName = 'MastermindGame';

export default React.memo(MastermindGame);
