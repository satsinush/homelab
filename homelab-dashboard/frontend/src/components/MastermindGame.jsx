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
    Chip,
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
    Add as AddIcon,
    Close as CloseIcon,
    DragIndicator as DragIcon,
    KeyboardArrowUp as ArrowUpIcon,
    KeyboardArrowDown as ArrowDownIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import GameSettingsDialog from './GameSettingsDialog';

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

// Color characters for CLI (matches word_games CLI format)
const PEG_COLOR_CHARS = [
    'R', // Red - 0
    'G', // Green - 1
    'B', // Blue - 2
    'Y', // Yellow - 3
    'M', // Magenta - 4
    'C', // Cyan - 5
    'O', // Orange - 6
    'P', // Purple - 7
    'W', // White - 8
    'K'  // Black - 9
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

// Component to display mastermind pattern with colored pegs
const MastermindPatternDisplay = ({ pattern, size = 'small', colorMapping = null }) => {
    const pegSize = size === 'small' ? 20 : 25;
    const fontSize = size === 'small' ? '0.8rem' : '0.9rem';

    if (!pattern || typeof pattern !== 'string') {
        return <Typography variant="body2">-</Typography>;
    }

    // Determine if pattern is color characters (new format) or numeric indices (old format)
    const isColorCharFormat = /^[RGBYMCOPWK]+$/i.test(pattern.trim());

    let pegValues;
    if (isColorCharFormat) {
        // New format: "RGBY" - convert chars to indices
        pegValues = pattern.split('').map(char => {
            const index = PEG_COLOR_CHARS.indexOf(char.toUpperCase());
            return index !== -1 ? index : 0;
        });
    } else {
        // Old format: "0 1 2 3" - space-separated indices
        pegValues = pattern.split(' ').map(p => parseInt(p.trim(), 10));
    }

    return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {pegValues.map((colorIndex, index) => {
                // Map mastermind indices back to original color indices if colorMapping is provided
                const actualColorIndex = colorMapping?.mastermindToOriginal?.[colorIndex] ?? colorIndex;

                return (
                    <Tooltip key={index} title={`${PEG_COLOR_NAMES[actualColorIndex]} (${PEG_COLOR_CHARS[actualColorIndex]})`}>
                        <Box
                            sx={{
                                width: pegSize,
                                height: pegSize,
                                borderRadius: '50%',
                                backgroundColor: PEG_COLORS[actualColorIndex] || '#ccc',
                                border: '1px solid #333',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: PEG_TEXT_COLORS[actualColorIndex] || '#fff',
                                textShadow: `0px 0px 5px #000`,
                                fontSize: fontSize,
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                            }}
                        >
                            {PEG_COLOR_CHARS[actualColorIndex]}
                        </Box>
                    </Tooltip>
                );
            })}
        </Box>
    );
};

const MastermindResults = React.memo(({
    possiblePatterns, // Renamed from possibleWords
    guessesWithEntropy,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard,
    onPossibleSolutionSelect,
    onSuggestedGuessSelect
}) => {
    const copyPossiblePatterns = () => {
        const patternsText = possiblePatterns.join('\n');
        onCopyToClipboard(patternsText);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.pattern} - ${g.probability} - ${g.entropy}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const formatRoundedNum = (num) => {
        if (!num) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };


    const showPossible = possiblePatterns && possiblePatterns.length > 0;
    const showSuggestions = guessesWithEntropy && guessesWithEntropy.length > 0;

    if (!showPossible && !showSuggestions) return null;

    return (
        <Grid container spacing={3} sx={{ width: '100%' }}>
            {/* Possible Patterns */}
            {showPossible && (
                <Grid size={{ xs: 12, lg: showSuggestions ? 6 : 12 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Possible Patterns ({possiblePatterns.length}/{lastGameData?.possiblePatternsCount || possiblePatterns.length})
                                    </Typography>
                                    {onPossibleSolutionSelect && (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Click a pattern to fill the guess form
                                        </Typography>
                                    )}
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={copyPossiblePatterns}
                                    startIcon={<CopyIcon />}
                                >
                                    Copy
                                </Button>
                            </Box>

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
                                    {possiblePatterns.map((pattern, index) => (
                                        <Box
                                            key={index}
                                            onClick={() => onPossibleSolutionSelect ? onPossibleSolutionSelect(pattern) : onCopyToClipboard(pattern)}
                                            sx={{
                                                p: 1,
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'action.hover' },
                                                pl: 2
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <MastermindPatternDisplay
                                                    pattern={pattern}
                                                    size="medium"
                                                    colorMapping={lastGameData?.colorMapping}
                                                />
                                            </Box>
                                        </Box>
                                    ))}
                                </Stack>
                            </Box>
                            {lastGameData && lastGameData.isLimitedPossible && possiblePatterns.length < (lastGameData.possiblePatternsCount || 0) && (
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
                        </CardContent>
                    </Card>
                </Grid>
            )}

            {/* Suggested Guesses */}
            {showSuggestions && (
                <Grid size={{ xs: 12, lg: showPossible ? 6 : 12 }}>
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
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={copyGuesses}
                                    startIcon={<CopyIcon />}
                                >
                                    Copy
                                </Button>
                            </Box>
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
                                                onClick={() => onSuggestedGuessSelect && onSuggestedGuessSelect(guess.pattern)}
                                                sx={{
                                                    cursor: onSuggestedGuessSelect ? 'pointer' : 'default',
                                                    '&:hover': onSuggestedGuessSelect ? {
                                                        backgroundColor: 'action.hover'
                                                    } : {}
                                                }}
                                            >
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        <MastermindPatternDisplay
                                                            pattern={guess.pattern}
                                                            size="medium"
                                                            colorMapping={lastGameData?.colorMapping}
                                                        />
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
                        </CardContent>
                    </Card>
                </Grid>
            )}
        </Grid>
    );
});

const MastermindGame = forwardRef(({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }, ref) => {
    // State is now local to this component
    const [state, setState] = useState({
        guesses: [],
        currentPattern: Array(4).fill(null), // Default 4 pegs, use null for empty slots
        correctPosition: 0,
        correctColor: 0,
        numPegs: 4,
        allowDuplicates: 1,
        maxDepth: 0 // 0 = off (just get possible patterns), 1 = calculate best guesses
    });

    // Local state for enabled colors - start with first 6 colors enabled by default
    const [enabledColors, setEnabledColors] = useState(() => {
        const initial = {};
        for (let i = 0; i < 10; i++) {
            initial[i] = i < 6; // Enable first 6 colors by default
        }
        return initial;
    });
    const [settingsOpen, setSettingsOpen] = useState(false);

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

    const handleCopyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text);
    }, []);

    const fillPatternFromSelection = useCallback((pattern) => {
        if (!pattern) return;

        // Determine if pattern is color characters (new format) or numeric indices (old format)
        const isColorCharFormat = /^[RGBYMCOPWK]+$/i.test(pattern.trim());

        let newPattern;
        if (isColorCharFormat) {
            // New format: "RGBY" - convert chars to indices
            newPattern = pattern.split('').map(char => {
                const index = PEG_COLOR_CHARS.indexOf(char.toUpperCase());
                return index !== -1 ? index : null;
            });
        } else {
            // Old format: "0 1 2 3" - space-separated indices
            newPattern = pattern.split(' ').map(p => parseInt(p.trim(), 10));
        }

        setState(prev => ({
            ...prev,
            currentPattern: newPattern
        }));

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

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
            // Pattern comes as a string of color characters like "RGBY"
            // Convert each color char to original color index
            const originalPattern = pattern.split('').map(char => {
                const charIndex = PEG_COLOR_CHARS.indexOf(char.toUpperCase());
                return charIndex !== -1 ? charIndex : null;
            });

            // Fill the current pattern
            setState(prev => ({
                ...prev,
                currentPattern: originalPattern,
                correctPosition: 0,
                correctColor: 0
            }));
        }
    }), []);

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

    const updateGuessFeedback = useCallback((index, field, delta) => {
        setState(prev => {
            const guesses = [...(prev.guesses || [])];
            const guess = { ...guesses[index] };
            const newValue = Math.max(0, Math.min(prev.numPegs, guess[field] + delta));

            // Auto-adjust other field if total exceeds numPegs (same logic as add guess)
            const otherField = field === 'correctPosition' ? 'correctColor' : 'correctPosition';
            const currentTotal = newValue + guess[otherField];

            if (currentTotal > prev.numPegs) {
                // Reduce the other field to make room
                const adjustedOther = Math.max(0, prev.numPegs - newValue);
                guess[field] = newValue;
                guess[otherField] = adjustedOther;
            } else {
                guess[field] = newValue;
            }

            guess.feedback = `${guess.correctPosition} ${guess.correctColor}`;
            guesses[index] = guess;
            return { ...prev, guesses };
        });
    }, [setState]);

    const handleSolve = useCallback(async () => {
        if (!state.guesses || state.guesses.length === 0) {
            showError('Please add at least one guess with feedback');
            return;
        }

        // Build the colors string from enabled colors
        const enabledIndices = Object.keys(enabledColors)
            .filter(key => enabledColors[key])
            .map(key => parseInt(key, 10))
            .sort((a, b) => a - b);
        const colorsString = enabledIndices.map(idx => PEG_COLOR_CHARS[idx]).join('');

        // Format guesses for the API in new format: array of {pattern, black, white}
        const guesses = state.guesses.map(g => {
            // Convert the pattern from mastermind indices to color characters
            const patternParts = g.pattern.split(' ').map(idx => parseInt(idx, 10));
            // Map mastermind index back to original index, then to color char
            const patternChars = patternParts.map(mastermindIdx => {
                const originalIdx = colorMapping.mastermindToOriginal[mastermindIdx];
                return PEG_COLOR_CHARS[originalIdx];
            }).join('');

            return {
                pattern: patternChars,
                black: g.correctPosition,
                white: g.correctColor
            };
        });

        await onSolve('mastermind', {
            guesses: guesses.map(g => ({
                pattern: g.pattern,
                feedback: {
                    red: g.black,
                    white: g.white
                }
            })),
            pegs: state.numPegs,
            colors: colorsString,
            allowDuplicates: state.allowDuplicates,
            maxDepth: state.maxDepth,
            start: 0,
            end: 100,
            colorMapping: colorMapping // Pass the color mapping to results
        });
    }, [state.guesses, state.numPegs, state.allowDuplicates, state.maxDepth, colorMapping, enabledColors, onSolve, showError]);

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
        <>
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
                            Mastermind Solver
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Solve Mastermind puzzles by entering guesses and feedback
                        </Typography>
                    </Box>

                    <Grid container spacing={3} justifyContent="center">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Stack spacing={2}>

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
                                        {/* Inline Pattern + Feedback Row */}
                                        <Box sx={{
                                            display: 'flex',
                                            flexDirection: { xs: 'column', sm: 'row' },
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: { xs: 2, sm: 3 },
                                            p: 2,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            backgroundColor: 'action.hover'
                                        }}>
                                            {/* Pattern Input - inline slots */}
                                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                {Array.from({ length: state.numPegs }, (_, slotIndex) => {
                                                    const colorValue = state.currentPattern[slotIndex];
                                                    const hasColor = colorValue !== undefined && colorValue !== null;
                                                    return (
                                                        <Box
                                                            key={slotIndex}
                                                            onClick={() => handleSlotClick(slotIndex)}
                                                            sx={{
                                                                width: { xs: 35, sm: 40 },
                                                                height: { xs: 35, sm: 40 },
                                                                borderRadius: '50%',
                                                                backgroundColor: hasColor ? PEG_COLORS[colorValue] : 'transparent',
                                                                border: hasColor ? '2px solid #333' : '3px dashed #ccc',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: PEG_TEXT_COLORS[parseInt(colorValue, 10)] || '#fff',
                                                                textShadow: hasColor ? '0px 0px 5px #000' : 'none',
                                                                fontSize: { xs: '0.8rem', sm: '1.0rem' },
                                                                fontWeight: 'bold',
                                                                boxShadow: hasColor ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                                                                transition: 'all 0.2s ease',
                                                                '&:hover': { opacity: 0.8 }
                                                            }}
                                                        >
                                                            {hasColor ? colorValue : ''}
                                                        </Box>
                                                    );
                                                })}
                                            </Box>

                                            {/* Feedback Input - inline with pattern */}
                                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCorrectPositionChange(-1)}
                                                        disabled={state.correctPosition === 0}
                                                    >
                                                        <ArrowDownIcon fontSize="small" />
                                                    </IconButton>
                                                    <Typography variant="h6" sx={{ fontWeight: 'bold', minWidth: 30, textAlign: 'center' }}>
                                                        {state.correctPosition}⚫
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCorrectPositionChange(1)}
                                                        disabled={state.correctPosition >= state.numPegs}
                                                    >
                                                        <ArrowUpIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCorrectColorChange(-1)}
                                                        disabled={state.correctColor === 0}
                                                    >
                                                        <ArrowDownIcon fontSize="small" />
                                                    </IconButton>
                                                    <Typography variant="h6" sx={{ fontWeight: 'bold', minWidth: 30, textAlign: 'center' }}>
                                                        {state.correctColor}⚪
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCorrectColorChange(1)}
                                                        disabled={state.correctColor >= state.numPegs}
                                                    >
                                                        <ArrowUpIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Box>
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
                                                        justifyContent: 'center',
                                                        flexWrap: 'wrap'
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

                                                    {/* Feedback display - editable */}
                                                    <Box sx={{
                                                        display: 'flex',
                                                        flexDirection: { xs: 'column', sm: 'row' },
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flex: { xs: 'none', sm: 1 },
                                                        gap: 2
                                                    }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => updateGuessFeedback(index, 'correctPosition', -1)}
                                                                disabled={guess.correctPosition === 0}
                                                            >
                                                                <ArrowDownIcon fontSize="small" />
                                                            </IconButton>
                                                            <Typography variant="h6" sx={{ fontWeight: 'bold', minWidth: 30, textAlign: 'center' }}>
                                                                {guess.correctPosition}⚫
                                                            </Typography>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => updateGuessFeedback(index, 'correctPosition', 1)}
                                                                disabled={guess.correctPosition >= state.numPegs}
                                                            >
                                                                <ArrowUpIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => updateGuessFeedback(index, 'correctColor', -1)}
                                                                disabled={guess.correctColor === 0}
                                                            >
                                                                <ArrowDownIcon fontSize="small" />
                                                            </IconButton>
                                                            <Typography variant="h6" sx={{ fontWeight: 'bold', minWidth: 30, textAlign: 'center' }}>
                                                                {guess.correctColor}⚪
                                                            </Typography>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => updateGuessFeedback(index, 'correctColor', 1)}
                                                                disabled={guess.correctColor >= state.numPegs}
                                                            >
                                                                <ArrowUpIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    </Box>

                                                    {/* Remove button */}
                                                    <IconButton
                                                        onClick={() => removeMastermindGuess(index)}
                                                        size="small"
                                                        color="error"
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

                    {/* Settings Dialog */}
                    <GameSettingsDialog
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onSave={(config) => {
                            setState(prev => {
                                const numPegsChanged = config.numPegs !== prev.numPegs;
                                return {
                                    ...prev,
                                    numPegs: config.numPegs,
                                    allowDuplicates: config.allowDuplicates,
                                    maxDepth: config.maxDepth,
                                    // Clear if numPegs changed
                                    currentPattern: numPegsChanged ? Array(config.numPegs).fill(null) : prev.currentPattern,
                                    correctPosition: numPegsChanged ? 0 : prev.correctPosition,
                                    correctColor: numPegsChanged ? 0 : prev.correctColor,
                                    guesses: numPegsChanged ? [] : prev.guesses
                                };
                            });
                        }}
                        title="Mastermind Settings"
                        config={{
                            numPegs: state.numPegs,
                            allowDuplicates: state.allowDuplicates,
                            maxDepth: state.maxDepth
                        }}
                        fields={[
                            {
                                name: 'numPegs',
                                label: 'Number of Pegs',
                                type: 'number',
                                min: 1,
                                max: 10
                            },
                            {
                                name: 'allowDuplicates',
                                label: 'Allow Duplicates',
                                type: 'select',
                                options: [
                                    { value: 1, label: 'Yes' },
                                    { value: 0, label: 'No' }
                                ]
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
                            }
                        ]}
                    />

                </CardContent>
            </Card >

            {/* Results Component - Outside Card for full width */}
            {results && (
                <Box sx={{ mt: 3 }}>
                    <MastermindResults
                        possiblePatterns={results.possiblePatterns || []}
                        guessesWithEntropy={results.guessesWithEntropy || []}
                        lastGameData={results.gameData}
                        isLoading={isLoading}
                        onLoadMore={onLoadMore}
                        onCopyToClipboard={handleCopyToClipboard}
                        onPossibleSolutionSelect={fillPatternFromSelection}
                        onSuggestedGuessSelect={fillPatternFromSelection}
                    />
                </Box>
            )}
        </>
    );
});

MastermindGame.displayName = 'MastermindGame';

export default React.memo(MastermindGame);
