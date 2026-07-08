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
    Tab
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
        if (num === 0) return '0.0';
        if (num > 0 && num.toFixed(2) === '0.00') return '<0.01';
        return `${num.toFixed(2)}`;
    };

    if (!results || (!results.letterSuggestions?.length && !results.possibleWords?.length && !results.gameData)) {
        return null;
    }

    const showSuggestions = results.letterSuggestions && results.letterSuggestions.length > 0;
    const showPossible = results.possibleWords && results.possibleWords.length > 0;

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                                <Grid container sx={{ p: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 'bold', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <Grid size={{ xs: 2 }} sx={{ pl: 1 }}>Rank</Grid>
                                    <Grid size={{ xs: 2 }} sx={{ textAlign: 'center' }}>Letter</Grid>
                                    <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>Probability</Grid>
                                    <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>ENT</Grid>
                                </Grid>
                                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                                    {results.letterSuggestions.map((suggestion, index) => (
                                        <Grid
                                            container
                                            key={index}
                                            sx={{
                                                p: 1,
                                                alignItems: 'center',
                                                '&:hover': { bgcolor: 'action.hover' }
                                            }}
                                        >
                                            <Grid size={{ xs: 2 }} sx={{ pl: 1 }}>
                                                {index + 1}
                                            </Grid>
                                            <Grid size={{ xs: 2 }} sx={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                {suggestion.letter}
                                            </Grid>
                                            <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>
                                                {suggestion.probability !== null ? `${formatRoundedNum(suggestion.probability * 100)}%` : '-'}
                                            </Grid>
                                            <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
                                                {suggestion.entropy !== null && suggestion.entropy !== undefined && !isNaN(Number(suggestion.entropy)) ? formatRoundedNum(Number(suggestion.entropy)) : '-'}
                                            </Grid>
                                        </Grid>
                                    ))}
                                </Stack>
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
                                <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
                                    {results.possibleWords.map((word, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                p: 1.5,
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
        excludeUncommonWords: true
    });

    const settingsFields: FieldDefinition[] = [
        {
            name: 'maxDepth',
            label: 'Solver Mode',
            type: 'number',
            min: 0,
            max: 2
        },
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        }
    ];

    const handlePatternChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        // Accept both ? and _ as unknown characters, normalize to _
        const cleanValue = e.target.value.replace(/[^a-zA-Z?_ ]/g, '').replace(/\?/g, '_').toUpperCase();
        setPattern(cleanValue);
    }, []);

    const handleExcludedLettersChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setExcludedLetters(cleanValue);
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
                                InputProps={{
                                    style: {
                                        fontFamily: 'monospace',
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        letterSpacing: '3px',
                                        textTransform: 'uppercase'
                                    }
                                }}
                                inputProps={{
                                    autoComplete: 'off',
                                    autoCorrect: 'off',
                                    autoCapitalize: 'off',
                                    spellCheck: 'false'
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
                                InputProps={{
                                    style: {
                                        fontFamily: 'monospace',
                                        fontSize: '1.1rem',
                                        letterSpacing: '2px',
                                        textTransform: 'uppercase'
                                    }
                                }}
                                inputProps={{
                                    autoComplete: 'off',
                                    autoCorrect: 'off',
                                    autoCapitalize: 'off',
                                    spellCheck: 'false'
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
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {results && results.gameData ? (
                    <HangmanResults
                        results={results}
                        onCopyToClipboard={handleCopyToClipboard}
                        onLoadMore={onLoadMore}
                        isLoading={isLoading}
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

            {/* Settings Dialog */}
            <GameSettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onSave={(newConfig: DialogConfig) => setConfig({
                    maxDepth: Number(newConfig.maxDepth),
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
