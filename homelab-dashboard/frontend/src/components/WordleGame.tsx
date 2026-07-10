import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
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
    Tooltip,
    Tabs,
    Tab,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    Paper
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
    wnt?: number | null;
}

interface WordleResultsProps {
    possibleWords: GuessWithEntropyItem[];
    guessesWithEntropy: GuessWithEntropyItem[];
    lastGameData: WordleResultState['gameData'];
    isLoading: boolean;
    onLoadMore: (type: string) => void;
    onCopyToClipboard: (text: string) => void;
    onPossibleSolutionSelect: (word: string) => void;
    onSuggestedGuessSelect: (word: string) => void;
}

interface WordleGuessInputProps {
    wordLength: number;
    onAddGuess: (word: string, colors: number[]) => void;
    onSolve: () => void;
    hasGuesses: boolean;
    showError: (message: string) => void;
    colorMap: Record<number, { bg: string; color: string; symbol: string | null }>;
}

export interface WordleGuessInputRef {
    setGuess: (word: string) => void;
}

const WordleGuessInput = forwardRef<WordleGuessInputRef, WordleGuessInputProps>(({
    wordLength,
    onAddGuess,
    onSolve,
    hasGuesses,
    showError,
    colorMap
}, ref) => {
    const [localGuess, setLocalGuess] = useState('');
    const [localGuessColors, setLocalGuessColors] = useState<number[]>(Array(wordLength).fill(0));

    useImperativeHandle(ref, () => ({
        setGuess: (word: string) => {
            const cleanWord = word.trim().toUpperCase();
            if (cleanWord.length === wordLength && /^[A-Z]+$/.test(cleanWord)) {
                setLocalGuess(cleanWord);
                setLocalGuessColors(Array(wordLength).fill(0));
            }
        }
    }), [wordLength]);

    useEffect(() => {
        setLocalGuess('');
        setLocalGuessColors(Array(wordLength).fill(0));
    }, [wordLength]);

    const handleLocalGuessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, wordLength);
        setLocalGuess(cleanValue);
    };

    const toggleLetterColor = (index: number) => {
        setLocalGuessColors(prev => {
            const next = [...prev];
            next[index] = (next[index] + 1) % 3;
            return next;
        });
    };

    const handleAdd = () => {
        const guess = localGuess.trim().toUpperCase();
        if (guess.length !== wordLength) {
            showError(`Guess must be exactly ${wordLength} letters`);
            return;
        }
        onAddGuess(guess, [...localGuessColors]);
        setLocalGuess('');
        setLocalGuessColors(Array(wordLength).fill(0));
    };

    return (
        <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Add Guess</Typography>
            <Stack spacing={1.5}>
                <TextField
                    label={`${wordLength}-letter word`}
                    size="small"
                    value={localGuess}
                    onChange={handleLocalGuessChange}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (localGuess.length === wordLength) {
                                handleAdd();
                            } else if (localGuess.length === 0 && hasGuesses) {
                                onSolve();
                            }
                        }
                    }}
                    fullWidth
                    slotProps={{
                        htmlInput: {
                            maxLength: wordLength,
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

                {localGuess.length > 0 && (
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
                            {localGuess.split('').map((letter, index) => {
                                const colors = colorMap[localGuessColors[index]] || colorMap[0];
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
                    onClick={handleAdd}
                    disabled={localGuess.length !== wordLength}
                    startIcon={<AddIcon />}
                    size="small"
                    fullWidth
                >
                    Add Word
                </Button>
            </Stack>
        </Box>
    );
});
WordleGuessInput.displayName = 'WordleGuessInput';

const WordleResults = ({ possibleWords, guessesWithEntropy, lastGameData, isLoading, onLoadMore, onCopyToClipboard, onPossibleSolutionSelect, onSuggestedGuessSelect }: WordleResultsProps) => {
    const [tabVal, setTabVal] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabVal(newValue);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.word} - ${g.probability} - ${g.entropy} - ${g.wnt}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const copyPossibleWords = () => {
        const possibleText = possibleWords.map(w => `${w.word} - ${w.probability} - ${w.entropy} - ${w.wnt}`).join('\n');
        onCopyToClipboard(possibleText);
    };

    const formatRoundedNum = (num: number) => {
        if (num === 0) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    if (possibleWords.length === 0 && guessesWithEntropy.length === 0 && !lastGameData) return null;

    return (
        <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <Tabs value={tabVal} onChange={handleTabChange} aria-label="wordle results tabs">
                    <Tab label={`Suggested Guesses (${guessesWithEntropy.length}/${lastGameData?.guessesCount || guessesWithEntropy.length})`} />
                    <Tab label={`Possible Words (${possibleWords.length}/${lastGameData?.possibleWordsCount || possibleWords.length})`} />
                </Tabs>
                {tabVal === 0 && guessesWithEntropy.length > 0 && (
                    <Button variant="outlined" size="small" onClick={copyGuesses} startIcon={<CopyIcon />}>Copy</Button>
                )}
                {tabVal === 1 && possibleWords.length > 0 && (
                    <Button variant="outlined" size="small" onClick={copyPossibleWords} startIcon={<CopyIcon />}>Copy</Button>
                )}
            </Box>
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {tabVal === 0 && (
                    guessesWithEntropy.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '100%' }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Word</TableCell>
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
                                                    onClick={() => onSuggestedGuessSelect(guess.word)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                                        {guess.word.toUpperCase()}
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
                    possibleWords.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '100%' }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Word</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ENT</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>WNT</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {possibleWords.map((guess, index) => (
                                                <TableRow
                                                    key={index}
                                                    hover
                                                    onClick={() => onPossibleSolutionSelect(guess.word)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                                        {guess.word.toUpperCase()}
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
                            {lastGameData && lastGameData.isLimitedPossible && possibleWords.length < (lastGameData.possibleWordsCount || 0) && (
                                <Button variant="contained" onClick={() => onLoadMore('possible')} disabled={isLoading} sx={{ mt: 2, alignSelf: 'flex-start' }} size="small">
                                    Load More
                                </Button>
                            )}
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No possible words found.
                        </Typography>
                    )
                )}
            </CardContent>
        </Card>
    );
};

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
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        wordLength: 5,
        maxDepth: 1,
        autoDepth: true,
        maxGuesses: 6,
        excludeUncommonWords: true
    });

    const guessInputRef = useRef<WordleGuessInputRef>(null);

    const settingsFields: FieldDefinition[] = [
        {
            name: 'wordLength',
            label: 'Word Length',
            type: 'number',
            min: 1,
            max: 32
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
            setWordleGuesses([]);
        }
        setConfig({
            wordLength: newWordLength,
            maxDepth: Number(newConfig.maxDepth),
            autoDepth: Boolean(newConfig.autoDepth),
            maxGuesses: Number(newConfig.maxGuesses) || 6,
            excludeUncommonWords: Boolean(newConfig.excludeUncommonWords)
        });
    }, [config.wordLength]);

    useImperativeHandle(ref, () => ({
        fillSuggestedGuess: (word: string) => {
            guessInputRef.current?.setGuess(word);
        }
    }), []);

    const addWordleGuess = useCallback((word: string, colors: number[]) => {
        const feedbackMap = ['X', 'Y', 'G'];
        const feedback = colors.map(c => feedbackMap[c] || 'X').join('');
        const newGuess: WordleGuessItem = { word, feedback, colors };
        setWordleGuesses(prev => [...prev, newGuess]);
    }, []);

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
        setWordleGuesses(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleSolve = useCallback(async () => {
        await onSolve('wordle', {
            guesses: wordleGuesses.map(g => g.word),
            results: wordleGuesses.map(g => g.feedback),
            wordLength: config.wordLength,
            maxDepth: config.maxDepth,
            autoDepth: config.autoDepth,
            maxGuesses: config.maxGuesses,
            excludeUncommonWords: config.excludeUncommonWords ? 1 : 0,
            start: 0,
            end: 100
        });
    }, [wordleGuesses, config, onSolve]);

    const handleClear = useCallback(() => {
        setWordleGuesses([]);
        onClear();
    }, [onClear]);

    const handleCopyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const handlePossibleSolutionSelect = useCallback((word: string) => {
        guessInputRef.current?.setGuess(word);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleSuggestedGuessSelect = useCallback((word: string) => {
        guessInputRef.current?.setGuess(word);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    return (
        <Grid container spacing={2} sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0, flexGrow: 1 }}>
            {/* Input & Guess Controls Column */}
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
                                Wordle Solver
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Enter your Wordle guesses and their color feedback.
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, minHeight: 0 }}>
                            {/* Add Guess Section */}
                            <WordleGuessInput
                                ref={guessInputRef}
                                wordLength={config.wordLength}
                                onAddGuess={addWordleGuess}
                                onSolve={handleSolve}
                                hasGuesses={wordleGuesses.length > 0}
                                showError={showError}
                                colorMap={colorMap}
                            />

                            {/* Current Guesses */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                    {`Current Guesses (${wordleGuesses.length})`}
                                </Typography>
                                {wordleGuesses.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 160, overflowY: 'auto', pr: 0.5, pb: 1.5 }}>
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
                        </Stack>

                        <Button
                            variant="contained"
                            onClick={handleSolve}
                            disabled={isLoading}
                            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                            fullWidth
                            size="medium"
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            {isLoading ? 'Solving...' : 'Solve'}
                        </Button>
                    </CardContent>
                </Card>
            </Grid>

            {/* Results Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 350, md: 0 } }}>
                {results && results.gameData ? (
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
                title="Wordle Settings"
                config={config}
                fields={settingsFields}
            />
        </Grid>
    );
});

WordleGame.displayName = 'WordleGame';

export default React.memo(WordleGame);
