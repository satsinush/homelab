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
    Stack
} from '@mui/material';
import { PlayArrow as PlayIcon } from '@mui/icons-material';

// Spelling Bee display component
const SpellingBeeDisplay = ({ letters }) => {
    const letterArray = letters.toUpperCase().split('');
    const centerLetter = letterArray[0];
    const outerLetters = letterArray.slice(1, 7);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <Box sx={{
                position: 'relative', width: 200, height: 200,
                border: '2px solid #ddd',
                borderRadius: 2,
                backgroundColor: 'background.paper'
            }}>
                {/* Center hexagon */}
                {(centerLetter) && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 60,
                            height: 60,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'secondary.main',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.5rem',
                            clipPath: 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)',
                        }}
                    >
                        {centerLetter}
                    </Box>
                )}

                {/* Outer hexagons */}
                {outerLetters.map((letter, index) => {
                    const angle = (index * 60) - 90; // Start from top, go clockwise
                    const radian = (angle * Math.PI) / 180;
                    const x = 70 * Math.cos(radian);
                    const y = 70 * Math.sin(radian);

                    return (
                        <Box
                            key={index}
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                width: 45,
                                height: 45,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'primary.main',
                                color: 'black',
                                fontWeight: 'bold',
                                fontSize: '1.2rem',
                                clipPath: 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)',
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

const SpellingBeeGame = ({ gameStatus, isLoading, onSolve, onClear, showError }) => {
    const [spellingBeeLetters, setSpellingBeeLetters] = useState('');

    const handleSpellingBeeChange = useCallback((e) => {
        const cleanValue = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 7);
        setSpellingBeeLetters(cleanValue);
    }, []);

    const handleSolve = useCallback(async () => {
        if (!spellingBeeLetters.trim()) {
            showError('Please enter letters for Spelling Bee');
            return;
        }

        await onSolve('spellingbee', {
            letters: spellingBeeLetters.trim(),
            start: 0,
            end: 100
        });
    }, [spellingBeeLetters, onSolve, showError]);

    const handleClear = useCallback(() => {
        setSpellingBeeLetters('');
        onClear();
    }, [onClear]);

    return (
        <Card>
            <CardContent>
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
                        Spelling Bee
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Enter the 7 letters from the Spelling Bee puzzle (center letter first)
                    </Typography>
                </Box>

                {/* Input Field */}
                <Grid container spacing={3} justifyContent="center" sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <TextField
                            label="Enter 7 letters (center first, then outer)"
                            value={spellingBeeLetters}
                            onChange={handleSpellingBeeChange}
                            placeholder="Type letters here..."
                            fullWidth
                            slotProps={{
                                htmlInput: {
                                    maxLength: 7,
                                    style: {
                                        textAlign: 'center',
                                        fontSize: '1.2rem',
                                        fontWeight: 'bold',
                                        letterSpacing: '3px',
                                        textTransform: 'uppercase'
                                    },
                                }
                            }}
                            helperText={`${spellingBeeLetters.length}/7 letters entered`}
                        />
                    </Grid>
                </Grid>

                {/* Spelling Bee Display */}
                <SpellingBeeDisplay letters={spellingBeeLetters} />

                <Grid container spacing={3} justifyContent="center">
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={2}>
                            {/* Action Buttons */}
                            <Stack direction="row" spacing={2}>
                                <Button
                                    variant="contained"
                                    onClick={handleSolve}
                                    disabled={isLoading || gameStatus?.status !== 'available' || !spellingBeeLetters.trim()}
                                    startIcon={isLoading ? <CircularProgress size={20} /> : <PlayIcon />}
                                    fullWidth
                                    size="large"
                                    color="primary"
                                >
                                    Solve Spelling Bee
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

export default SpellingBeeGame;
