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
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { LetterBoxedResultState, GameStatus } from '../types/api';

interface LetterBoxedGridProps {
    letters: string;
}

// Letter grid display component
const LetterBoxedGrid = ({ letters }: LetterBoxedGridProps) => {
    const formatLetters = (lettersVal: string) => {
        if (!lettersVal || lettersVal.length === 0) return [];

        const letterArray = lettersVal.toUpperCase().split('');

        return [
            letterArray.slice(0, 3),
            letterArray.slice(3, 6),
            letterArray.slice(6, 9),
            letterArray.slice(9, 12)
        ];
    };

    const sides = formatLetters(letters);

    if (sides.length === 0) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            {/* Box Layout */}
            <Box
                sx={{
                    position: 'relative',
                    width: 200,
                    height: 200,
                    border: '3px solid',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                }}
            >
                {/* Top Side (0, 1, 2) */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -20,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'space-around',
                        px: 2
                    }}
                >
                    {sides[0]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                fontWeight: 'bold',
                                borderRadius: 1
                            }}
                        >
                            {letter}
                        </Box>
                    ))}
                </Box>

                {/* Right Side (3, 4, 5) */}
                <Box
                    sx={{
                        position: 'absolute',
                        right: -20,
                        top: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-around',
                        py: 2
                    }}
                >
                    {sides[1]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                fontWeight: 'bold',
                                borderRadius: 1
                            }}
                        >
                            {letter}
                        </Box>
                    ))}
                </Box>

                {/* Bottom Side (6, 7, 8) */}
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: -20,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'space-around',
                        px: 2
                    }}
                >
                    {sides[2]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                fontWeight: 'bold',
                                borderRadius: 1
                            }}
                        >
                            {letter}
                        </Box>
                    ))}
                </Box>

                {/* Left Side (9, 10, 11) */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: -20,
                        top: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-around',
                        py: 2
                    }}
                >
                    {sides[3]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                fontWeight: 'bold',
                                borderRadius: 1
                            }}
                        >
                            {letter}
                        </Box>
                    ))}
                </Box>
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
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
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

                <Box
                    sx={{
                        maxHeight: 400,
                        overflowY: 'auto',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.default'
                    }}
                >
                    <List dense>
                        {solutions.map((sol, index) => {
                            const words = sol.split('-');
                            return (
                                <React.Fragment key={index}>
                                    <ListItem>
                                        <ListItemText
                                            primary={
                                                <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                    {sol}
                                                </Typography>
                                            }
                                            secondary={`Words: ${words.length} | Length: ${sol.replace(/-/g, '').length}`}
                                        />
                                    </ListItem>
                                    {index < solutions.length - 1 && <Divider />}
                                </React.Fragment>
                            );
                        })}
                    </List>
                </Box>

                {lastGameData && lastGameData.isLimited && solutions.length < totalSolutionsCount && (
                    <Button
                        variant="contained"
                        onClick={() => onLoadMore('results')}
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
        <Grid container spacing={2}>
            {/* Input & Control Column */}
            <Grid size={{ xs: 12, md: 5, lg: 4 }}>
                <Card>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        {/* Control Buttons */}
                        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} justifyContent="space-between" alignItems="center">
                            <Button variant="outlined" onClick={handleClear} disabled={isLoading} size="small">
                                New Game
                            </Button>
                            <Tooltip title="Settings">
                                <IconButton onClick={handleOpenSettings} size="small">
                                    <SettingsIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                Letter Boxed
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Enter 12 letters from the puzzle sides (3 per side).
                            </Typography>
                        </Box>

                        {/* Box Display */}
                        {letterBoxedLetters.length > 0 && (
                            <LetterBoxedGrid letters={letterBoxedLetters} />
                        )}

                        <Stack spacing={1.5} sx={{ mt: 1.5 }}>
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
                            />
                            
                            <Button
                                fullWidth
                                variant="contained"
                                size="medium"
                                onClick={handleSolve}
                                disabled={isLoading || letterBoxedLetters.length !== 12 || !gameStatus?.healthy}
                                startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                            >
                                {isLoading ? 'Solving...' : 'Solve'}
                            </Button>
                        </Stack>

                        {/* Custom Settings Dialog */}
                        <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="xs" fullWidth>
                            <DialogTitle>Letter Boxed Settings</DialogTitle>
                            <DialogContent>
                                <Stack spacing={2} sx={{ mt: 1 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Difficulty Preset</InputLabel>
                                        <Select
                                            value={tempConfig.preset}
                                            label="Difficulty Preset"
                                            onChange={(e) => handlePresetChange(Number(e.target.value))}
                                        >
                                            <MenuItem value={1}>1: Normal (Depth 2)</MenuItem>
                                            <MenuItem value={2}>2: Strict (Depth 2 + Pruning)</MenuItem>
                                            <MenuItem value={3}>3: Deep (Depth 3)</MenuItem>
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
            <Grid size={{ xs: 12, md: 7, lg: 8 }}>
                {results && (
                    <LetterBoxedResults
                        solutions={results.solutions || []}
                        lastGameData={results.gameData}
                        isLoading={isLoading}
                        onLoadMore={onLoadMore}
                        onCopyToClipboard={handleCopyToClipboard}
                    />
                )}
            </Grid>
        </Grid>
    );
};

export default React.memo(LetterBoxedGame);
