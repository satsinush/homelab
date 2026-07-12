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
    Divider,
    Tabs,
    Tab,
    FormControlLabel,
    Checkbox,
    Paper,
    keyframes
} from '@mui/material';
const pulseKeyframes = keyframes`
  0% {
    outline: 3px solid rgba(25, 118, 210, 0.6);
    outline-offset: 1px;
    transform: scale(1.01);
  }
  50% {
    outline: 3px solid rgba(25, 118, 210, 0.3);
    outline-offset: 4px;
    transform: scale(1.02);
  }
  100% {
    outline: 3px solid rgba(25, 118, 210, 0);
    outline-offset: 0px;
    transform: scale(1);
  }
`;
import {
    PlayArrow as PlayIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
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
        wnt?: number | null;
    }[];
    guessesWithEntropy: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
        wnt?: number | null;
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
        const patternsText = possiblePatterns.map(p => `${p.pattern} - ${p.probability} - ${p.entropy} - ${p.wnt}`).join('\n');
        onCopyToClipboard(patternsText);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.pattern} - ${g.probability} - ${g.entropy} - ${g.wnt}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const formatRoundedNum = (num: number) => {
        if (num === 0) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    const showPossible = possiblePatterns && possiblePatterns.length > 0;
    const showSuggestions = guessesWithEntropy && guessesWithEntropy.length > 0;

    if (!showPossible && !showSuggestions && !lastGameData) return null;

    return (
        <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ 
                borderBottom: 1, 
                borderColor: 'divider', 
                px: 2, 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'stretch', sm: 'center' }, 
                gap: 1,
                flexShrink: 0 
            }}>
                <Tabs 
                    value={tabVal} 
                    onChange={handleTabChange} 
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    aria-label="mastermind results tabs"
                    sx={{ minHeight: 48 }}
                >
                    <Tab label={`Suggested Guesses (${guessesWithEntropy.length}/${lastGameData?.guessesCount ?? guessesWithEntropy.length})`} />
                    <Tab label={`Possible Patterns (${possiblePatterns.length}/${lastGameData?.possibleCount ?? possiblePatterns.length})`} />
                </Tabs>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pb: { xs: 1, sm: 0 }, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
                    {lastGameData?.searchDepth !== undefined && lastGameData?.searchDepth !== null && (
                        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                            Search Depth: {lastGameData.searchDepth}
                        </Typography>
                    )}
                    {tabVal === 0 && showSuggestions && (
                        <Button variant="outlined" size="small" onClick={copyGuesses} startIcon={<CopyIcon />}>Copy</Button>
                    )}
                    {tabVal === 1 && showPossible && (
                        <Button variant="outlined" size="small" onClick={copyPossiblePatterns} startIcon={<CopyIcon />}>Copy</Button>
                    )}
                </Stack>
            </Box>
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {tabVal === 0 && (
                    showSuggestions ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '100%' }}>
                                    <Table size="small" stickyHeader sx={{ minWidth: 500 }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Pattern</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ENT</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>WNT</TableCell>
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
                                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 1, fontSize: '1rem', fontWeight: 'bold' }}>
                                                                {guess.pattern.toUpperCase()}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.entropy !== null && guess.entropy !== undefined && !isNaN(Number(guess.entropy)) ? formatRoundedNum(Number(guess.entropy)) : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.wnt !== null && guess.wnt !== undefined && !isNaN(Number(guess.wnt)) ? formatRoundedNum(Number(guess.wnt)) : '-'}
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
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '100%' }}>
                                    <Table size="small" stickyHeader sx={{ minWidth: 500 }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Pattern</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ENT</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>WNT</TableCell>
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
                                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', ml: 1, fontSize: '1rem', fontWeight: 'bold' }}>
                                                                {guess.pattern.toUpperCase()}
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.entropy !== null && guess.entropy !== undefined && !isNaN(Number(guess.entropy)) ? formatRoundedNum(Number(guess.entropy)) : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {guess.wnt !== null && guess.wnt !== undefined && !isNaN(Number(guess.wnt)) ? formatRoundedNum(Number(guess.wnt)) : '-'}
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



interface MastermindGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    isSolving: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onCancel: () => void;
    onClear: () => void;
    showError: (message: string) => void;
    results: MastermindResultState | null;
    onLoadMore: (type: string) => void;
}

export interface MastermindGameRef {
    fillSuggestedGuess: (pattern: string) => void;
}

const MastermindGame = forwardRef<MastermindGameRef, MastermindGameProps>(({ gameStatus, isLoading, isSolving, onSolve, onCancel, onClear, showError, results, onLoadMore }, ref) => {
    const [state, setState] = useState({
        guesses: [] as MastermindGuess[],
        currentPattern: Array(4).fill(null) as (number | null)[],
        correctPosition: 0,
        correctColor: 0,
        numPegs: 4,
        allowDuplicates: 1,
        maxDepth: 0,
        autoDepth: true,
        maxGuesses: 10
    });

    const [enabledColors, setEnabledColors] = useState<Record<number, boolean>>(() => {
        const initial: Record<number, boolean> = {};
        for (let i = 0; i < 11; i++) {
            initial[i] = i < 6;
        }
        return initial;
    });

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isPulsing, setIsPulsing] = useState(false);

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

        const trimmed = pattern.trim();
        const parts = trimmed.split(/\s+/);
        const isNumeric = parts.every(p => !isNaN(parseInt(p, 10)) && /^\d+$/.test(p));

        let filled = false;
        if (isNumeric) {
            let numericParts = parts;
            if (parts.length === 1 && trimmed.length === state.numPegs) {
                numericParts = trimmed.split('');
            }
            if (numericParts.length === state.numPegs) {
                const newPattern = numericParts.map(part => {
                    const mastermindIdx = parseInt(part, 10);
                    const originalIdx = colorMapping.mastermindToOriginal[mastermindIdx];
                    return originalIdx !== undefined ? originalIdx : null;
                });
                setState(prev => ({ ...prev, currentPattern: newPattern }));
                filled = true;
            }
        } else {
            const chars = trimmed.replace(/\s+/g, '').toUpperCase().split('');
            if (chars.length === state.numPegs) {
                const newPattern = chars.map(char => {
                    const originalIdx = PEG_COLOR_CHARS.indexOf(char);
                    return originalIdx !== -1 ? originalIdx : null;
                });
                setState(prev => ({ ...prev, currentPattern: newPattern }));
                filled = true;
            }
        }

        if (filled) {
            setIsPulsing(true);
            setTimeout(() => setIsPulsing(false), 800);
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

    const addGuess = useCallback((shouldSolve = false) => {
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

        const updatedGuesses = [...state.guesses, newGuess];

        setState(prev => ({
            ...prev,
            guesses: updatedGuesses,
            currentPattern: Array(prev.numPegs).fill(null),
            correctPosition: 0,
            correctColor: 0
        }));

        if (shouldSolve) {
            const requestGuesses = updatedGuesses.map(g => g.pattern);
            const blackPegs = updatedGuesses.map(g => g.correctPosition);
            const whitePegs = updatedGuesses.map(g => g.correctColor);

            const enabledColorChars = Object.keys(enabledColors)
                .map(key => parseInt(key, 10))
                .filter(key => enabledColors[key])
                .map(key => PEG_COLOR_CHARS[key])
                .join('');

            onSolve('mastermind', {
                guesses: requestGuesses,
                blackPegs,
                whitePegs,
                slots: state.numPegs,
                colors: enabledColorChars,
                duplicates: state.allowDuplicates === 1,
                maxDepth: state.maxDepth,
                autoDepth: state.autoDepth,
                maxGuesses: state.maxGuesses,
                start: 0,
                end: 100
            });
        }
    }, [state.currentPattern, state.correctPosition, state.correctColor, state.guesses, state.numPegs, enabledColors, state.allowDuplicates, state.maxDepth, state.autoDepth, state.maxGuesses, onSolve, showError]);

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
            autoDepth: state.autoDepth,
            maxGuesses: state.maxGuesses,
            start: 0,
            end: 100
        });
    }, [state.guesses, state.numPegs, enabledColors, state.allowDuplicates, state.maxDepth, state.autoDepth, state.maxGuesses, onSolve]);

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }
                const isPatternFull = state.currentPattern.every(slot => slot !== null);
                if (isPatternFull) {
                    addGuess(false);
                } else if (state.guesses.length > 0 && !isLoading && gameStatus?.healthy) {
                    handleSolve();
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [state.guesses, state.currentPattern, isLoading, gameStatus, handleSolve, addGuess]);

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
            name: 'autoDepth',
            label: 'Auto Depth (Recommended)',
            type: 'checkbox'
        },
        {
            name: 'maxDepth',
            label: 'Manual Search Depth',
            type: 'select',
            options: [
                { value: 0, label: '0: Fastest' },
                { value: 1, label: '1: Balanced' },
                { value: 2, label: '2: Deep' }
            ],
            disabled: (configVal) => Boolean(configVal.autoDepth)
        },
        {
            name: 'maxGuesses',
            label: 'Maximum Guesses Allowed',
            type: 'number',
            min: 1,
            max: 100
        }
    ];

    return (
        <Grid container spacing={2} sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0, flexGrow: 1 }}>
            {/* Control & Guesses Inputs Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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

                        <Stack spacing={2} sx={{ flexGrow: 1, pr: 0.5, minHeight: 0 }}>
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
                            <Box sx={{ 
                                p: 1.5, 
                                border: '1px solid', 
                                borderColor: 'divider', 
                                borderRadius: 1
                            }}>
                                <Typography variant="subtitle2" align="center" sx={{ mb: 1, fontWeight: 600 }}>Build Guess</Typography>

                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    gap: 1.5,
                                    mb: 1.5,
                                    overflowX: 'auto',
                                    pb: 0.5
                                }}>
                                    {/* Left: build pattern pegs */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                        {state.currentPattern.map((colorIndex, index) => (
                                            <Box
                                                key={index}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    if (colorIndex !== null) handleSlotClick(index);
                                                }}
                                                sx={{
                                                    animation: isPulsing ? `${pulseKeyframes} 0.8s ease-in-out` : 'none',
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: '50%',
                                                    backgroundColor: colorIndex !== null ? PEG_COLORS[colorIndex] : 'transparent',
                                                    border: colorIndex !== null ? 'none' : '2px dashed',
                                                    borderColor: colorIndex !== null ? 'transparent' : 'text.disabled',
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
                                                {colorIndex !== null ? PEG_COLOR_CHARS[colorIndex] : ''}
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

                                    {/* Right: inline feedback selectors */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                                        {/* Correct Position (⚫) */}
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <Typography variant="body2" sx={{ mr: 0.25, userSelect: 'none', fontSize: '0.9rem' }}>⚫</Typography>
                                            <IconButton size="small" onClick={() => adjustCorrectPosition(-1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                <RemoveIcon sx={{ fontSize: '0.85rem' }} />
                                            </IconButton>
                                            <Typography variant="body2" sx={{ minWidth: 10, textAlign: 'center', fontWeight: 'bold' }}>{state.correctPosition}</Typography>
                                            <IconButton size="small" onClick={() => adjustCorrectPosition(1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                <AddIcon sx={{ fontSize: '0.85rem' }} />
                                            </IconButton>
                                        </Stack>

                                        {/* Correct Color (⚪) */}
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <Typography variant="body2" sx={{ mr: 0.25, userSelect: 'none', fontSize: '0.9rem' }}>⚪</Typography>
                                            <IconButton size="small" onClick={() => adjustCorrectColor(-1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                <RemoveIcon sx={{ fontSize: '0.85rem' }} />
                                            </IconButton>
                                            <Typography variant="body2" sx={{ minWidth: 10, textAlign: 'center', fontWeight: 'bold' }}>{state.correctColor}</Typography>
                                            <IconButton size="small" onClick={() => adjustCorrectColor(1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                <AddIcon sx={{ fontSize: '0.85rem' }} />
                                            </IconButton>
                                        </Stack>
                                    </Box>
                                </Box>

                                <Divider sx={{ mb: 1.5 }} />


                                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                    <Button
                                        variant="contained"
                                        onClick={() => addGuess(true)}
                                        disabled={state.currentPattern.includes(null)}
                                        startIcon={<PlayIcon />}
                                        size="small"
                                        sx={{ flexGrow: 1 }}
                                    >
                                        Add & Solve
                                    </Button>
                                    <Tooltip title="Add guess without solving">
                                        <span>
                                            <Button
                                                variant="outlined"
                                                onClick={() => addGuess(false)}
                                                disabled={state.currentPattern.includes(null)}
                                                size="small"
                                                sx={{ minWidth: 38, width: 38, height: 38, p: 0 }}
                                            >
                                                <AddIcon />
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Box>

                            {/* Guesses Log */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>History ({state.guesses.length})</Typography>

                                {state.guesses.length > 0 ? (
                                    <Box sx={{ 
                                        maxHeight: '180px', 
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1
                                    }}>
                                        {state.guesses.map((guess, index) => (
                                            <Box key={index} sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 1.5,
                                                py: 0.75,
                                                px: 0.5,
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                '&:last-child': { borderBottom: 'none' }
                                            }}>
                                                {/* Left: Pegs */}
                                                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                                    {guess.colors.map((colorIndex, cIdx) => (
                                                        <Box
                                                            key={cIdx}
                                                            sx={{
                                                                width: 22,
                                                                height: 22,
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
                                                            {colorIndex !== null ? PEG_COLOR_CHARS[colorIndex] : ''}
                                                        </Box>
                                                    ))}
                                                </Box>

                                                {/* Right: Feedback & Actions */}
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, justifyContent: 'flex-end' }}>
                                                    {/* Correct Position (⚫) */}
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        <Typography variant="body2" sx={{ mr: 0.25, userSelect: 'none', fontSize: '0.9rem' }}>⚫</Typography>
                                                        <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctPosition', -1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                            <RemoveIcon sx={{ fontSize: '0.85rem' }} />
                                                        </IconButton>
                                                        <Typography variant="body2" sx={{ minWidth: 10, textAlign: 'center', fontWeight: 'bold' }}>{guess.correctPosition}</Typography>
                                                        <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctPosition', 1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                            <AddIcon sx={{ fontSize: '0.85rem' }} />
                                                        </IconButton>
                                                    </Stack>

                                                    {/* Correct Color (⚪) */}
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        <Typography variant="body2" sx={{ mr: 0.25, userSelect: 'none', fontSize: '0.9rem' }}>⚪</Typography>
                                                        <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctColor', -1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                            <RemoveIcon sx={{ fontSize: '0.85rem' }} />
                                                        </IconButton>
                                                        <Typography variant="body2" sx={{ minWidth: 10, textAlign: 'center', fontWeight: 'bold' }}>{guess.correctColor}</Typography>
                                                        <IconButton size="small" onClick={() => adjustExistingGuessFeedback(index, 'correctColor', 1)} sx={{ width: 22, height: 22, border: '1px solid', borderColor: 'divider', p: 0 }}>
                                                            <AddIcon sx={{ fontSize: '0.85rem' }} />
                                                        </IconButton>
                                                    </Stack>

                                                    {/* Delete Action */}
                                                    <IconButton size="small" onClick={() => removeGuess(index)} color="error" sx={{ ml: 0.5, p: 0.25 }}>
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                        ))}
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
                            onClick={isSolving ? onCancel : handleSolve}
                            disabled={!isSolving && !gameStatus?.healthy}
                            color={isSolving ? "error" : "primary"}
                            startIcon={isSolving ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                            fullWidth
                            size="medium"
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            {isSolving ? 'Cancel' : 'Solve'}
                        </Button>

                        {/* Settings Dialog */}
                        <GameSettingsDialog
                            open={settingsOpen}
                            onClose={() => setSettingsOpen(false)}
                            onSave={(newConfig: DialogConfig) => {
                                const newNumPegs = Number(newConfig.numPegs);
                                const numEnabledColors = Object.values(tempEnabledColors).filter(Boolean).length;
                                if (!newConfig.allowDuplicates && newNumPegs > numEnabledColors) {
                                    showError(`Number of pegs (${newNumPegs}) cannot exceed the number of enabled colors (${numEnabledColors}) when duplicates are disabled.`);
                                    return;
                                }

                                const colorsChanged = JSON.stringify(tempEnabledColors) !== JSON.stringify(enabledColors);
                                setEnabledColors(tempEnabledColors);

                                const numPegsChanged = newNumPegs !== state.numPegs;
                                const shouldReset = numPegsChanged || colorsChanged;
                                
                                if (shouldReset) {
                                    onClear();
                                    setState(prev => ({
                                        ...prev,
                                        numPegs: newNumPegs,
                                        allowDuplicates: newConfig.allowDuplicates ? 1 : 0,
                                        maxDepth: Number(newConfig.maxDepth),
                                        autoDepth: Boolean(newConfig.autoDepth),
                                        maxGuesses: Number(newConfig.maxGuesses) || 10,
                                        currentPattern: Array(newNumPegs).fill(null),
                                        correctPosition: 0,
                                        correctColor: 0,
                                        guesses: []
                                    }));
                                } else {
                                    setState(prev => ({
                                        ...prev,
                                        numPegs: newNumPegs,
                                        allowDuplicates: newConfig.allowDuplicates ? 1 : 0,
                                        maxDepth: Number(newConfig.maxDepth),
                                        autoDepth: Boolean(newConfig.autoDepth),
                                        maxGuesses: Number(newConfig.maxGuesses) || 10
                                    }));
                                }
                            }}
                            title="Mastermind Settings"
                            config={{
                                numPegs: state.numPegs,
                                allowDuplicates: state.allowDuplicates,
                                maxDepth: state.maxDepth,
                                autoDepth: state.autoDepth,
                                maxGuesses: state.maxGuesses
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
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
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
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 350, md: 0 } }}>
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
                    <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', py: { xs: 6, md: 0 }, flexGrow: 1 }}>
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
