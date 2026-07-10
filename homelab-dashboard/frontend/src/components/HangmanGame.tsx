import React, { useState, useCallback } from 'react';
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
    Chip,
    IconButton,
    Tooltip,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import GameSettingsDialog, { DialogConfig, FieldDefinition } from './GameSettingsDialog';
import { HangmanResultState, GameStatus } from '../types/api';

interface HangmanResultsProps {
    results: HangmanResultState | null;
    onCopyToClipboard: (text: string) => void;
    onLoadMore?: (type: string) => void;
    isLoading?: boolean;
}

const HangmanResults = React.memo(({ results, onCopyToClipboard, onLoadMore, isLoading }: HangmanResultsProps) => {
    const [tabVal, setTabVal] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabVal(newValue);
    };

    const formatRoundedNum = (num: number) => {
        if (num === 0) return '0.00';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    if (!results || (!results.letterSuggestions?.length && !results.possibleWords?.length && !results.gameData)) {
        return null;
    }

    const showSuggestions = results.letterSuggestions && results.letterSuggestions.length > 0;
    const showPossible = results.possibleWords && results.possibleWords.length > 0;

    return (
        <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <Tabs value={tabVal} onChange={handleTabChange} aria-label="hangman results tabs">
                    <Tab label="Letter Suggestions" />
                    <Tab label={`Possible Words (${results.possibleWords.length}/${results.gameData?.possibleWordsCount || results.possibleWords.length})`} />
                </Tabs>
                {tabVal === 1 && showPossible && (
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => onCopyToClipboard(results.possibleWords.join('\n'))}
                        startIcon={<CopyIcon />}
                    >
                        Copy
                    </Button>
                )}
            </Box>
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {tabVal === 0 && (
                    showSuggestions ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '100%' }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Rank</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Letter</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>ENT</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>WNT</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {results.letterSuggestions.map((suggestion, index) => (
                                                <TableRow key={index} hover>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell align="center" sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                                        {suggestion.letter.toUpperCase()}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {suggestion.probability !== null ? `${formatRoundedNum(suggestion.probability * 100)}%` : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {suggestion.entropy !== null && suggestion.entropy !== undefined && !isNaN(Number(suggestion.entropy)) ? formatRoundedNum(Number(suggestion.entropy)) : '-'}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {suggestion.wnt !== null && suggestion.wnt !== undefined && !isNaN(Number(suggestion.wnt)) ? formatRoundedNum(Number(suggestion.wnt)) : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            No letter suggestions available.
                        </Typography>
                    )
                )}
                {tabVal === 1 && (
                    showPossible ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <Box sx={{ flexGrow: 1, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, minHeight: 0 }}>
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '100%' }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Word</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {results.possibleWords.map((word, index) => (
                                                <TableRow key={index} hover>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                                        {word.toUpperCase()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                            {results.gameData && results.gameData.isLimited && results.possibleWords.length < (results.gameData.possibleWordsCount || 0) && (
                                <Button
                                    variant="contained"
                                    onClick={() => onLoadMore && onLoadMore('possible')}
                                    disabled={isLoading}
                                    sx={{ mt: 2, alignSelf: 'flex-start' }}
                                    size="small"
                                >
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
});

HangmanResults.displayName = 'HangmanResults';

interface HangmanGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: HangmanResultState | null;
    onLoadMore?: (type: string) => void;
}

const HangmanGame = ({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }: HangmanGameProps) => {
    const [pattern, setPattern] = useState('');
    const [excludedLetters, setExcludedLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        maxDepth: 1,
        maxGuesses: 6,
        excludeUncommonWords: true
    });

    const settingsFields: FieldDefinition[] = [
        {
            name: 'maxDepth',
            label: 'Search Depth',
            type: 'number',
            min: 0,
            max: 2
        },
        {
            name: 'maxGuesses',
            label: 'Maximum Strikes Allowed',
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

    const handlePatternChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const cleanValue = input.value.toUpperCase().replace(/[^A-Z_? ]/g, '');
        setPattern(cleanValue);
        requestAnimationFrame(() => {
            input.setSelectionRange(start, end);
        });
    }, []);

    const handleExcludedLettersChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const cleanValue = input.value.toUpperCase().replace(/[^A-Z]/g, '');
        setExcludedLetters(cleanValue);
        requestAnimationFrame(() => {
            input.setSelectionRange(start, end);
        });
    }, []);

    const handleSolve = useCallback(async () => {
        if (!pattern.trim()) {
            showError('Please enter a word pattern');
            return;
        }

        await onSolve('hangman', {
            pattern: pattern.trim(),
            excludedLetters: excludedLetters.trim(),
            maxDepth: config.maxDepth,
            maxGuesses: config.maxGuesses,
            excludeUncommonWords: config.excludeUncommonWords,
            start: 0,
            end: 100
        });
    }, [pattern, excludedLetters, config, onSolve, showError]);

    const handleClear = useCallback(() => {
        setPattern('');
        setExcludedLetters('');
        onClear();
    }, [onClear]);

    const handleCopyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    // Get revealed and excluded letters for display
    const revealedLetters = [...new Set(pattern.replace(/[^A-Z]/g, '').split(''))];
    const excludedLettersList = [...new Set(excludedLetters.split(''))];

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
                                Hangman Solver
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Enter your word pattern and excluded letters to find the best letter suggestions.
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, minHeight: 0 }}>
                            {/* Guessed Letters Display */}
                            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Guessed Letters:</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {revealedLetters.length > 0 ? (
                                        revealedLetters.map((letter, index) => (
                                            <Chip
                                                key={`revealed-${index}`}
                                                label={`+${letter}`}
                                                color="success"
                                                size="small"
                                            />
                                        ))
                                    ) : null}
                                    {excludedLettersList.length > 0 ? (
                                        excludedLettersList.map((letter, index) => (
                                            <Chip
                                                key={`excluded-${index}`}
                                                label={`-${letter}`}
                                                color="error"
                                                size="small"
                                            />
                                        ))
                                    ) : null}
                                    {revealedLetters.length === 0 && excludedLettersList.length === 0 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>(none)</Typography>
                                    )}
                                </Box>
                            </Box>

                            {/* Pattern Input */}
                            <TextField
                                label="Word Pattern (use _ for unknown letters)"
                                value={pattern}
                                onChange={handlePatternChange}
                                fullWidth
                                placeholder="e.g., _A__ ___"
                                helperText="Enter word patterns separated by spaces. Use _ for unknown letters."
                                slotProps={{
                                    input: {
                                        style: {
                                            fontFamily: 'monospace',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            letterSpacing: '3px',
                                            textTransform: 'uppercase'
                                        }
                                    },
                                    htmlInput: {
                                        autoComplete: 'off',
                                        autoCorrect: 'off',
                                        autoCapitalize: 'off',
                                        spellCheck: 'false'
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSolve();
                                    }
                                }}
                            />

                            {/* Excluded Letters Input */}
                            <TextField
                                label="Letters NOT in the word"
                                value={excludedLetters}
                                onChange={handleExcludedLettersChange}
                                fullWidth
                                placeholder="e.g., RSTLNE"
                                helperText="Enter letters that have been guessed and are NOT in the word"
                                slotProps={{
                                    input: {
                                        style: {
                                            fontFamily: 'monospace',
                                            fontSize: '1.1rem',
                                            letterSpacing: '2px',
                                            textTransform: 'uppercase'
                                        }
                                    },
                                    htmlInput: {
                                        autoComplete: 'off',
                                        autoCorrect: 'off',
                                        autoCapitalize: 'off',
                                        spellCheck: 'false'
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSolve();
                                    }
                                }}
                            />
                        </Stack>

                        <Button
                            variant="contained"
                            onClick={handleSolve}
                            disabled={isLoading || !gameStatus?.healthy || !pattern.trim()}
                            startIcon={isLoading ? <CircularProgress size={16} /> : <PlayIcon />}
                            fullWidth
                            size="medium"
                            color="primary"
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            Find Best Letter
                        </Button>
                    </CardContent>
                </Card>
            </Grid>

            {/* Results Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 350, md: 0 } }}>
                {results && results.gameData ? (
                    <HangmanResults
                        results={results}
                        onCopyToClipboard={handleCopyToClipboard}
                        onLoadMore={onLoadMore}
                        isLoading={isLoading}
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
                onSave={(newConfig: DialogConfig) => setConfig({
                    maxDepth: Number(newConfig.maxDepth),
                    maxGuesses: Number(newConfig.maxGuesses) || 6,
                    excludeUncommonWords: Boolean(newConfig.excludeUncommonWords)
                })}
                title="Hangman Settings"
                config={config}
                fields={settingsFields}
            />
        </Grid>
    );
};

export default React.memo(HangmanGame);
