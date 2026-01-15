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
    Paper,
    Divider
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import GameSettingsDialog from './GameSettingsDialog';

// Spelling Bee display component
const SpellingBeeDisplay = ({ letters }) => {
    const letterArray = letters.toUpperCase().split('');
    const centerLetter = letterArray[0];
    const outerLetters = letterArray.slice(1, 7);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <Box sx={{
                position: 'relative', width: 220, height: 220,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {/* Center Hexagon - Flat Top */}
                <Box sx={{
                    position: 'absolute', width: 70, height: 60,
                    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '1.5rem',
                    zIndex: 2,
                    boxShadow: 3
                }}>
                    {centerLetter || '?'}
                </Box>

                {/* Outer Hexagons - Flat Top */}
                {outerLetters.map((letter, i) => {
                    // Adjust angles for flat-top stacking (vertical alignment)
                    // We want neighbors at 30, 90, 150, 210, 270, 330 degrees
                    const angle = (i * 60 - 30) * (Math.PI / 180);
                    const radius = 75;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    return (
                        <Box key={i} sx={{
                            position: 'absolute', width: 70, height: 60,
                            left: `calc(50% + ${x}px - 35px)`,
                            top: `calc(50% + ${y}px - 30px)`,
                            clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
                            backgroundColor: 'action.selected',
                            color: 'text.primary',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', fontSize: '1.5rem',
                            border: '1px solid transparent', // clip-path hides border, but keeping for sizing structure
                        }}>
                            {letter}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

const SpellingBeeResults = ({ results, onCopy, onLoadMore, isLoading }) => {
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
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
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
};

const SpellingBeeGame = ({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }) => {
    const [spellingBeeLetters, setSpellingBeeLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        excludeUncommonWords: false,
        mustIncludeFirstLetter: true,
        reuseLetters: true
    });

    const settingsFields = [
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

    const handleSpellingBeeChange = useCallback((e) => {
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

    const handleClear = useCallback(() => {
        setSpellingBeeLetters('');
        onClear();
    }, [onClear]);

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
                            Spelling Bee
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Enter letters (minimum 3, duplicates allowed, first letter is special)
                        </Typography>
                    </Box>

                    {/* Input Field */}
                    <Grid container spacing={3} justifyContent="center" sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <TextField
                                label="Enter letters (first is center/special)"
                                value={spellingBeeLetters}
                                onChange={handleSpellingBeeChange}
                                fullWidth
                                helperText={`${spellingBeeLetters.length} letters entered (minimum 3)`}
                                autoCorrect="off"
                                autoComplete="off"
                                slotProps={{
                                    htmlInput: {
                                        autoComplete: 'off',
                                        autoCorrect: 'off',
                                        autoCapitalize: 'off',
                                        spellCheck: 'false',
                                        style: {
                                            textAlign: 'center',
                                            fontSize: '1.2rem',
                                            fontWeight: 'bold',
                                            letterSpacing: '3px',
                                            textTransform: 'uppercase'
                                        },
                                    }
                                }}

                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSolve();
                                    }
                                }}
                            />
                        </Grid>
                    </Grid>

                    {/* Spelling Bee Display */}
                    <SpellingBeeDisplay letters={spellingBeeLetters} />

                    <Grid container spacing={3} justifyContent="center">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handleSolve}
                                disabled={isLoading || spellingBeeLetters.length < 3}
                                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayIcon />}
                            >
                                {isLoading ? 'Solving...' : 'Solve Puzzle'}
                            </Button>
                        </Grid>
                    </Grid>

                    <GameSettingsDialog
                        open={settingsOpen}
                        onClose={() => setSettingsOpen(false)}
                        onSave={setConfig}
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
                    onCopy={(text) => navigator.clipboard.writeText(text)}
                    onLoadMore={onLoadMore}
                    isLoading={isLoading}
                />
            )}
        </>
    );
};

export default React.memo(SpellingBeeGame);
