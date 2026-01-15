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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Settings as SettingsIcon,
    ContentCopy as CopyIcon
} from '@mui/icons-material';
import GameSettingsDialog from './GameSettingsDialog';

const HangmanResults = React.memo(({ results, onCopyToClipboard }) => {
    if (!results || (!results.letterSuggestions?.length && !results.possibleWords?.length)) {
        return null;
    }

    return (
        <Box sx={{ mt: 4 }}>
            <Grid container spacing={3}>
                {/* Possible Words */}
                <Grid size={{ xs: 12, md: results.letterSuggestions?.length > 0 ? 6 : 12 }}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Possible Words ({results.possibleWordsCount || results.possibleWords.length})
                                    </Typography>
                                </Box>
                                {results.possibleWords.length > 0 && (
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
                                    {results.possibleWords.map((word, index) => (
                                        <Box
                                            key={index}
                                            sx={{
                                                p: 1,
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
                            {results.possibleWords.length > 50 && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                                    Results may be truncated.
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* Letter Suggestions */}
                {results.letterSuggestions?.length > 0 && (
                    <Grid size={{ xs: 12, md: results.possibleWords?.length > 0 ? 6 : 12 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Letter Suggestions
                                    </Typography>
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
                                    <Grid container sx={{ p: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', fontWeight: 'bold' }}>
                                        <Grid size={{ xs: 2 }} sx={{ pl: 1 }}>Rank</Grid>
                                        <Grid size={{ xs: 2 }} sx={{ textAlign: 'center' }}>Letter</Grid>
                                        <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>ENT</Grid>
                                        <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>In Word %</Grid>
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
                                                <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
                                                    {suggestion.entropy !== null ? suggestion.entropy.toFixed(3) : '-'}
                                                </Grid>
                                                <Grid size={{ xs: 4 }} sx={{ textAlign: 'right', pr: 1 }}>
                                                    {suggestion.probability ? `${(suggestion.probability * 100).toFixed(1)}%` : '-'}
                                                </Grid>
                                            </Grid>
                                        ))}
                                    </Stack>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
});

const HangmanGame = ({ gameStatus, isLoading, onSolve, onClear, showError, results }) => {
    const [pattern, setPattern] = useState('????');
    const [excludedLetters, setExcludedLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        maxDepth: 1,
        excludeUncommonWords: true
    });

    const settingsFields = [
        {
            name: 'maxDepth',
            label: 'Solver Mode',
            type: 'select',
            options: [
                { value: 0, label: '0: Fastest' },
                { value: 1, label: '1: Balanced' },
                { value: 2, label: '2: Deep' }
            ]
        },
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        }
    ];

    const handlePatternChange = useCallback((e) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z? ]/g, '').toUpperCase();
        setPattern(cleanValue);
    }, []);

    const handleExcludedLettersChange = useCallback((e) => {
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
        setPattern('????');
        setExcludedLetters('');
        onClear();
    }, [onClear]);

    const handleCopyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text);
    }, []);

    // Get revealed and excluded letters for display
    const revealedLetters = [...new Set(pattern.replace(/[^A-Z]/g, '').split(''))];
    const excludedLettersList = [...new Set(excludedLetters.split(''))];

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
                            Hangman Solver
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Enter the word pattern using ? for unknown letters
                        </Typography>
                    </Box>

                    <Grid container spacing={3} justifyContent="center">
                        <Grid size={{ xs: 12, md: 8 }}>
                            <Stack spacing={3}>
                                {/* Guessed Letters Display */}
                                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
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
                                            <Typography variant="body2" color="text.secondary">(none)</Typography>
                                        )}
                                    </Box>
                                </Box>

                                {/* Pattern Input */}
                                <TextField
                                    label="Word Pattern (use ? for unknown letters)"
                                    value={pattern}
                                    onChange={handlePatternChange}
                                    fullWidth
                                    placeholder="e.g., ?A?? ???"
                                    helperText="Enter word patterns separated by spaces. Use ? for unknown letters."
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

                                {/* Action Button */}
                                <Button
                                    variant="contained"
                                    onClick={handleSolve}
                                    disabled={isLoading || gameStatus?.status !== 'available' || !pattern.trim()}
                                    startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                    fullWidth
                                    size="large"
                                    color="primary"
                                >
                                    Find Best Letter
                                </Button>

                            </Stack>
                        </Grid>
                    </Grid>

                    {/* Settings Dialog */}
                    <GameSettingsDialog
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onSave={setConfig}
                        title="Hangman Settings"
                        config={config}
                        fields={settingsFields}
                    />
                </CardContent>
            </Card>

            {/* Results Section */}
            <HangmanResults
                results={results}
                onCopyToClipboard={handleCopyToClipboard}
            />
        </>
    );
};

export default React.memo(HangmanGame);
