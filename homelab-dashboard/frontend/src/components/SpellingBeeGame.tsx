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
    IconButton,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import GameSettingsDialog, { FieldDefinition, DialogConfig } from './GameSettingsDialog';
import { SpellingBeeResultState, GameStatus } from '../types/api';

interface SpellingBeeDisplayProps {
    letters: string;
}

// Spelling Bee display component
const SpellingBeeDisplay = ({ letters }: SpellingBeeDisplayProps) => {
    const letterArray = letters.toUpperCase().split('');
    const centerLetter = letterArray[0];
    const outerLetters = letterArray.slice(1, 7);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            {/* Hexagon Layout */}
            <Box sx={{ position: 'relative', width: 220, height: 220 }}>
                {/* Center Letter */}
                {centerLetter && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            bgcolor: 'warning.main',
                            color: 'warning.contrastText',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem',
                            fontWeight: 'bold',
                            boxShadow: 3,
                            zIndex: 2
                        }}
                    >
                        {centerLetter}
                    </Box>
                )}

                {/* Outer Letters */}
                {outerLetters.map((letter, index) => {
                    const angle = (index * 60 * Math.PI) / 180;
                    const radius = 70; // Distance from center
                    const x = Math.round(radius * Math.cos(angle));
                    const y = Math.round(radius * Math.sin(angle));

                    return (
                        <Box
                            key={index}
                            sx={{
                                position: 'absolute',
                                top: `calc(50% + ${y}px)`,
                                left: `calc(50% + ${x}px)`,
                                transform: 'translate(-50%, -50%)',
                                width: 50,
                                height: 50,
                                borderRadius: '50%',
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                fontWeight: 'bold',
                                boxShadow: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                zIndex: 1
                            }}
                        >
                            {letter}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

interface SpellingBeeResultsProps {
    results: SpellingBeeResultState | null;
    onCopy: (text: string) => void;
    onLoadMore: () => void;
    isLoading: boolean;
}

const SpellingBeeResults = React.memo(({ results, onCopy, onLoadMore, isLoading }: SpellingBeeResultsProps) => {
    if (!results || !results.solutions || results.solutions.length === 0) return null;

    const { solutions, gameData } = results;
    const totalFound = gameData?.actualTotalFound || gameData?.totalSolutions || 0;
    const hasMore = solutions.length < totalFound;

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                        Solutions ({solutions.length}/{totalFound})
                    </Typography>
                    {solutions.length > 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => onCopy(solutions.join('\n'))}
                            startIcon={<CopyIcon />}
                        >
                            Copy All
                        </Button>
                    )}
                </Box>

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, overflowY: 'auto' }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Word</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Length</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Unique Letters</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {solutions.map((solution, index) => (
                                <TableRow
                                    key={index}
                                    hover
                                    onClick={() => onCopy(solution)}
                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                >
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                        {solution}
                                    </TableCell>
                                    <TableCell align="right">{solution.length}</TableCell>
                                    <TableCell align="right">{new Set(solution.split('')).size}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                {hasMore && (
                    <Button
                        variant="contained"
                        onClick={onLoadMore}
                        disabled={isLoading}
                        sx={{ mt: 2 }}
                    >
                        Load More
                    </Button>
                )}
            </CardContent>
        </Card>
    );
});

SpellingBeeResults.displayName = 'SpellingBeeResults';

interface SpellingBeeGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: SpellingBeeResultState | null;
    onLoadMore: () => void;
}

const SpellingBeeGame = ({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }: SpellingBeeGameProps) => {
    const [spellingBeeLetters, setSpellingBeeLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        excludeUncommonWords: false,
        mustIncludeFirstLetter: true,
        reuseLetters: true
    });

    const settingsFields: FieldDefinition[] = [
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        },
        {
            name: 'mustIncludeFirstLetter',
            label: 'Must Include First Letter',
            type: 'checkbox'
        },
        {
            name: 'reuseLetters',
            label: 'Allow Letter Reuse',
            type: 'checkbox'
        }
    ];

    const handleSpellingBeeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '');
        setSpellingBeeLetters(cleanValue);
    }, []);

    const handleSolve = useCallback(async () => {
        if (!spellingBeeLetters.trim() || spellingBeeLetters.length < 3) {
            showError('Please enter at least 3 letters for Spelling Bee');
            return;
        }

        await onSolve('spellingbee', {
            letters: spellingBeeLetters.trim(),
            excludeUncommonWords: config.excludeUncommonWords,
            mustIncludeFirstLetter: config.mustIncludeFirstLetter,
            reuseLetters: config.reuseLetters,
            start: 0,
            end: 100
        });
    }, [spellingBeeLetters, config, onSolve, showError]);

    const handleCopy = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const handleLocalClear = useCallback(() => {
        setSpellingBeeLetters('');
        onClear();
    }, [onClear]);

    return (
        <>
            <Card>
                <CardContent>
                    {/* Top Controls */}
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Button variant="outlined" onClick={handleLocalClear} disabled={isLoading} size="small">
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
                            Spelling Bee Solver
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Enter the 7 letters from your puzzle. The first letter is the Center (required) letter.
                        </Typography>
                    </Box>

                    {/* Honeycomb Display */}
                    {spellingBeeLetters.length > 0 && (
                        <SpellingBeeDisplay letters={spellingBeeLetters} />
                    )}

                    <Grid container spacing={2} sx={{ mt: 2 }}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                label="Puzzle Letters (Center First)"
                                variant="outlined"
                                value={spellingBeeLetters}
                                onChange={handleSpellingBeeChange}
                                placeholder="E.g., CENTERX"
                                disabled={isLoading}
                                slotProps={{ htmlInput: { maxLength: 7, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: 'false' } }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handleSolve}
                                disabled={isLoading || spellingBeeLetters.length < 3 || gameStatus?.status !== 'available'}
                                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                            >
                                {isLoading ? 'Solving...' : 'Solve Puzzle'}
                            </Button>
                        </Grid>
                    </Grid>

                    <GameSettingsDialog
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onSave={(newConfig: DialogConfig) => setConfig({
                            excludeUncommonWords: Boolean(newConfig.excludeUncommonWords),
                            mustIncludeFirstLetter: Boolean(newConfig.mustIncludeFirstLetter),
                            reuseLetters: Boolean(newConfig.reuseLetters)
                        })}
                        title="Spelling Bee Settings"
                        config={config}
                        fields={settingsFields}
                    />
                </CardContent>
            </Card>

            {/* Results Table */}
            {results && (
                <SpellingBeeResults
                    results={results}
                    onCopy={handleCopy}
                    onLoadMore={onLoadMore}
                    isLoading={isLoading}
                />
            )}
        </>
    );
};

export default React.memo(SpellingBeeGame);
