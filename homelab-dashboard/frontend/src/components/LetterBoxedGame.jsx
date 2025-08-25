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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack
} from '@mui/material';
import { PlayArrow as PlayIcon } from '@mui/icons-material';

// Letter grid display component
const LetterBoxedGrid = ({ letters }) => {
    const formatLetters = (letters) => {
        if (!letters || letters.length === 0) return [];

        const letterArray = letters.toUpperCase().split('');

        if (letterArray.length <= 8) {
            return [
                letterArray.slice(0, 3),
                letterArray.slice(3, 6),
                letterArray.slice(6, 9),
                letterArray.slice(9, 12)
            ];
        }

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
                    border: '2px solid #ddd',
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
                                color: 'white',
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
                                color: 'white',
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
                                color: 'white',
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
                                color: 'white',
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

const LetterBoxedGame = ({ gameStatus, isLoading, onSolve, onClear, showError }) => {
    const [letterBoxedLetters, setLetterBoxedLetters] = useState('');
    const [letterBoxedConfig, setLetterBoxedConfig] = useState(1);
    const [customConfig, setCustomConfig] = useState({
        maxDepth: 2,
        minWordLength: 3,
        minUniqueLetters: 2,
        pruneRedundantPaths: 1,
        pruneDominatedClasses: 0
    });

    // Preset configurations
    const presetConfigs = useMemo(() => ({
        1: { maxDepth: 2, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: 1, pruneDominatedClasses: 0 },
        2: { maxDepth: 2, minWordLength: 4, minUniqueLetters: 3, pruneRedundantPaths: 1, pruneDominatedClasses: 1 },
        3: { maxDepth: 3, minWordLength: 3, minUniqueLetters: 2, pruneRedundantPaths: 0, pruneDominatedClasses: 0 }
    }), []);

    // Get current config values (preset or custom)
    const getCurrentConfig = useCallback(() => {
        return letterBoxedConfig === 0 ? customConfig : presetConfigs[letterBoxedConfig];
    }, [letterBoxedConfig, customConfig, presetConfigs]);

    // Validate if all config fields are filled
    const isConfigValid = useCallback(() => {
        const config = getCurrentConfig();
        return config &&
            config.maxDepth !== "" && config.maxDepth > 0 &&
            config.minWordLength !== "" && config.minWordLength > 0 &&
            config.minUniqueLetters !== "" && config.minUniqueLetters > 0 &&
            config.pruneRedundantPaths !== "" &&
            config.pruneDominatedClasses !== "";
    }, [getCurrentConfig]);

    const handleLetterBoxedChange = useCallback((e) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 12);
        setLetterBoxedLetters(cleanValue);
    }, []);

    const handleLetterBoxedConfigChange = useCallback((e) => {
        setLetterBoxedConfig(e.target.value);
    }, []);

    const handleCustomConfigChange = useCallback((field, value) => {
        setCustomConfig(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const handleSolve = useCallback(async () => {
        if (!letterBoxedLetters.trim()) {
            showError('Please enter letters for Letter Boxed');
            return;
        }

        const config = getCurrentConfig();
        await onSolve('letterboxed', {
            letters: letterBoxedLetters.trim(),
            maxDepth: config.maxDepth,
            minWordLength: config.minWordLength,
            minUniqueLetters: config.minUniqueLetters,
            pruneRedundantPaths: config.pruneRedundantPaths,
            pruneDominatedClasses: config.pruneDominatedClasses,
            start: 0,
            end: 100
        });
    }, [letterBoxedLetters, getCurrentConfig, onSolve, showError]);

    const handleClear = useCallback(() => {
        setLetterBoxedLetters('');
        onClear();
    }, [onClear]);

    return (
        <Card>
            <CardContent>
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
                                }
                            }}
                            helperText={`${letterBoxedLetters.length}/12 letters entered`}
                        />
                    </Grid>
                </Grid>

                {/* Letter Grid Display */}
                <LetterBoxedGrid letters={letterBoxedLetters} />

                <Grid container spacing={3} justifyContent="center">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Config Preset</InputLabel>
                                <Select
                                    value={letterBoxedConfig}
                                    label="Config Preset"
                                    onChange={handleLetterBoxedConfigChange}
                                >
                                    <MenuItem value={1}>Default</MenuItem>
                                    <MenuItem value={2}>Fast</MenuItem>
                                    <MenuItem value={3}>Thorough</MenuItem>
                                    <MenuItem value={0}>Custom</MenuItem>
                                </Select>
                            </FormControl>

                            {/* Custom Configuration Editor - Always Visible */}
                            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
                                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                    Configuration Settings:
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid size={6}>
                                        <TextField
                                            label="Max Depth"
                                            type="number"
                                            value={letterBoxedConfig === 0 ? customConfig.maxDepth : getCurrentConfig()?.maxDepth || ''}
                                            onChange={(e) => letterBoxedConfig === 0 && handleCustomConfigChange('maxDepth', parseInt(e.target.value) || 0)}
                                            size="small"
                                            fullWidth
                                            disabled={letterBoxedConfig !== 0}
                                            slotProps={{
                                                htmlInput: { min: 1, max: 10 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={6}>
                                        <TextField
                                            label="Min Word Length"
                                            type="number"
                                            value={letterBoxedConfig === 0 ? customConfig.minWordLength : getCurrentConfig()?.minWordLength || ''}
                                            onChange={(e) => letterBoxedConfig === 0 && handleCustomConfigChange('minWordLength', parseInt(e.target.value) || 0)}
                                            size="small"
                                            fullWidth
                                            disabled={letterBoxedConfig !== 0}
                                            slotProps={{
                                                htmlInput: { min: 1, max: 20 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={6}>
                                        <TextField
                                            label="Min Unique Letters"
                                            type="number"
                                            value={letterBoxedConfig === 0 ? customConfig.minUniqueLetters : getCurrentConfig()?.minUniqueLetters || ''}
                                            onChange={(e) => letterBoxedConfig === 0 && handleCustomConfigChange('minUniqueLetters', parseInt(e.target.value) || 0)}
                                            size="small"
                                            fullWidth
                                            disabled={letterBoxedConfig !== 0}
                                            slotProps={{
                                                htmlInput: { min: 1, max: 12 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Prune Redundant Paths</InputLabel>
                                            <Select
                                                value={letterBoxedConfig === 0 ? customConfig.pruneRedundantPaths : getCurrentConfig()?.pruneRedundantPaths || 0}
                                                label="Prune Redundant Paths"
                                                onChange={(e) => letterBoxedConfig === 0 && handleCustomConfigChange('pruneRedundantPaths', e.target.value)}
                                                disabled={letterBoxedConfig !== 0}
                                            >
                                                <MenuItem value={0}>No</MenuItem>
                                                <MenuItem value={1}>Yes</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Prune Dominated Classes</InputLabel>
                                            <Select
                                                value={letterBoxedConfig === 0 ? customConfig.pruneDominatedClasses : getCurrentConfig()?.pruneDominatedClasses || 0}
                                                label="Prune Dominated Classes"
                                                onChange={(e) => letterBoxedConfig === 0 && handleCustomConfigChange('pruneDominatedClasses', e.target.value)}
                                                disabled={letterBoxedConfig !== 0}
                                            >
                                                <MenuItem value={0}>No</MenuItem>
                                                <MenuItem value={1}>Yes</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Box>

                            {/* Action Buttons */}
                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant="contained"
                                    onClick={handleSolve}
                                    disabled={isLoading || gameStatus?.status !== 'available' || !letterBoxedLetters.trim() || !isConfigValid()}
                                    startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                    fullWidth
                                    size="large"
                                    color="primary"
                                >
                                    Solve Letter Boxed
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={handleClear}
                                    disabled={isLoading}
                                    size="large"
                                >
                                    Clear
                                </Button>
                            </Stack>
                        </Stack>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
};

export default LetterBoxedGame;
