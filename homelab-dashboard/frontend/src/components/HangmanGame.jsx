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
import { PlayArrow as PlayIcon, Settings as SettingsIcon } from '@mui/icons-material';
import GameSettingsDialog from './GameSettingsDialog';

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
                { value: 0, label: 'Fast (Depth 0)' },
                { value: 1, label: 'Balanced (Depth 1)' },
                { value: 2, label: 'High Accuracy (Depth 2)' }
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

    // Get revealed and excluded letters for display
    const revealedLetters = [...new Set(pattern.replace(/[^A-Z]/g, '').split(''))];
    const excludedLettersList = [...new Set(excludedLetters.split(''))];

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
                                slotProps={{
                                    htmlInput: {
                                        style: {
                                            fontFamily: 'monospace',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            letterSpacing: '3px',
                                            textTransform: 'uppercase'
                                        },
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
                                    htmlInput: {
                                        style: {
                                            fontFamily: 'monospace',
                                            fontSize: '1.1rem',
                                            letterSpacing: '2px',
                                            textTransform: 'uppercase'
                                        },
                                        autoComplete: 'off',
                                        autoCorrect: 'off',
                                        autoCapitalize: 'off',
                                        spellCheck: 'false'
                                    }
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

                            {/* Results - Letter Suggestions */}
                            {results?.letterSuggestions && results.letterSuggestions.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Letter Suggestions
                                    </Typography>
                                    <TableContainer component={Paper}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Rank</TableCell>
                                                    <TableCell>Letter</TableCell>
                                                    <TableCell align="right">ENT Score</TableCell>
                                                    <TableCell align="right">In Word %</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {results.letterSuggestions.slice(0, 20).map((suggestion, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell>
                                                            <Typography variant="body1" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                                                                {suggestion.letter}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {suggestion.entropy?.toFixed(3) || '-'}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {suggestion.probability ? `${(suggestion.probability * 100).toFixed(1)}%` : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}

                            {/* Results - Possible Words */}
                            {results?.possibleWords && results.possibleWords.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 2 }}>
                                        Possible Phrases ({results.possibleWordsCount || results.possibleWords.length})
                                    </Typography>
                                    <Box sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 1,
                                        p: 2,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        maxHeight: 200,
                                        overflow: 'auto'
                                    }}>
                                        {results.possibleWords.slice(0, 50).map((word, index) => (
                                            <Chip
                                                key={index}
                                                label={word}
                                                variant="outlined"
                                                size="small"
                                                sx={{ fontFamily: 'monospace' }}
                                            />
                                        ))}
                                        {results.possibleWords.length > 50 && (
                                            <Typography variant="body2" color="text.secondary">
                                                ... and {results.possibleWords.length - 50} more
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            )}
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
    );
};

export default React.memo(HangmanGame);
