import React, { useState, useCallback, useMemo } from 'react';
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { LetterBoxedResultState, GameStatus } from '../types/api';

interface LetterBoxedGridProps {
    letters: string;
}

// Letter grid display component
const LetterBoxedGrid = ({ letters }: LetterBoxedGridProps) => {
    const formatLetters = (lettersVal: string) => {
        const padded = (lettersVal || '').toUpperCase().padEnd(12, ' ');
        const letterArray = padded.split('');

        return [
            letterArray.slice(0, 3),
            letterArray.slice(3, 6),
            letterArray.slice(6, 9),
            letterArray.slice(9, 12)
        ];
    };

    const sides = formatLetters(letters);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <Box
                component="svg"
                viewBox="0 0 240 240"
                sx={{
                    width: 240,
                    height: 240,
                    overflow: 'visible'
                }}
            >
                {/* Central Square */}
                <rect
                    x="50"
                    y="50"
                    width="140"
                    height="140"
                    fill="none"
                    stroke="#1976d2"
                    strokeWidth="3"
                />

                {/* Top Side (0, 1, 2) */}
                {sides[0]?.map((letter, i) => {
                    const x = 75 + i * 45;
                    return (
                        <g key={`top-${i}`}>
                            <circle cx={x} cy="50" r="5" fill="#1976d2" />
                            <text x={x} y="32" fill="currentColor" textAnchor="middle" style={{ fontWeight: 'bold', fontSize: '15px', fontFamily: 'sans-serif' }}>{letter !== ' ' ? letter : ''}</text>
                        </g>
                    );
                })}

                {/* Right Side (3, 4, 5) */}
                {sides[1]?.map((letter, i) => {
                    const y = 75 + i * 45;
                    return (
                        <g key={`right-${i}`}>
                            <circle cx="190" cy={y} r="5" fill="#1976d2" />
                            <text x="208" y={y + 5} fill="currentColor" textAnchor="start" style={{ fontWeight: 'bold', fontSize: '15px', fontFamily: 'sans-serif' }}>{letter !== ' ' ? letter : ''}</text>
                        </g>
                    );
                })}

                {/* Bottom Side (6, 7, 8) */}
                {sides[2]?.map((letter, i) => {
                    const x = 75 + i * 45;
                    return (
                        <g key={`bottom-${i}`}>
                            <circle cx={x} cy="190" r="5" fill="#1976d2" />
                            <text x={x} y="214" fill="currentColor" textAnchor="middle" style={{ fontWeight: 'bold', fontSize: '15px', fontFamily: 'sans-serif' }}>{letter !== ' ' ? letter : ''}</text>
                        </g>
                    );
                })}

                {/* Left Side (9, 10, 11) */}
                {sides[3]?.map((letter, i) => {
                    const y = 75 + i * 45;
                    return (
                        <g key={`left-${i}`}>
                            <circle cx="50" cy={y} r="5" fill="#1976d2" />
                            <text x="32" y={y + 5} fill="currentColor" textAnchor="end" style={{ fontWeight: 'bold', fontSize: '15px', fontFamily: 'sans-serif' }}>{letter !== ' ' ? letter : ''}</text>
                        </g>
                    );
                })}
            </Box>
        </Box>
    );
};

interface LetterBoxedResultsProps {
    solutions: string[];
    lastGameData: {
        letters: string;
        config: number;
        totalSolutions: number;
        actualTotalFound: number;
        isLimited: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
    isLoading: boolean;
    onLoadMore: (type: string) => void;
    onCopyToClipboard: (text: string) => void;
}

const LetterBoxedResults = React.memo(({
    solutions,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard
}: LetterBoxedResultsProps) => {
    const copySolutions = () => {
        const solutionsText = solutions.join('\n');
        onCopyToClipboard(solutionsText);
    };

    if (!solutions || (solutions.length === 0 && !lastGameData)) return null;

    const totalSolutionsCount = lastGameData?.actualTotalFound || lastGameData?.totalSolutions || 0;

    return (
        <Card sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', minHeight: 0, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                        Solutions ({solutions.length}/{totalSolutionsCount})
                    </Typography>
                    {solutions.length > 0 && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={copySolutions}
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
                                <TableCell sx={{ fontWeight: 'bold' }}>Solution</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Words</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Letters</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Unique</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {solutions.map((sol, index) => {
                                const words = sol.split(' ');
                                const lettersCount = sol.replace(/\s/g, '').length;
                                const uniqueLettersCount = new Set(sol.replace(/\s/g, '').toLowerCase().split('')).size;
                                return (
                                    <TableRow
                                        key={index}
                                        hover
                                        onClick={() => onCopyToClipboard(sol)}
                                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                    >
                                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
                                            {sol.toUpperCase()}
                                        </TableCell>
                                        <TableCell align="right">{words.length}</TableCell>
                                        <TableCell align="right">{lettersCount}</TableCell>
                                        <TableCell align="right">{uniqueLettersCount}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

                {lastGameData && lastGameData.isLimited && solutions.length < totalSolutionsCount && (
                    <Button
                        variant="contained"
                        onClick={() => onLoadMore('results')}
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

LetterBoxedResults.displayName = 'LetterBoxedResults';

interface PresetConfig {
    maxDepth: number;
    minWordLength: number;
    minUniqueLetters: number;
    pruneRedundantPaths: boolean;
    pruneDominatedClasses: boolean;
}

interface GameConfig extends PresetConfig {
    preset: number;
}

interface LetterBoxedGameProps {
    gameStatus: GameStatus | null;
    isLoading: boolean;
    onSolve: (gameType: string, params: unknown) => Promise<void>;
    onClear: () => void;
    showError: (message: string) => void;
    results: LetterBoxedResultState | null;
    onLoadMore: (type: string) => void;
}

const LetterBoxedGame = ({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }: LetterBoxedGameProps) => {
    const [letterBoxedLetters, setLetterBoxedLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState<GameConfig>({
        preset: 1,
        maxDepth: 2,
        minWordLength: 3,
        minUniqueLetters: 2,
        pruneRedundantPaths: true,
        pruneDominatedClasses: false
    });
    const [tempConfig, setTempConfig] = useState<GameConfig>(config);

    // Preset configurations
    const presetConfigs = useMemo<Record<number, PresetConfig>>(() => ({
        1: { maxDepth: 2, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: true, pruneDominatedClasses: false },
        2: { maxDepth: 2, minWordLength: 4, minUniqueLetters: 3, pruneRedundantPaths: true, pruneDominatedClasses: true },
        3: { maxDepth: 3, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: false, pruneDominatedClasses: false }
    }), []);

    const getCurrentConfig = useCallback((): GameConfig => {
        if (config.preset === 0) {
            return config;
        }
        return { ...presetConfigs[config.preset], preset: config.preset };
    }, [config, presetConfigs]);

    const handleLetterBoxedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '');
        setLetterBoxedLetters(cleanValue);
    }, []);

    const handleSolve = useCallback(async () => {
        if (!letterBoxedLetters.trim()) {
            showError('Please enter letters for Letter Boxed');
            return;
        }

        const currentConfig = getCurrentConfig();
        const requestData: Record<string, unknown> = {
            letters: letterBoxedLetters.trim(),
            preset: config.preset,
            start: 0,
            end: 100
        };

        if (config.preset === 0) {
            requestData.maxDepth = currentConfig.maxDepth;
            requestData.minWordLength = currentConfig.minWordLength;
            requestData.minUniqueLetters = currentConfig.minUniqueLetters;
            requestData.pruneRedundantPaths = currentConfig.pruneRedundantPaths ? 1 : 0;
            requestData.pruneDominatedClasses = currentConfig.pruneDominatedClasses ? 1 : 0;
        }

        await onSolve('letterboxed', requestData);
    }, [letterBoxedLetters, config, getCurrentConfig, onSolve, showError]);

    const handleClear = useCallback(() => {
        setLetterBoxedLetters('');
        onClear();
    }, [onClear]);

    const handleCopyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const isCustom = tempConfig.preset === 0;

    const handleOpenSettings = () => {
        setTempConfig(config);
        setSettingsOpen(true);
    };

    const handleTempConfigChange = (field: keyof GameConfig, value: number | boolean) => {
        setTempConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePresetChange = (preset: number) => {
        if (preset === 0) {
            setTempConfig(prev => ({
                ...prev,
                preset: 0
            }));
        } else {
            const pConfig = presetConfigs[preset];
            setTempConfig({
                preset,
                ...pConfig
            });
        }
    };

    const handleSaveSettings = () => {
        setConfig(tempConfig);
        setSettingsOpen(false);
    };

    return (
        <Grid container spacing={2} sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0, flexGrow: 1 }}>
            {/* Input & Control Column */}
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
                        {/* Control Buttons */}
                        <Stack direction="row" spacing={1} sx={{ mb: 0.5 }} justifyContent="space-between" alignItems="center" flexShrink={0}>
                            <Button variant="outlined" onClick={handleClear} disabled={isLoading} size="small">
                                New Game
                            </Button>
                            <Tooltip title="Settings">
                                <IconButton onClick={handleOpenSettings} size="small">
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Box sx={{ mb: 0.5, flexShrink: 0 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Letter Boxed
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Enter 12 letters from the puzzle sides (3 per side).
                            </Typography>
                        </Box>

                        <Stack spacing={2} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, pt: 1.5, minHeight: 0 }}>
                            <TextField
                                fullWidth
                                label="Puzzle Letters (12 letters)"
                                variant="outlined"
                                size="small"
                                value={letterBoxedLetters}
                                onChange={handleLetterBoxedChange}
                                placeholder="E.g., ABCDEFGHIJKL"
                                disabled={isLoading}
                                slotProps={{ htmlInput: { maxLength: 12, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: 'false', style: { fontFamily: 'monospace', letterSpacing: '0.1em' } } }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isLoading && letterBoxedLetters.length === 12 && gameStatus?.healthy) {
                                        handleSolve();
                                    }
                                }}
                            />

                            {/* Box Display */}
                            <Box sx={{ flexShrink: 0 }}>
                                <LetterBoxedGrid letters={letterBoxedLetters} />
                            </Box>
                        </Stack>

                        <Button
                            fullWidth
                            variant="contained"
                            size="medium"
                            onClick={handleSolve}
                            disabled={isLoading || letterBoxedLetters.length !== 12 || !gameStatus?.healthy}
                            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                            sx={{ mt: 1.5, flexShrink: 0 }}
                        >
                            {isLoading ? 'Solving...' : 'Solve'}
                        </Button>

                        {/* Custom Settings Dialog */}
                        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="xs" fullWidth>
                            <DialogTitle>Letter Boxed Settings</DialogTitle>
                            <DialogContent>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Solver Preset</InputLabel>
                                        <Select
                                            value={tempConfig.preset}
                                            label="Solver Preset"
                                            onChange={(e) => handlePresetChange(Number(e.target.value))}
                                        >
                                            <MenuItem value={1}>1: Default (Depth 2)</MenuItem>
                                            <MenuItem value={2}>2: Fast (Depth 2 + Pruning)</MenuItem>
                                            <MenuItem value={3}>3: Thorough (Depth 3)</MenuItem>
                                            <MenuItem value={0}>Custom</MenuItem>
                                        </Select>
                                    </FormControl>

                                    <Divider />

                                    <Box>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Custom Settings {!isCustom && '(read-only)'}
                                        </Typography>

                                        <Grid container spacing={1.5}>
                                            <Grid size={12}>
                                                <TextField
                                                    label="Max Depth (Words)"
                                                    type="number"
                                                    size="small"
                                                    value={tempConfig.maxDepth}
                                                    onChange={(e) => handleTempConfigChange('maxDepth', parseInt(e.target.value) || 0)}
                                                    fullWidth
                                                    disabled={!isCustom}
                                                    slotProps={{ htmlInput: { min: 1, max: 5 } }}
                                                />
                                            </Grid>
                                            <Grid size={6}>
                                                <TextField
                                                    label="Min Word Length"
                                                    type="number"
                                                    size="small"
                                                    value={tempConfig.minWordLength}
                                                    onChange={(e) => handleTempConfigChange('minWordLength', parseInt(e.target.value) || 0)}
                                                    fullWidth
                                                    disabled={!isCustom}
                                                    slotProps={{ htmlInput: { min: 3, max: 15 } }}
                                                />
                                            </Grid>
                                            <Grid size={6}>
                                                <TextField
                                                    label="Min Unique Letters"
                                                    type="number"
                                                    size="small"
                                                    value={tempConfig.minUniqueLetters}
                                                    onChange={(e) => handleTempConfigChange('minUniqueLetters', parseInt(e.target.value) || 0)}
                                                    fullWidth
                                                    disabled={!isCustom}
                                                    slotProps={{ htmlInput: { min: 1, max: 12 } }}
                                                />
                                            </Grid>
                                            <Grid size={6}>
                                                <FormControl fullWidth size="small" disabled={!isCustom}>
                                                    <InputLabel>Prune Paths</InputLabel>
                                                    <Select
                                                        value={tempConfig.pruneRedundantPaths ? 1 : 0}
                                                        label="Prune Paths"
                                                        onChange={(e) => handleTempConfigChange('pruneRedundantPaths', e.target.value === 1)}
                                                    >
                                                        <MenuItem value={1}>Yes</MenuItem>
                                                        <MenuItem value={0}>No</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid size={6}>
                                                <FormControl fullWidth size="small" disabled={!isCustom}>
                                                    <InputLabel>Prune Classes</InputLabel>
                                                    <Select
                                                        value={tempConfig.pruneDominatedClasses ? 1 : 0}
                                                        label="Prune Classes"
                                                        onChange={(e) => handleTempConfigChange('pruneDominatedClasses', e.target.value === 1)}
                                                    >
                                                        <MenuItem value={1}>Yes</MenuItem>
                                                        <MenuItem value={0}>No</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Stack>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
                                <Button onClick={handleSaveSettings} variant="contained">Save</Button>
                            </DialogActions>
                        </Dialog>
                    </CardContent>
                </Card>
            </Grid>

            {/* Results Column */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 350, md: 0 } }}>
                {results && results.gameData ? (
                    <LetterBoxedResults
                        solutions={results.solutions || []}
                        lastGameData={results.gameData}
                        isLoading={isLoading}
                        onLoadMore={onLoadMore}
                        onCopyToClipboard={handleCopyToClipboard}
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

export default React.memo(LetterBoxedGame);
