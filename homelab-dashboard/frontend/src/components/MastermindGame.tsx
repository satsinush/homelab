import React, { useCallback, useMemo, useState, forwardRef, useImperativeHandle, useEffect } from 'react';
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Divider,
    Tabs,
    Tab,
    FormControlLabel,
    Checkbox
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Add as AddIcon,
    Close as CloseIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon,
    ArrowBack as BackspaceIcon
} from '@mui/icons-material';
import GameSettingsDialog, { FieldDefinition, DialogConfig } from './GameSettingsDialog';
import { MastermindResultState, GameStatus } from '../types/api';

// Color palette for pegs (11 colors)
const PEG_COLORS = [
    '#df312b', // Red - 0
    '#5cda3c', // Green - 1
    '#1e65ff', // Blue - 2
    '#ffd700', // Yellow - 3
    '#e02f8e', // Magenta - 4
    '#40e0d0', // Cyan - 5
    '#ff8c00', // Orange - 6
    '#8a2be2', // Purple - 7
    '#f1f1f1', // White - 8
    '#1d1d1d', // Black - 9
    '#533519ff'  // Brown - 10
];

const PEG_COLOR_NAMES = [
    'Red', 'Green', 'Blue', 'Yellow', 'Magenta',
    'Cyan', 'Orange', 'Purple', 'White', 'Black', 'Brown'
];

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
    'K', // Black - 9
    'N'  // Brown - 10
];

const PEG_TEXT_COLORS = [
    '#FFFFFF', // Red
    '#FFFFFF', // Green
    '#FFFFFF', // Blue
    '#FFFFFF', // Yellow
    '#FFFFFF', // Magenta
    '#FFFFFF', // Cyan
    '#FFFFFF', // Orange
    '#FFFFFF', // Purple
    '#000000', // White
    '#FFFFFF', // Black
    '#FFFFFF'  // Brown
];

interface MastermindGuess {
    pattern: string;
    feedback: string;
    correctPosition: number;
    correctColor: number;
    colors: (number | null)[];
    displayPattern?: string;
}

interface ColorMapping {
    originalToMastermind: Record<number, number>;
    mastermindToOriginal: Record<number, number>;
}

interface MastermindPatternDisplayProps {
    pattern: string;
    size?: 'small' | 'large';
    colorMapping?: ColorMapping | null;
}

const MastermindPatternDisplay = ({ pattern, size = 'small', colorMapping = null }: MastermindPatternDisplayProps) => {
    const isSmall = size === 'small';
    const pegSize = isSmall ? 30 : 45;
    const fontSize = isSmall ? '0.9rem' : '1.2rem';

    // Parse the pattern. It can be space-separated numbers (e.g. "0 1 2") or character string (e.g. "RGB")
    const parts = pattern.trim().split(/\s+/);
    const isNumeric = parts.every(p => !isNaN(parseInt(p, 10)));

    let colorIndices: number[] = [];

    if (isNumeric && pattern.trim()) {
        colorIndices = parts.map(p => parseInt(p, 10));
    } else {
        const chars = pattern.toUpperCase().replace(/\s+/g, '').split('');
        colorIndices = chars.map(char => {
            const idx = PEG_COLOR_CHARS.indexOf(char);
            return idx !== -1 ? idx : 0;
        });
    }

    return (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
            {colorIndices.map((colorIndex, index) => {
                let actualColorIndex = colorIndex;

                if (colorMapping && colorMapping.mastermindToOriginal) {
                    actualColorIndex = colorMapping.mastermindToOriginal[colorIndex] ?? colorIndex;
                }

                return (
                    <Tooltip key={index} title={PEG_COLOR_NAMES[actualColorIndex] || 'Unknown'}>
                        <Box
                            sx={{
                                width: pegSize,
                                height: pegSize,
                                borderRadius: '50%',
                                backgroundColor: PEG_COLORS[actualColorIndex] || '#ccc',
                                color: PEG_TEXT_COLORS[actualColorIndex] || '#000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: fontSize,
                                border: '2px solid',
                                borderColor: 'divider',
                                boxShadow: 1,
                                userSelect: 'none'
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

interface MastermindResultsProps {
    possiblePatterns: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    lastGameData: MastermindResultState['gameData'];
    isLoading: boolean;
    onLoadMore: (type: string) => void;
    onCopyToClipboard: (text: string) => void;
    onPossibleSolutionSelect: (pattern: string) => void;
    onSuggestedGuessSelect: (pattern: string) => void;
}

const MastermindResults = React.memo(({
    possiblePatterns,
    guessesWithEntropy,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard,
    onPossibleSolutionSelect,
    onSuggestedGuessSelect
}: MastermindResultsProps) => {
    const [tabVal, setTabVal] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabVal(newValue);
    };

    const copyPossiblePatterns = () => {
        const patternsText = possiblePatterns.join('\n');
        onCopyToClipboard(patternsText);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.pattern} - ${g.probability} - ${g.entropy}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const formatRoundedNum = (num: number) => {
        if (num === 0) return '0.0';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    const showPossible = possiblePatterns && possiblePatterns.length > 0;
    const showSuggestions = guessesWithEntropy && guessesWithEntropy.length > 0;

    if (!showPossible && !showSuggestions && !lastGameData) return null;

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <Tabs value={tabVal} onChange={handleTabChange} aria-label="mastermind results tabs">
                    <Tab label={`Suggested Guesses (${guessesWithEntropy.length}/${lastGameData?.guessesCount || guessesWithEntropy.length})`} />
                    <Tab label={`Possible Patterns (${possiblePatterns.length}/${lastGameData?.possibleCount || possiblePatterns.length})`} />
                </Tabs>
                {tabVal === 0 && showSuggestions && (
                    <Button variant="outlined" size="small" onClick={copyGuesses} startIcon={<CopyIcon />}>Copy</Button>
                )}
                {tabVal === 1 && showPossible && (
                    <Button variant="outlined" size="small" onClick={copyPossiblePatterns} startIcon={<CopyIcon />}>Copy</Button>
                )}
            </Box>
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {tabVal === 0 && (
                    showSuggestions ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer>
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
                                                    onClick={() => onSuggestedGuessSelect(guess.pattern)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <MastermindPatternDisplay
                                                                pattern={guess.pattern}
                                                                size="small"
                                                                colorMapping={lastGameData?.colorMapping}
                                                            />
                                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 1 }}>
                                                                {guess.pattern}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                    </TableCell>
                                                     <TableCell align="right">
                                                         {guess.entropy !== null && guess.entropy !== undefined && !isNaN(Number(guess.entropy)) ? formatRoundedNum(Number(guess.entropy)) : '-'}
                                                     </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                            {lastGameData?.isLimitedGuesses && guessesWithEntropy.length < (lastGameData.guessesCount || 0) && (
                                <Button variant="contained" onClick={() => onLoadMore('guesses')} disabled={isLoading} sx={{ mt: 2, alignSelf: 'flex-start' }} size="small">
                                    Load More
                                </Button>
                            )}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No suggested guesses available.
                        </Typography>
                    )
                )}
                {tabVal === 1 && (
                    showPossible ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Pattern</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ENT</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {possiblePatterns.map((guess, index) => (
                                                <TableRow
                                                    key={index}
                                                    hover
                                                    onClick={() => onPossibleSolutionSelect(guess.pattern)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <MastermindPatternDisplay
                                                                pattern={guess.pattern}
                                                                size="small"
                                                                colorMapping={lastGameData?.colorMapping}
                                                            />
                                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 1 }}>
                                                                {guess.pattern}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.entropy !== null && guess.entropy !== undefined && !isNaN(Number(guess.entropy)) ? formatRoundedNum(Number(guess.entropy)) : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                            {lastGameData?.isLimitedPossible && possiblePatterns.length < (lastGameData.possibleCount || 0) && (
                                <Button variant="contained" onClick={() => onLoadMore('possible')} disabled={isLoading} sx={{ mt: 2, alignSelf: 'flex-start' }} size="small">
                                    Load More
                                </Button>
                            )}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No possible patterns found.
                        </Typography>
                    )
                )}
            </CardContent>
        </Card>
    );
});

MastermindResults.displayName = 'MastermindResults';

interface ColorSelectorProps {
    enabledColors: Record<number, boolean>;
    setEnabledColors: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
    onColorSelect: (colorIndex: number) => void;
    colorMapping: ColorMapping;
}

const ColorSelector = ({ enabledColors, setEnabledColors, onColorSelect, colorMapping }: ColorSelectorProps) => {
    const handleToggleColor = (colorIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setEnabledColors(prev => {
            const next = { ...prev, [colorIndex]: !prev[colorIndex] };
            const enabledCount = Object.values(next).filter(Boolean).length;
            if (enabledCount === 0) {
                return prev; // must enable at least one color
            }
            return next;
        });
    };

    return (
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Enabled Colors</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Toggle colors to enable/disable. Click a color to use it for the current guess.
            </Typography>
            <Grid container spacing={1}>
                {PEG_COLORS.map((color, index) => {
                    const isEnabled = enabledColors[index];
                    const mastermindIdx = colorMapping.originalToMastermind[index];

                    return (
                        <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={index}>
                            <Box
                                onClick={() => isEnabled && onColorSelect(index)}
                                sx={{
                                    p: 1,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: isEnabled ? 'divider' : 'transparent',
                                    backgroundColor: isEnabled ? 'action.selected' : 'action.disabledBackground',
                                    cursor: isEnabled ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1,
                                    position: 'relative',
                                    opacity: isEnabled ? 1 : 0.5,
                                    '&:hover': {
                                        backgroundColor: isEnabled ? 'action.hover' : 'action.disabledBackground'
                                    }
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        backgroundColor: color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 'bold',
                                        color: PEG_TEXT_COLORS[index],
                                        boxShadow: 1
                                    }}
                                >
                                    {PEG_COLOR_CHARS[index]}
                                </Box>
                                <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontSize: '0.75rem' }}>
                                    {PEG_COLOR_NAMES[index]}
                                </Typography>
                                {isEnabled && mastermindIdx !== undefined && (
                                    <Chip
                                        label={`#${mastermindIdx}`}
                                        size="small"
                                        color="primary"
                                        sx={{
                                            position: 'absolute',
                                            top: -5,
                                            right: -5,
                                            height: 16,
                                            fontSize: '0.65rem',
                                            '.MuiChip-label': { px: 0.5 }
                                        }}
                                    />
                                )}
                                <Button
                                    size="small"
                                    onClick={(e) => handleToggleColor(index, e)}
                                    color={isEnabled ? "error" : "success"}
                                    sx={{ minWidth: 0, px: 1, py: 0, fontSize: '0.65rem', mt: 0.5 }}
                                >
                                    {isEnabled ? 'Disable' : 'Enable'}
                                </Button>
                            </Box>
                        </Grid>
                    );
                })}
            </Grid>
        </Box>
    );
};

interface MastermindGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: MastermindResultState | null;
    onLoadMore: (type: string) => void;
}

export interface MastermindGameRef {
    fillSuggestedGuess: (pattern: string) => void;
}

const MastermindGame = forwardRef<MastermindGameRef, MastermindGameProps>(({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }, ref) => {
    const [state, setState] = useState({
        guesses: [] as MastermindGuess[],
        currentPattern: Array(4).fill(null) as (number | null)[],
        correctPosition: 0,
        correctColor: 0,
        numPegs: 4,
        allowDuplicates: 1,
        maxDepth: 0
    });

    const [enabledColors, setEnabledColors] = useState<Record<number, boolean>>(() => {
        const initial: Record<number, boolean> = {};
        for (let i = 0; i < 11; i++) {
            initial[i] = i < 6;
        }
        return initial;
    });

    const [settingsOpen, setSettingsOpen] = useState(false);

    const [tempEnabledColors, setTempEnabledColors] = useState<Record<number, boolean>>(enabledColors);

    useEffect(() => {
        if (settingsOpen) {
            setTempEnabledColors(enabledColors);
        }
    }, [settingsOpen, enabledColors]);

    const handleLocalClear = useCallback(() => {
        setState(prev => ({
            ...prev,
            guesses: [],
            currentPattern: Array(prev.numPegs).fill(null),
            correctPosition: 0,
            correctColor: 0
        }));
        onClear();
    }, [onClear]);

    const handleCopyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const colorMapping = useMemo<ColorMapping>(() => {
        const enabledIndices = Object.keys(enabledColors)
            .map(key => parseInt(key, 10))
            .filter(key => enabledColors[key])
            .sort((a, b) => a - b);

        const originalToMastermind: Record<number, number> = {};
        const mastermindToOriginal: Record<number, number> = {};

        enabledIndices.forEach((originalIndex, mastermindIndex) => {
            originalToMastermind[originalIndex] = mastermindIndex;
            mastermindToOriginal[mastermindIndex] = originalIndex;
        });

        return { originalToMastermind, mastermindToOriginal };
    }, [enabledColors]);

    const fillPatternFromSelection = useCallback((pattern: string) => {
        if (!pattern) return;

        const isColorCharFormat = /^[RGBYMCOPWK]+$/i.test(pattern.trim());

        if (isColorCharFormat) {
            const chars = pattern.trim().toUpperCase().split('');
            if (chars.length === state.numPegs) {
                const newPattern = chars.map(char => {
                    const originalIdx = PEG_COLOR_CHARS.indexOf(char);
                    return originalIdx !== -1 ? originalIdx : null;
                });
                setState(prev => ({ ...prev, currentPattern: newPattern }));
            }
        } else {
            const parts = pattern.trim().split(/\s+/);
            if (parts.length === state.numPegs) {
                const newPattern = parts.map(part => {
                    const mastermindIdx = parseInt(part, 10);
                    if (isNaN(mastermindIdx)) return null;
                    const originalIdx = colorMapping.mastermindToOriginal[mastermindIdx];
                    return originalIdx !== undefined ? originalIdx : null;
                });
                setState(prev => ({ ...prev, currentPattern: newPattern }));
            }
        }
    }, [state.numPegs, colorMapping]);

    useImperativeHandle(ref, () => ({
        fillSuggestedGuess: fillPatternFromSelection
    }), [fillPatternFromSelection]);

    const handleColorSelect = useCallback((colorIndex: number) => {
        const emptySlotIndex = state.currentPattern.indexOf(null);
        if (emptySlotIndex !== -1) {
            const newPattern = [...state.currentPattern];
            newPattern[emptySlotIndex] = colorIndex;
            setState(prev => ({ ...prev, currentPattern: newPattern }));
        }
    }, [state.currentPattern]);

    const handleSlotClick = useCallback((slotIndex: number) => {
        const newPattern = [...state.currentPattern];
        newPattern[slotIndex] = null;
        setState(prev => ({ ...prev, currentPattern: newPattern }));
    }, [state.currentPattern]);

    const handleBackspace = useCallback(() => {
        const lastNonNullIndex = [...state.currentPattern].reverse().findIndex(slot => slot !== null);
        if (lastNonNullIndex !== -1) {
            const actualIndex = state.currentPattern.length - 1 - lastNonNullIndex;
            const newPattern = [...state.currentPattern];
            newPattern[actualIndex] = null;
            setState(prev => ({ ...prev, currentPattern: newPattern }));
        }
    }, [state.currentPattern]);

    const adjustCorrectPosition = useCallback((delta: number) => {
        setState(prev => {
            const newVal = Math.max(0, Math.min(prev.numPegs, prev.correctPosition + delta));
            let newCorrectColor = prev.correctColor;
            if (newVal + newCorrectColor > prev.numPegs) {
                newCorrectColor = prev.numPegs - newVal;
            }
            return {
                ...prev,
                correctPosition: newVal,
                correctColor: newCorrectColor
            };
        });
    }, []);

    const adjustCorrectColor = useCallback((delta: number) => {
        setState(prev => {
            const newVal = Math.max(0, Math.min(prev.numPegs - prev.correctPosition, prev.correctColor + delta));
            return {
                ...prev,
                correctColor: newVal
            };
        });
    }, []);

    const adjustExistingGuessFeedback = useCallback((index: number, field: 'correctPosition' | 'correctColor', delta: number) => {
        setState(prev => {
            const guesses = [...prev.guesses];
            const guess = { ...guesses[index] };
            if (!guess) return prev;

            if (field === 'correctPosition') {
                const newVal = Math.max(0, Math.min(prev.numPegs, guess.correctPosition + delta));
                guess.correctPosition = newVal;
                if (newVal + guess.correctColor > prev.numPegs) {
                    guess.correctColor = prev.numPegs - newVal;
                }
            } else {
                const newVal = Math.max(0, Math.min(prev.numPegs - guess.correctPosition, guess.correctColor + delta));
                guess.correctColor = newVal;
            }

            guess.feedback = `${guess.correctPosition},${guess.correctColor}`;
            guesses[index] = guess;
            return { ...prev, guesses };
        });
    }, []);

    const addGuess = useCallback(() => {
        const isPatternFull = state.currentPattern.every(slot => slot !== null);
        if (!isPatternFull) {
            showError('Please fill all slots for the guess pattern');
            return;
        }

        const patternString = state.currentPattern.map(colorIndex => {
            if (colorIndex === null) return '';
            return PEG_COLOR_CHARS[colorIndex];
        }).join('');

        const feedbackString = `${state.correctPosition},${state.correctColor}`;

        const newGuess: MastermindGuess = {
            pattern: patternString,
            feedback: feedbackString,
            correctPosition: state.correctPosition,
            correctColor: state.correctColor,
            colors: [...state.currentPattern],
            displayPattern: patternString
        };

        setState(prev => ({
            ...prev,
            guesses: [...prev.guesses, newGuess],
            currentPattern: Array(prev.numPegs).fill(null),
            correctPosition: 0,
            correctColor: 0
        }));
    }, [state.currentPattern, state.correctPosition, state.correctColor, showError]);

    const removeGuess = useCallback((index: number) => {
        setState(prev => ({
            ...prev,
            guesses: prev.guesses.filter((_, i) => i !== index)
        }));
    }, []);

    const handleSolve = useCallback(async () => {
        const requestGuesses = state.guesses.map(g => g.pattern);

        const blackPegs = state.guesses.map(g => g.correctPosition);
        const whitePegs = state.guesses.map(g => g.correctColor);

        // Get the string of enabled color characters (e.g. "RGBY")
        const enabledColorChars = Object.keys(enabledColors)
            .map(key => parseInt(key, 10))
            .filter(key => enabledColors[key])
            .map(key => PEG_COLOR_CHARS[key])
            .join('');

        await onSolve('mastermind', {
            guesses: requestGuesses,
            blackPegs,
            whitePegs,
            slots: state.numPegs,
            colors: enabledColorChars,
            duplicates: state.allowDuplicates === 1,
            maxDepth: state.maxDepth,
            start: 0,
            end: 100
        });
    }, [state.guesses, state.numPegs, enabledColors, state.allowDuplicates, state.maxDepth, colorMapping, onSolve]);

    const settingsFields: FieldDefinition[] = [
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
    ];

    return (
        <Grid container spacing={2} sx={{ height: '100%', minHeight: 0, flexGrow: 1 }}>
            {/* Control & Guesses Inputs Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <CardContent sx={{ 
                        p: 2, 
                        flexGrow: 1, 
                        overflowY: 'auto', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 2,
                        minHeight: 0,
                        '&:last-child': { pb: 2 } 
                    }}>
                        {/* Top Controls */}
                        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }} justifyContent="space-between" alignItems="center" flexShrink={0}>
                            <Button variant="outlined" onClick={handleLocalClear} disabled={isLoading} size="small">
                                New Game
                            </Button>
                            <Tooltip title="Settings">
                                <IconButton onClick={() => setSettingsOpen(true)} size="small">
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Box sx={{ mb: 0.5, flexShrink: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Mastermind Solver
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Click pegs to select, build your guess, and input black/white key clues.
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, minHeight: 0 }}>
                            {/* Available Colors List */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" align="center" sx={{ mb: 1.5, fontWeight: 600 }}>Available Colors</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                    {PEG_COLORS.map((color, index) => {
                                        if (!enabledColors[index]) return null;
                                        return (
                                            <Tooltip key={index} title={PEG_COLOR_NAMES[index]}>
                                                <Box
                                                    onClick={() => handleColorSelect(index)}
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: '50%',
                                                        backgroundColor: color,
                                                        color: PEG_TEXT_COLORS[index],
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        boxShadow: 1,
                                                        '&:hover': {
                                                            transform: 'scale(1.1)',
                                                            transition: 'transform 0.1s'
                                                        }
                                                    }}
                                                >
                                                    {PEG_COLOR_CHARS[index]}
                                                </Box>
                                            </Tooltip>
                                        );
                                    })}
                                </Box>
                            </Box>

                            {/* Current Guess Builder */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" align="center" sx={{ mb: 1, fontWeight: 600 }}>Build Guess</Typography>

                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                                    {state.currentPattern.map((colorIndex, index) => (
                                        <Box
                                            key={index}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                if (colorIndex !== null) handleSlotClick(index);
                                            }}
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                backgroundColor: colorIndex !== null ? PEG_COLORS[colorIndex] : 'transparent',
                                                border: '2px dashed',
                                                borderColor: colorIndex !== null ? 'divider' : 'text.disabled',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: colorIndex !== null ? 'pointer' : 'default',
                                                color: colorIndex !== null ? PEG_TEXT_COLORS[colorIndex] : 'inherit',
                                                fontWeight: 'bold',
                                                fontSize: '1rem',
                                                boxShadow: colorIndex !== null ? 1 : 0
                                            }}
                                        >
                                            {colorIndex !== null ? PEG_COLOR_CHARS[colorIndex] : '?'}
                                        </Box>
                                    ))}
                                    <IconButton
                                        onClick={handleBackspace}
                                        disabled={state.currentPattern.every(slot => slot === null)}
                                        color="error"
                                        size="small"
                                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, ml: 1.5 }}
                                    >
                                        <BackspaceIcon />
                                    </IconButton>
                                </Box>

                                <Divider sx={{ mb: 1.5 }} />

                                {/* Clues builder */}
                                <Stack spacing={1}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 1 }}>
                                        {/* Correct Position (Black) */}
                                        <Stack alignItems="center" spacing={0.5}>
                                            <Typography variant="caption" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}>
                                                ⚫ Position (Black)
                                            </Typography>
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                <IconButton size="small" onClick={() => adjustCorrectPosition(-1)} sx={{ p: 0.25 }}>-</IconButton>
                                                <Typography variant="body2" sx={{ minWidth: 16, textAlign: 'center', fontWeight: 'bold' }}>
                                                    {state.correctPosition}
                                                </Typography>
                                                <IconButton size="small" onClick={() => adjustCorrectPosition(1)} sx={{ p: 0.25 }}>+</IconButton>
                                            </Stack>
                                        </Stack>

                                        {/* Correct Color (White) */}
                                        <Stack alignItems="center" spacing={0.5}>
                                            <Typography variant="caption" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500 }}>
                                                ⚪ Color (White)
                                            </Typography>
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                <IconButton size="small" onClick={() => adjustCorrectColor(-1)} sx={{ p: 0.25 }}>-</IconButton>
                                                <Typography variant="body2" sx={{ minWidth: 16, textAlign: 'center', fontWeight: 'bold' }}>
                                                    {state.correctColor}
                                                </Typography>
                                                <IconButton size="small" onClick={() => adjustCorrectColor(1)} sx={{ p: 0.25 }}>+</IconButton>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                </Stack>

                                <Button
                                    variant="outlined"
                                    onClick={addGuess}
                                    disabled={state.currentPattern.includes(null)}
                                    startIcon={<AddIcon />}
                                    fullWidth
                                    size="small"
                                    sx={{ mt: 1.5 }}
                                >
                                    Add Guess
                                </Button>
                            </Box>

                            {/* Guesses Log */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>History ({state.guesses.length})</Typography>

                                {state.guesses.length > 0 ? (
                                    <Box sx={{ overflowX: 'auto', maxHeight: '180px', overflowY: 'auto' }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell align="center" sx={{ py: 0.5, px: 1 }}>#</TableCell>
                                                    <TableCell sx={{ py: 0.5, px: 1 }}>Pattern</TableCell>
                                                    <TableCell align="center" sx={{ py: 0.5, px: 1 }}>⚫</TableCell>
                                                    <TableCell align="center" sx={{ py: 0.5, px: 1 }}>⚪</TableCell>
                                                    <TableCell align="center" sx={{ py: 0.5, px: 1 }}></TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {state.guesses.map((guess, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell align="center" sx={{ py: 0.5, px: 1 }}>{index + 1}</TableCell>
                                                        <TableCell sx={{ py: 0.5, px: 1 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                {guess.colors.map((colorIndex, cIdx) => (
                                                                    <Box
                                                                        key={cIdx}
                                                                        sx={{
                                                                            width: 20,
                                                                            height: 20,
                                                                            borderRadius: '50%',
                                                                            backgroundColor: colorIndex !== null ? PEG_COLORS[colorIndex] : '#ccc',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            color: colorIndex !== null ? PEG_TEXT_COLORS[colorIndex] : '#000',
                                                                            fontWeight: 'bold',
                                                                            fontSize: '0.65rem',
                                                                            border: '1px solid',
                                                                            borderColor: 'divider'
                                                                        }}
                                                                    >
                                                                        {colorIndex !== null ? PEG_COLOR_CHARS[colorIndex] : '?'}
                                                                    </Box>
                                                                ))}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ py: 0.5, px: 1 }}>
                                                            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                                                <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctPosition', -1)} sx={{ p: 0.25 }}>-</IconButton>
                                                                <Typography variant="body2">{guess.correctPosition}</Typography>
                                                                <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctPosition', 1)} sx={{ p: 0.25 }}>+</IconButton>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ py: 0.5, px: 1 }}>
                                                            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                                                <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctColor', -1)} sx={{ p: 0.25 }}>-</IconButton>
                                                                <Typography variant="body2">{guess.correctColor}</Typography>
                                                                <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctColor', 1)} sx={{ p: 0.25 }}>+</IconButton>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell align="center" sx={{ py: 0.5, px: 1 }}>
                                                            <IconButton size="small" onClick={() => removeGuess(index)} color="error" sx={{ p: 0.25 }}>
                                                                <CloseIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                ) : (
                                    <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', py: 1, fontStyle: 'italic' }}>
                                        No guesses added yet.
                                    </Typography>
                                )}
                            </Box>
                        </Stack>

                        <Button
                            variant="contained"
                            onClick={handleSolve}
                            disabled={isLoading || !gameStatus?.healthy}
                            startIcon={isLoading ? <CircularProgress size={16} /> : <PlayIcon />}
                            fullWidth
                            size="medium"
                            color="primary"
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            Solve
                        </Button>

                        {/* Settings Dialog */}
                        <GameSettingsDialog
                            open={settingsOpen}
                            onClose={() => setSettingsOpen(false)}
                            onSave={(newConfig: DialogConfig) => {
                                const colorsChanged = JSON.stringify(tempEnabledColors) !== JSON.stringify(enabledColors);
                                setEnabledColors(tempEnabledColors);

                                setState(prev => {
                                    const newNumPegs = Number(newConfig.numPegs);
                                    const numPegsChanged = newNumPegs !== prev.numPegs;
                                    const shouldReset = numPegsChanged || colorsChanged;
                                    
                                    if (shouldReset) {
                                        onClear();
                                        return {
                                            ...prev,
                                            numPegs: newNumPegs,
                                            allowDuplicates: newConfig.allowDuplicates ? 1 : 0,
                                            maxDepth: Number(newConfig.maxDepth),
                                            currentPattern: Array(newNumPegs).fill(null),
                                            correctPosition: 0,
                                            correctColor: 0,
                                            guesses: []
                                        };
                                    }

                                    return {
                                        ...prev,
                                        numPegs: newNumPegs,
                                        allowDuplicates: newConfig.allowDuplicates ? 1 : 0,
                                        maxDepth: Number(newConfig.maxDepth)
                                    };
                                });
                            }}
                            title="Mastermind Settings"
                            config={{
                                numPegs: state.numPegs,
                                allowDuplicates: state.allowDuplicates,
                                maxDepth: state.maxDepth
                            }}
                            fields={settingsFields}
                        >
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Enabled Colors</Typography>
                                <Grid container spacing={1}>
                                    {PEG_COLORS.map((color, index) => {
                                        const isEnabled = tempEnabledColors[index] ?? false;
                                        return (
                                            <Grid size={{ xs: 6 }} key={index}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={isEnabled}
                                                            size="small"
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                const next = { ...tempEnabledColors, [index]: checked };
                                                                const enabledCount = Object.values(next).filter(Boolean).length;
                                                                if (enabledCount > 0) {
                                                                    setTempEnabledColors(next);
                                                                }
                                                            }}
                                                        />
                                                    }
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Box sx={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: color }} />
                                                            <Typography variant="caption">{PEG_COLOR_NAMES[index]}</Typography>
                                                        </Box>
                                                    }
                                                />
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </Box>
                        </GameSettingsDialog>
                    </CardContent>
                </Card>
            </Grid>

            {/* Results Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {results && results.gameData ? (
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
                ) : (
                    <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CardContent>
                            <Typography variant="h6" color="text.secondary" align="center">
                                Run Solver
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </Grid>
        </Grid>
    );
});

MastermindGame.displayName = 'MastermindGame';

export default React.memo(MastermindGame);
