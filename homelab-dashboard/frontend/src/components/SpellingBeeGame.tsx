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
    mustIncludeFirstLetter?: boolean;
}

// Spelling Bee display component
const SpellingBeeDisplay = ({ letters, mustIncludeFirstLetter = true }: SpellingBeeDisplayProps) => {
    const padded = (letters || '').toUpperCase().padEnd(7, ' ');
    const letterArray = padded.split('');
    const centerLetter = letterArray[0];
    const outerLetters = letterArray.slice(1, 7);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 'auto', flexGrow: 1 }}>
            {/* Hexagon Layout */}
            <Box sx={{ position: 'relative', width: { xs: 220, sm: 280 }, height: { xs: 220, sm: 280 } }}>
                {/* Center Letter */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: { xs: 56, sm: 72 },
                        height: { xs: 48, sm: 62 },
                        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                        bgcolor: mustIncludeFirstLetter ? 'warning.main' : 'action.hover',
                        color: mustIncludeFirstLetter ? 'warning.contrastText' : 'text.primary',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: { xs: '1.5rem', sm: '1.8rem' },
                        fontWeight: 'bold',
                        filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))',
                        zIndex: 2
                    }}
                >
                    {centerLetter !== ' ' ? centerLetter : ''}
                </Box>

                {/* Outer Letters */}
                {outerLetters.map((letter, index) => {
                    // Offset angle by 30 degrees so flat edges align perfectly in honeycomb tiling
                    const angle = ((index * 60 + 30) * Math.PI) / 180;
                    return (
                        <Box
                            key={index}
                            sx={{
                                position: 'absolute',
                                top: {
                                    xs: `calc(50% + ${Math.round(56 * Math.sin(angle))}px)`,
                                    sm: `calc(50% + ${Math.round(74 * Math.sin(angle))}px)`
                                },
                                left: {
                                    xs: `calc(50% + ${Math.round(56 * Math.cos(angle))}px)`,
                                    sm: `calc(50% + ${Math.round(74 * Math.cos(angle))}px)`
                                },
                                transform: 'translate(-50%, -50%)',
                                width: { xs: 56, sm: 72 },
                                height: { xs: 48, sm: 62 },
                                clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                                bgcolor: 'action.hover',
                                color: 'text.primary',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                                fontWeight: 'bold',
                                filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.15))',
                                zIndex: 1
                            }}
                        >
                            {letter !== ' ' ? letter : ''}
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
    if (!results || !results.solutions || (results.solutions.length === 0 && !results.gameData)) return null;

    const { solutions, gameData } = results;
    const totalFound = gameData?.actualTotalFound || gameData?.totalSolutions || 0;
    const hasMore = solutions.length < totalFound;

    return (
        <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
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

                <TableContainer component={Paper} variant="outlined" sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
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
                                        {solution.toUpperCase()}
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
                        sx={{ mt: 2, alignSelf: 'flex-start', flexShrink: 0 }}
                        size="small"
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
    isSolving: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onCancel: () => void;
    onClear: () => void;
    showError: (message: string) => void;
    results: SpellingBeeResultState | null;
    onLoadMore: () => void;
}

const SpellingBeeGame = ({ gameStatus, isLoading, isSolving, onSolve, onCancel, onClear, showError, results, onLoadMore }: SpellingBeeGameProps) => {
    const [spellingBeeLetters, setSpellingBeeLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        preset: 1,
        excludeUncommonWords: false,
        mustIncludeFirstLetter: true,
        reuseLetters: true,
        allowAnyLength: false
    });

    const settingsFields: FieldDefinition[] = [
        {
            name: 'excludeUncommonWords',
            label: 'Exclude Uncommon Words',
            type: 'checkbox'
        },
        {
            name: 'preset',
            label: 'Preset',
            type: 'select',
            options: [
                { value: 1, label: 'Default' },
                { value: 2, label: 'Anagram Solver' },
                { value: 0, label: 'Custom' }
            ]
        },
        {
            name: 'allowAnyLength',
            label: 'Allow Any Number of Letters',
            type: 'checkbox',
            disabled: (cfg) => cfg.preset !== 0
        },
        {
            name: 'mustIncludeFirstLetter',
            label: 'Must Include Center Letter',
            type: 'checkbox',
            disabled: (cfg) => cfg.preset !== 0
        },
        {
            name: 'reuseLetters',
            label: 'Allow Letter Reuse',
            type: 'checkbox',
            disabled: (cfg) => cfg.preset !== 0
        }
    ];

    const handleSpellingBeeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const cleanValue = input.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
        setSpellingBeeLetters(cleanValue);
        requestAnimationFrame(() => {
            input.setSelectionRange(start, end);
        });
    }, []);

    const handleSolve = useCallback(async () => {
        const len = spellingBeeLetters.length;
        if (config.allowAnyLength) {
            if (len < 1) {
                showError('Please enter at least 1 letter');
                return;
            }
        } else {
            if (len !== 7) {
                showError('Please enter exactly 7 letters for Spelling Bee');
                return;
            }
        }

        const centerLetter = spellingBeeLetters.charAt(0);
        const outerLetters = spellingBeeLetters.slice(1);

        await onSolve('spellingbee', {
            centerLetter,
            outerLetters,
            minWordLength: 4,
            mustIncludeFirstLetter: config.mustIncludeFirstLetter,
            reuseLetters: config.reuseLetters,
            excludeUncommonWords: config.excludeUncommonWords,
            allowAnyLength: config.allowAnyLength,
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
        <Grid container spacing={2} sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0, flexGrow: 1 }}>
            {/* Controls & Honeycomb */}
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
                                Spelling Bee
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                {config.allowAnyLength 
                                    ? "Enter letters. The first letter is the Center (required) letter."
                                    : "Enter 7 letters. The first letter is the Center (required) letter."}
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, pt: 1.5, minHeight: 0 }}>
                            <TextField
                                fullWidth
                                label="Puzzle Letters (Center First)"
                                variant="outlined"
                                size="small"
                                value={spellingBeeLetters}
                                onChange={handleSpellingBeeChange}
                                placeholder="E.g., CENTERX"
                                disabled={isLoading}
                                slotProps={{ htmlInput: { maxLength: config.allowAnyLength ? undefined : 7, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: 'false', style: { fontFamily: 'monospace', letterSpacing: '0.1em' } } }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isLoading && gameStatus?.healthy) {
                                        const len = spellingBeeLetters.length;
                                        if (config.allowAnyLength ? len >= 1 : len === 7) {
                                            handleSolve();
                                        }
                                    }
                                }}
                            />

                             {config.allowAnyLength ? (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', my: 2 }}>
                                    {spellingBeeLetters.split('').map((letter, idx) => (
                                        <Paper
                                            key={idx}
                                            variant="outlined"
                                            sx={{
                                                width: 38,
                                                height: 38,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                bgcolor: (idx === 0 && config.mustIncludeFirstLetter) ? 'warning.main' : 'background.paper',
                                                color: (idx === 0 && config.mustIncludeFirstLetter) ? 'warning.contrastText' : 'text.primary',
                                                borderRadius: 1
                                            }}
                                        >
                                            {letter}
                                        </Paper>
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                                    <SpellingBeeDisplay letters={spellingBeeLetters} mustIncludeFirstLetter={config.mustIncludeFirstLetter} />
                                </Box>
                            )}
                        </Stack>

                        <Button
                            fullWidth
                            variant="contained"
                            size="medium"
                            onClick={isSolving ? onCancel : handleSolve}
                            disabled={!isSolving && (!gameStatus?.healthy || (config.allowAnyLength ? spellingBeeLetters.length < 1 : spellingBeeLetters.length !== 7))}
                            color={isSolving ? "error" : "primary"}
                            startIcon={isSolving ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            {isSolving ? 'Cancel' : 'Solve'}
                        </Button>

                        <GameSettingsDialog
                            open={settingsOpen}
                            onClose={() => setSettingsOpen(false)}
                            onSave={(newConfig: DialogConfig) => setConfig({
                                preset: Number(newConfig.preset),
                                excludeUncommonWords: Boolean(newConfig.excludeUncommonWords),
                                mustIncludeFirstLetter: Boolean(newConfig.mustIncludeFirstLetter),
                                reuseLetters: Boolean(newConfig.reuseLetters),
                                allowAnyLength: Boolean(newConfig.allowAnyLength)
                            })}
                            title="Spelling Bee Settings"
                            config={config}
                            fields={settingsFields}
                        />
                    </CardContent>
                </Card>
            </Grid>

            {/* Results */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 350, md: 0 } }}>
                {results && results.gameData ? (
                    <SpellingBeeResults
                        results={results}
                        onCopy={handleCopy}
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
        </Grid>
    );
};

export default React.memo(SpellingBeeGame);
