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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Tab,
    Divider
} from '@mui/material';

import {
    PlayArrow as PlayIcon,
    Close as CloseIcon,
    ArrowBack as BackspaceIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import GameSettingsDialog, { FieldDefinition, DialogConfig } from './GameSettingsDialog';
import { DungleonResultState, GameStatus } from '../types/api';

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
}, {} as Record<string, { id: string; name: string; index: number }>);

// Feedback styles using theme-compatible colors
const FEEDBACK_STYLES: Record<number, { borderColor: string; bgColor: string; badge: boolean }> = {
    0: { borderColor: '#d34bb1', bgColor: '#d34bb1', badge: false }, // Not present (Red)
    1: { borderColor: '#c0cd3c', bgColor: '#c0cd3c', badge: false }, // Wrong pos (Yellow)
    2: { borderColor: '#37c45c', bgColor: '#37c45c', badge: false }, // Correct pos (Green)
    3: { borderColor: '#c0cd3c', bgColor: '#c0cd3c', badge: true },  // Wrong pos + 1 more
    4: { borderColor: '#37c45c', bgColor: '#37c45c', badge: true }   // Correct pos + 1 more
};

const getDungleonAssetPath = (charId: string) => {
    if (!charId) return '';
    const name = CHARACTER_MAP[charId]?.name?.toLowerCase().replace(' ', '_');
    return `/assets/dungleon/${name}.png`;
};

interface DungleonPatternDisplayProps {
    pattern: string;
}

const DungleonPatternDisplay = ({ pattern }: DungleonPatternDisplayProps) => {
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
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    </Tooltip>
                </Box>
            ))}
        </Box>
    );
};

interface GuessWithEntropyItem {
    pattern: string;
    probability: number | null;
    entropy: number | null;
}

interface DungleonResultsProps {
    possiblePatterns: GuessWithEntropyItem[];
    guessesWithEntropy: GuessWithEntropyItem[];
    lastGameData: DungleonResultState['gameData'];
    isLoading: boolean;
    onLoadMore: (type: string) => void;
    onCopyToClipboard: (text: string) => void;
    onPossibleSolutionSelect?: (pattern: string) => void;
    onSuggestedGuessSelect?: (pattern: string) => void;
}

const DungleonResults = React.memo(({
    possiblePatterns,
    guessesWithEntropy,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard,
    onPossibleSolutionSelect,
    onSuggestedGuessSelect
}: DungleonResultsProps) => {
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
        if (num === 0) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    const showPossible = possiblePatterns && possiblePatterns.length > 0;
    const showSuggestions = guessesWithEntropy && guessesWithEntropy.length > 0;

    if (!showPossible && !showSuggestions && !lastGameData) return null;

    return (
        <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <Tabs value={tabVal} onChange={handleTabChange} aria-label="dungleon results tabs">
                    <Tab label={`Suggested Guesses (${guessesWithEntropy.length}/${lastGameData?.guessesCount || guessesWithEntropy.length})`} />
                    <Tab label={`Possible Patterns (${possiblePatterns.length}/${lastGameData?.possiblePatternsCount || possiblePatterns.length})`} />
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
                                <TableContainer sx={{ maxHeight: '100%', bgcolor: 'background.default' }}>
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
                                                        cursor: onSuggestedGuessSelect ? 'pointer' : 'default'
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <DungleonPatternDisplay pattern={guess.pattern} />
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2">
                                                            {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2">
                                                            {guess.entropy !== null && guess.entropy !== undefined && !isNaN(Number(guess.entropy)) ? formatRoundedNum(Number(guess.entropy)) : '-'}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                            {lastGameData && lastGameData.isLimitedGuesses && guessesWithEntropy.length < (lastGameData.guessesCount || 0) && (
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
                                <TableContainer sx={{ maxHeight: '100%', bgcolor: 'background.default' }}>
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
                                                    onClick={() => onPossibleSolutionSelect && onPossibleSolutionSelect(guess.pattern)}
                                                    sx={{
                                                        cursor: onPossibleSolutionSelect ? 'pointer' : 'default'
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <DungleonPatternDisplay pattern={guess.pattern} />
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2">
                                                            {guess.probability !== null ? `${formatRoundedNum(guess.probability * 100)}%` : '-'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2">
                                                            {guess.entropy !== null && guess.entropy !== undefined && !isNaN(Number(guess.entropy)) ? formatRoundedNum(Number(guess.entropy)) : '-'}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                            {lastGameData && lastGameData.isLimitedPossible && possiblePatterns.length < (lastGameData.possiblePatternsCount || 0) && (
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

DungleonResults.displayName = 'DungleonResults';

DungleonResults.displayName = 'DungleonResults';

interface DungleonGuess {
    pattern: string;
    patternArray: string[];
    feedback: number[];
}

interface DungleonSolution {
    pattern: string;
    patternArray: string[];
}

interface DungleonGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: DungleonResultState | null;
    onLoadMore: (type: string) => void;
}

export interface DungleonGameRef {
    fillSuggestedGuess: (pattern: string) => void;
}

const DungleonGame = forwardRef<DungleonGameRef, DungleonGameProps>(({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }, ref) => {
    const [guesses, setGuesses] = useState<DungleonGuess[]>([]);
    const [solutions, setSolutions] = useState<DungleonSolution[]>([]);
    const [currentPattern, setCurrentPattern] = useState<string[]>([]);
    const [currentFeedback, setCurrentFeedback] = useState<number[]>([0, 0, 0, 0, 0]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        maxDepth: 0,
        excludeImpossible: true
    });

    const handleConfigSave = useCallback((newConfig: DialogConfig) => {
        setConfig({
            maxDepth: Number(newConfig.maxDepth),
            excludeImpossible: Boolean(newConfig.excludeImpossible)
        });
    }, []);

    const settingsFields: FieldDefinition[] = [
        {
            name: 'maxDepth',
            label: 'Search Depth',
            type: 'select',
            options: [
                { value: 0, label: '0: Fastest' },
                { value: 1, label: '1: Balanced' },
                { value: 2, label: '2: Deep' }
            ]
        },
        {
            name: 'excludeImpossible',
            label: 'Exclude Impossible Patterns',
            type: 'checkbox'
        }
    ];

    const fillSuggestedGuess = useCallback((patternStr: string) => {
        const newPattern = patternStr.trim().split(/\s+/);
        if (newPattern.length === 5) {
            setCurrentPattern(newPattern);
            setCurrentFeedback([0, 0, 0, 0, 0]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const handleCopyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    useImperativeHandle(ref, () => ({
        fillSuggestedGuess
    }), [fillSuggestedGuess]);

    const handleCharacterClick = useCallback((charId: string) => {
        if (currentPattern.length < 5) {
            setCurrentPattern([...currentPattern, charId]);
        }
    }, [currentPattern]);

    const handleBackspace = useCallback(() => {
        setCurrentPattern(prev => {
            const nextPattern = prev.slice(0, -1);
            return nextPattern;
        });
    }, []);

    const handleSlotClick = useCallback((e: React.MouseEvent, index: number) => {
        e.preventDefault();
        setCurrentPattern(prev => prev.filter((_, i) => i !== index));
    }, []);

    const toggleCurrentFeedback = useCallback((index: number) => {
        setCurrentFeedback(prev => {
            const nextFeedback = [...prev];
            nextFeedback[index] = (nextFeedback[index] + 1) % 5;
            return nextFeedback;
        });
    }, []);

    const submitGuess = useCallback(() => {
        if (currentPattern.length !== 5) {
            showError('Please select exactly 5 characters');
            return;
        }

        const newGuess: DungleonGuess = {
            pattern: currentPattern.join(' '),
            patternArray: [...currentPattern],
            feedback: [...currentFeedback]
        };
        setGuesses([...guesses, newGuess]);
        setCurrentPattern([]);
        setCurrentFeedback([0, 0, 0, 0, 0]);
    }, [currentPattern, currentFeedback, guesses, showError]);

    const submitSolution = useCallback(() => {
        if (currentPattern.length !== 5) {
            showError('Please select exactly 5 characters');
            return;
        }

        const newSolution: DungleonSolution = {
            pattern: currentPattern.join(' '),
            patternArray: [...currentPattern]
        };
        setSolutions([...solutions, newSolution]);
        setCurrentPattern([]);
    }, [currentPattern, solutions, showError]);

    const removeGuess = useCallback((index: number) => {
        setGuesses(prev => prev.filter((_, i) => i !== index));
    }, []);

    const removeSolution = useCallback((index: number) => {
        setSolutions(prev => prev.filter((_, i) => i !== index));
    }, []);

    const toggleFeedback = useCallback((guessIndex: number, slotIndex: number) => {
        setGuesses(prev => {
            const newGuesses = [...prev];
            const guess = { ...newGuesses[guessIndex] } as DungleonGuess;
            const newFeedback = [...guess.feedback];
            newFeedback[slotIndex] = (newFeedback[slotIndex] + 1) % 5;
            guess.feedback = newFeedback;
            newGuesses[guessIndex] = guess;
            return newGuesses;
        });
    }, []);

    const handleSolve = useCallback(async () => {
        // Feedback mapping from numbers 0,1,2,3,4 -> G, Y, X, R, D
        // style index feedback colors:
        // 0: Red (X - not present)
        // 1: Yellow (Y - wrong pos)
        // 2: Green (G - correct pos)
        // 3: Yellow + 1 more (R - wrong pos + 1 more)
        // 4: Green + 1 more (D - correct pos + 1 more)
        const feedbackMapping = ['X', 'Y', 'G', 'R', 'D'];

        const requestGuesses = guesses.map(g => g.pattern);
        const requestResults = guesses.map(g => g.feedback.map(val => feedbackMapping[val] || 'X').join(''));
        const requestSolutions = solutions.map(s => s.pattern);

        await onSolve('dungleon', {
            guesses: requestGuesses,
            results: requestResults,
            solutions: requestSolutions,
            maxDepth: config.maxDepth,
            excludeImpossiblePatterns: config.excludeImpossible ? 1 : 0,
            start: 0,
            end: 100
        });
    }, [guesses, solutions, config, onSolve]);

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }
                if (guesses.length > 0 && !isLoading && gameStatus?.healthy) {
                    handleSolve();
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [guesses, isLoading, gameStatus, handleSolve]);

    const handleClear = useCallback(() => {
        setGuesses([]);
        setSolutions([]);
        setCurrentPattern([]);
        onClear();
    }, [onClear]);

    const getAssetPath = (charId: string) => {
        if (!charId) return '';
        const name = CHARACTER_MAP[charId]?.name?.toLowerCase().replace(' ', '_');
        return `/assets/dungleon/${name}.png`;
    };

    return (
        <Grid container spacing={2} sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0, flexGrow: 1 }}>
            {/* Input & Character Bank Column */}
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
                            <Button variant="outlined" onClick={handleClear} disabled={isLoading} size="small">
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
                                Dungleon Solver
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Select characters, add guesses, and set feedback colors to solve.
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, minHeight: 0 }}>
                            {/* Character Bank */}
                            <Box sx={{
                                p: 1.5,
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
                                        <span>
                                            <IconButton
                                                onClick={() => handleCharacterClick(char.id)}
                                                disabled={currentPattern.length >= 5}
                                                sx={{
                                                    width: 40,
                                                    height: 40,
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
                                        </span>
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
                                {Array.from({ length: 5 }).map((_, i) => {
                                    const charId = currentPattern[i];
                                    const feedbackVal = currentFeedback[i] ?? 0;
                                    const style = charId ? (FEEDBACK_STYLES[feedbackVal] || FEEDBACK_STYLES[0]) : null;

                                    return (
                                        <Box
                                            key={i}
                                            onContextMenu={(e) => handleSlotClick(e, i)}
                                            onClick={() => charId && toggleCurrentFeedback(i)}
                                            sx={{
                                                width: 48,
                                                height: 48,
                                                border: '2px solid',
                                                borderColor: style ? style.borderColor : 'divider',
                                                backgroundColor: style ? style.bgColor : 'action.disabledBackground',
                                                borderRadius: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: charId ? 'pointer' : 'default',
                                                position: 'relative'
                                            }}
                                        >
                                            {charId && (
                                                <>
                                                    <img
                                                        src={getAssetPath(charId)}
                                                        alt={charId}
                                                        style={{ width: 38, height: 38, objectFit: 'contain' }}
                                                    />
                                                    {style?.badge && (
                                                        <Box
                                                            component="img"
                                                            src="/assets/dungleon/plus.png"
                                                            sx={{
                                                                position: 'absolute',
                                                                top: 1,
                                                                right: 1,
                                                                width: 16,
                                                                height: 16
                                                            }}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </Box>
                                    );
                                })}
                                <IconButton
                                    onClick={handleBackspace}
                                    disabled={currentPattern.length === 0}
                                    color="error"
                                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                                >
                                    <BackspaceIcon />
                                </IconButton>
                            </Box>

                            {/* Submit Buttons */}
                            <Stack direction="row" spacing={2} sx={{ flexShrink: 0 }}>
                                <Button
                                    variant="contained"
                                    onClick={submitGuess}
                                    disabled={currentPattern.length !== 5}
                                    fullWidth
                                    color="primary"
                                    size="small"
                                    sx={{ flex: 1 }}
                                >
                                    Submit Guess
                                </Button>
                                <Tooltip title="Gauntlet Mode: Add past solutions to exclude">
                                    <Box component="span" sx={{ flex: 1, display: 'inline-flex' }}>
                                        <Button
                                            variant="contained"
                                            onClick={submitSolution}
                                            disabled={currentPattern.length !== 5}
                                            fullWidth
                                            color="secondary"
                                            size="small"
                                        >
                                            Submit Solution
                                        </Button>
                                    </Box>
                                </Tooltip>
                            </Stack>

                            {/* Guesses and Solutions Column */}
                            <Stack spacing={1.5}>
                                {/* Guesses Section */}
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                        Guesses:
                                    </Typography>
                                    <Box sx={{
                                        maxHeight: 120,
                                        overflow: 'auto',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        minHeight: 60,
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
                                                            const style = FEEDBACK_STYLES[feedbackState] || FEEDBACK_STYLES[0];
                                                            return (
                                                                <Box
                                                                    key={slotIndex}
                                                                    onClick={() => toggleFeedback(guessIndex, slotIndex)}
                                                                    sx={{
                                                                        width: 36,
                                                                        height: 36,
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
                                                                        style={{ width: 28, height: 28, objectFit: 'contain' }}
                                                                    />
                                                                    {style.badge && (
                                                                        <Box
                                                                            component="img"
                                                                            src="/assets/dungleon/plus.png"
                                                                            sx={{
                                                                                position: 'absolute',
                                                                                top: 1,
                                                                                right: 1,
                                                                                width: 12,
                                                                                height: 12
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
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1, display: 'block', fontStyle: 'italic' }}>
                                                No guesses yet
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                <Divider />

                                {/* Solutions Section */}
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                        Past Solutions:
                                    </Typography>
                                    <Box sx={{
                                        maxHeight: 120,
                                        overflow: 'auto',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1,
                                        minHeight: 60,
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
                                                                    width: 36,
                                                                    height: 36,
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
                                                                    style={{ width: 28, height: 28, objectFit: 'contain' }}
                                                                />
                                                            </Box>
                                                        ))}
                                                        <IconButton
                                                            onClick={() => removeSolution(index)}
                                                            color="error"
                                                            size="small"
                                                            sx={{ p: 0.25 }}
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1, display: 'block', fontStyle: 'italic' }}>
                                                No past solutions
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Stack>
                        </Stack>

                        {/* Solve Button */}
                        <Button
                            variant="contained"
                            onClick={handleSolve}
                            disabled={isLoading || !gameStatus?.healthy}
                            startIcon={isLoading ? <CircularProgress size={16} /> : <PlayIcon />}
                            fullWidth
                            size="medium"
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            Solve
                        </Button>
                    </CardContent>
                </Card>
            </Grid>

            {/* Results Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 350, md: 0 } }}>
                {results && results.gameData ? (
                    <DungleonResults
                        possiblePatterns={results.possiblePatterns || []}
                        guessesWithEntropy={results.guessesWithEntropy || []}
                        lastGameData={results.gameData}
                        isLoading={isLoading}
                        onLoadMore={onLoadMore}
                        onCopyToClipboard={handleCopyToClipboard}
                        onPossibleSolutionSelect={fillSuggestedGuess}
                        onSuggestedGuessSelect={fillSuggestedGuess}
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

            {/* Settings Dialog */}
            <GameSettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onSave={handleConfigSave}
                title="Dungleon Settings"
                config={config}
                fields={settingsFields}
            />
        </Grid>
    );
});

DungleonGame.displayName = 'DungleonGame';

export default React.memo(DungleonGame);
