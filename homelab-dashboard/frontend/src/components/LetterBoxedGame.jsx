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
    ListItemText,
    Paper
} from '@mui/material';
import { PlayArrow as PlayIcon, Settings as SettingsIcon, ContentCopy as CopyIcon } from '@mui/icons-material';

// Letter grid display component
const LetterBoxedGrid = ({ letters }) => {
    const formatLetters = (letters) => {
        if (!letters || letters.length === 0) return [];

        const letterArray = letters.toUpperCase().split('');

        return [
            letterArray.slice(0, 3),
            letterArray.slice(3, 6),
            letterArray.slice(6, 9),
            letterArray.slice(9, 12)
        ];
    };

    const sides = formatLetters(letters);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <Box
                sx={{
                    width: 200,
                    height: 200,
                    position: 'relative',
                    border: '2px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    backgroundColor: 'background.paper'
                }}
            >
                {/* Top side */}
                <Box sx={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
                    {sides[0]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 30,
                                height: 30,
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

                {/* Right side */}
                <Box sx={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {sides[1]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 30,
                                height: 30,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'secondary.main',
                                color: 'secondary.contrastText',
                                fontWeight: 'bold',
                                borderRadius: 1
                            }}
                        >
                            {letter}
                        </Box>
                    ))}
                </Box>

                {/* Bottom side */}
                <Box sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
                    {sides[2]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 30,
                                height: 30,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'success.main',
                                color: 'success.contrastText',
                                fontWeight: 'bold',
                                borderRadius: 1
                            }}
                        >
                            {letter}
                        </Box>
                    ))}
                </Box>

                {/* Left side */}
                <Box sx={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {sides[3]?.map((letter, i) => (
                        <Box
                            key={i}
                            sx={{
                                width: 30,
                                height: 30,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'warning.main',
                                color: 'warning.contrastText',
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

const LetterBoxedResults = React.memo(({
    solutions,
    lastGameData,
    isLoading,
    onLoadMore,
    onCopyToClipboard
}) => {
    const copySolutions = () => {
        const solutionsText = solutions.join('\n');
        onCopyToClipboard(solutionsText);
    };

    if (!solutions || (solutions.length === 0 && !lastGameData)) return null;

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                        Solutions ({solutions.length}/{lastGameData?.actualTotalFound || lastGameData?.totalSolutions || 0})
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

                {solutions.length > 0 ? (
                    <>
                        <Paper
                            variant="outlined"
                            sx={{
                                maxHeight: 400,
                                overflowY: 'auto',
                                bgcolor: 'background.default'
                            }}
                        >
                            <List dense>
                                {solutions.map((solution, index) => (
                                    <React.Fragment key={index}>
                                        <ListItem
                                            onClick={() => onCopyToClipboard(solution)}
                                            sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                        >
                                            <ListItemText
                                                primary={solution}
                                                slotProps={{
                                                    primary: {
                                                        fontFamily: 'monospace',
                                                        fontSize: '1rem',
                                                        fontWeight: 'bold'
                                                    }
                                                }}
                                            />
                                        </ListItem>
                                        {index < solutions.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        </Paper>
                        {lastGameData && solutions.length < (lastGameData.actualTotalFound || lastGameData.totalSolutions || 0) && (
                            <Button
                                variant="contained"
                                onClick={() => onLoadMore('solutions')}
                                disabled={isLoading}
                                sx={{ mt: 2 }}
                            >
                                Load More
                            </Button>
                        )}
                    </>
                ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        No solutions found. Check that all inputs are valid and try again.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
});

const LetterBoxedGame = ({ gameStatus, isLoading, onSolve, onClear, showError, results, onLoadMore }) => {
    const [letterBoxedLetters, setLetterBoxedLetters] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [config, setConfig] = useState({
        preset: 1,
        maxDepth: 2,
        minWordLength: 3,
        minUniqueLetters: 2,
        pruneRedundantPaths: true,
        pruneDominatedClasses: false
    });
    const [tempConfig, setTempConfig] = useState(config);

    // Preset configurations
    const presetConfigs = useMemo(() => ({
        1: { maxDepth: 2, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: true, pruneDominatedClasses: false },
        2: { maxDepth: 2, minWordLength: 4, minUniqueLetters: 3, pruneRedundantPaths: true, pruneDominatedClasses: true },
        3: { maxDepth: 3, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: false, pruneDominatedClasses: false }
    }), []);

    const getCurrentConfig = useCallback(() => {
        if (config.preset === 0) {
            return config;
        }
        return { ...presetConfigs[config.preset], preset: config.preset };
    }, [config, presetConfigs]);

    const isConfigValid = useCallback(() => {
        const currentConfig = getCurrentConfig();
        return currentConfig &&
            currentConfig.maxDepth !== "" && currentConfig.maxDepth > 0 &&
            currentConfig.minWordLength !== "" && currentConfig.minWordLength > 0 &&
            currentConfig.minUniqueLetters !== "" && currentConfig.minUniqueLetters > 0;
    }, [getCurrentConfig]);

    const handleLetterBoxedChange = useCallback((e) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 12);
        setLetterBoxedLetters(cleanValue);
    }, []);

    const handleOpenSettings = useCallback(() => {
        setTempConfig(config);
        setSettingsOpen(true);
    }, [config]);

    const handlePresetChange = useCallback((e) => {
        const preset = e.target.value;
        if (preset === 0) {
            setTempConfig(prev => ({ ...prev, preset: 0 }));
        } else {
            setTempConfig({
                preset,
                ...presetConfigs[preset]
            });
        }
    }, [presetConfigs]);

    const handleTempConfigChange = useCallback((field, value) => {
        setTempConfig(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSaveSettings = useCallback(() => {
        setConfig(tempConfig);
        setSettingsOpen(false);
    }, [tempConfig]);

    const handleSolve = useCallback(async () => {
        if (!letterBoxedLetters.trim()) {
            showError('Please enter letters for Letter Boxed');
            return;
        }

        const currentConfig = getCurrentConfig();
        const requestData = {
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

    const handleCopyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text);
    }, []);

    const isCustom = tempConfig.preset === 0;

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
                            <IconButton onClick={handleOpenSettings} size="small">
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                            Letter Boxed
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Enter the 12 letters from the Letter Boxed puzzle (clockwise from top)
                        </Typography>
                    </Box>

                    {/* Input Field */}
                    <Grid container spacing={3} justifyContent="center" sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, md: 8 }}>
                            <TextField
                                label="Enter 12 letters (clockwise from top)"
                                value={letterBoxedLetters}
                                onChange={handleLetterBoxedChange}
                                fullWidth
                                slotProps={{
                                    htmlInput: {
                                        maxLength: 12,
                                        style: {
                                            textAlign: 'center',
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
                                helperText={`${letterBoxedLetters.length}/12 letters entered`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSolve();
                                    }
                                }}
                            />
                        </Grid>
                    </Grid>

                    {/* Letter Grid Display */}
                    <LetterBoxedGrid letters={letterBoxedLetters} />

                    <Grid container spacing={3} justifyContent="center">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Button
                                variant="contained"
                                onClick={handleSolve}
                                disabled={isLoading || gameStatus?.status !== 'available' || !letterBoxedLetters.trim() || !isConfigValid()}
                                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                fullWidth
                                size="large"
                                color="primary"
                            >
                                Solve
                            </Button>
                        </Grid>
                    </Grid>

                    {/* Settings Dialog */}
                    <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
                        <DialogTitle>Letter Boxed Settings</DialogTitle>
                        <DialogContent>
                            <Stack spacing={3} sx={{ mt: 1 }}>
                                <FormControl fullWidth>
                                    <InputLabel>Preset</InputLabel>
                                    <Select
                                        value={tempConfig.preset}
                                        label="Preset"
                                        onChange={handlePresetChange}
                                    >
                                        <MenuItem value={1}>Default (2 words)</MenuItem>
                                        <MenuItem value={2}>Fast (2 words)</MenuItem>
                                        <MenuItem value={3}>Thorough (3 words)</MenuItem>
                                        <MenuItem value={0}>Custom</MenuItem>
                                    </Select>
                                </FormControl>

                                <Divider />

                                <Box >
                                    <Grid container spacing={2} >
                                        <Grid size={6}>
                                            <TextField
                                                label="Max Depth"
                                                type="number"
                                                value={tempConfig.maxDepth}
                                                onChange={(e) => handleTempConfigChange('maxDepth', parseInt(e.target.value) || 0)}
                                                fullWidth
                                                disabled={!isCustom}
                                                slotProps={{ htmlInput: { min: 1, max: 3 } }}
                                            />
                                        </Grid>
                                        <Grid size={6}>
                                            <TextField
                                                label="Min Word Length"
                                                type="number"
                                                value={tempConfig.minWordLength}
                                                onChange={(e) => handleTempConfigChange('minWordLength', parseInt(e.target.value) || 0)}
                                                fullWidth
                                                disabled={!isCustom}
                                                slotProps={{ htmlInput: { min: 1, max: 20 } }}
                                            />
                                        </Grid>
                                        <Grid size={6}>
                                            <TextField
                                                label="Min Unique Letters"
                                                type="number"
                                                value={tempConfig.minUniqueLetters}
                                                onChange={(e) => handleTempConfigChange('minUniqueLetters', parseInt(e.target.value) || 0)}
                                                fullWidth
                                                disabled={!isCustom}
                                                slotProps={{ htmlInput: { min: 1, max: 12 } }}
                                            />
                                        </Grid>
                                        <Grid size={6}>
                                            <FormControl fullWidth disabled={!isCustom}>
                                                <InputLabel>Prune Redundant Paths</InputLabel>
                                                <Select
                                                    value={tempConfig.pruneRedundantPaths ? 1 : 0}
                                                    label="Prune Redundant Paths"
                                                    onChange={(e) => handleTempConfigChange('pruneRedundantPaths', e.target.value === 1)}
                                                >
                                                    <MenuItem value={1}>Yes</MenuItem>
                                                    <MenuItem value={0}>No</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid size={6}>
                                            <FormControl fullWidth disabled={!isCustom}>
                                                <InputLabel>Prune Dominated Classes</InputLabel>
                                                <Select
                                                    value={tempConfig.pruneDominatedClasses ? 1 : 0}
                                                    label="Prune Dominated Classes"
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

            {/* Results Component */}
            {results && (
                <LetterBoxedResults
                    solutions={results.solutions || []}
                    lastGameData={results.gameData}
                    isLoading={isLoading}
                    onLoadMore={onLoadMore}
                    onCopyToClipboard={handleCopyToClipboard}
                />
            )}
        </>
    );
};

export default React.memo(LetterBoxedGame);
