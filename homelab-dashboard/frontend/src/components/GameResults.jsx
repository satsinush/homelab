import React, { useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Paper,
    List,
    ListItem,
    ListItemText,
    Divider,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';

const GameResults = ({
    gameType,
    solutions,
    possibleWords,
    guessesWithEntropy,
    lastGameData,
    lastGameType,
    isLoading,
    onLoadMore,
    onCopyToClipboard
}) => {
    const formatLetters = (letters) => {
        return letters.toUpperCase().split('').join(' ');
    };

    const copySolutions = () => {
        const solutionsText = solutions.join('\n');
        onCopyToClipboard(solutionsText);
    };

    const copyPossibleWords = () => {
        const wordsText = possibleWords.join('\n');
        onCopyToClipboard(wordsText);
    };

    const copyGuesses = () => {
        const guessesText = guessesWithEntropy.map(g => `${g.word} - ${g.probability} - ${g.entropy}`).join('\n');
        onCopyToClipboard(guessesText);
    };

    const formatRoundedNum = (num) => {
        // Handle cases where number is 0, null, or undefined
        if (!num) {
            return '0.00';
        }

        if (num > 0 && num.toFixed(2) === '0.00') {
            return '<0.01';
        }

        // Otherwise, return the normal formatted string
        return `${num.toFixed(2)}`;
    };

    // Memoize the results to prevent unnecessary re-renders
    const memoizedSolutions = useMemo(() => solutions, [solutions]);
    const memoizedPossibleWords = useMemo(() => possibleWords, [possibleWords]);
    const memoizedGuesses = useMemo(() => guessesWithEntropy, [guessesWithEntropy]);

    if (gameType === 'wordle' && (memoizedPossibleWords.length > 0 || memoizedGuesses.length > 0 || lastGameData)) {
        return (
            <Grid container spacing={3}>
                {/* Possible Words */}
                <Grid size={{ xs: 12, md: memoizedGuesses.length > 0 || (lastGameData && lastGameData.guessesCount > 0) ? 6 : 12 }}>
                    <Card>
                        {(memoizedPossibleWords.length > 0) ? (
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Possible Words ({memoizedPossibleWords.length}/{lastGameData?.possibleWordsCount || memoizedPossibleWords.length})
                                    </Typography>
                                    {memoizedPossibleWords.length > 0 && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={copyPossibleWords}
                                            startIcon={<CopyIcon />}
                                        >
                                            Copy
                                        </Button>
                                    )}
                                </Box>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        maxHeight: 300,
                                        overflowY: 'auto',
                                        bgcolor: 'background.default'
                                    }}
                                >
                                    <List dense>
                                        {memoizedPossibleWords.map((word, index) => (
                                            <React.Fragment key={index}>
                                                <ListItem
                                                    onClick={() => onCopyToClipboard(word)}
                                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                                >
                                                    <ListItemText
                                                        primary={word}
                                                        primaryTypographyProps={{
                                                            fontFamily: 'monospace',
                                                            fontSize: '1rem',
                                                            fontWeight: 'bold'
                                                        }}
                                                    />
                                                </ListItem>
                                                {index < memoizedPossibleWords.length - 1 && <Divider />}
                                            </React.Fragment>
                                        ))}
                                    </List>
                                </Paper>
                                {lastGameData && lastGameData.isLimitedPossible && memoizedPossibleWords.length < (lastGameData.possibleWordsCount || 0) && (
                                    <Button
                                        variant="contained"
                                        onClick={() => onLoadMore('possible')}
                                        disabled={isLoading}
                                        sx={{ mt: 2 }}
                                        size="small"
                                    >
                                        Load More
                                    </Button>
                                )}
                            </CardContent>) :
                            <CardContent>
                                <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                    Possible Words ({memoizedPossibleWords.length}/{lastGameData?.possibleWordsCount || 0})
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    No solutions found.
                                </Typography>
                            </CardContent>
                        }
                    </Card>
                </Grid>

                {/* Suggested Guesses with Entropy - Only show if there are guesses or guesses are expected */}
                {(memoizedGuesses.length > 0 || (lastGameData && lastGameData.guessesCount > 0)) && (
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                        Suggested Guesses ({memoizedGuesses.length}/{lastGameData?.guessesCount || memoizedGuesses.length})
                                    </Typography>
                                    {memoizedGuesses.length > 0 && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={copyGuesses}
                                            startIcon={<CopyIcon />}
                                        >
                                            Copy
                                        </Button>
                                    )}
                                </Box>
                                {memoizedGuesses.length > 0 ? (
                                    <>
                                        <TableContainer
                                            component={Paper}
                                            variant="outlined"
                                            sx={{
                                                maxHeight: 300,
                                                overflowY: 'auto',
                                                bgcolor: 'background.default'
                                            }}
                                        >
                                            <Table size="small" stickyHeader>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>Word</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Information</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {memoizedGuesses.map((guess, index) => (
                                                        <TableRow key={index} hover>
                                                            <TableCell>
                                                                <Typography
                                                                    sx={{
                                                                        fontFamily: 'monospace',
                                                                        fontSize: '1rem',
                                                                        fontWeight: 'bold'
                                                                    }}
                                                                >
                                                                    {guess.word}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Typography variant="body2">
                                                                    {formatRoundedNum(guess.probability * 100)}%
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell align="right">
                                                                <Typography variant="body2">
                                                                    {guess.entropy !== null ? formatRoundedNum(guess.entropy) : 'N/A'}
                                                                </Typography>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                        {lastGameData && lastGameData.isLimitedGuesses && memoizedGuesses.length < (lastGameData.guessesCount || 0) && (
                                            <Button
                                                variant="contained"
                                                onClick={() => onLoadMore('guesses')}
                                                disabled={isLoading}
                                                sx={{ mt: 2 }}
                                                size="small"
                                            >
                                                Load More
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        No suggested guesses available. Use "Calculate best guesses" mode to see recommendations.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        );
    }

    // Regular solutions display for Letter Boxed and Spelling Bee
    if (memoizedSolutions.length > 0 || lastGameData) {
        return (
            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                            Solutions ({memoizedSolutions.length}/{lastGameData?.actualTotalFound || lastGameData?.totalSolutions || 0})
                        </Typography>
                        {memoizedSolutions.length > 0 && (
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

                    {memoizedSolutions.length > 0 ? (
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
                                    {memoizedSolutions.map((solution, index) => (
                                        <React.Fragment key={index}>
                                            <ListItem
                                                onClick={() => onCopyToClipboard(solution)}
                                                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                            >
                                                <ListItemText
                                                    primary={solution}
                                                    primaryTypographyProps={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.875rem'
                                                    }}
                                                />
                                            </ListItem>
                                            {index < memoizedSolutions.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            </Paper>
                            {lastGameData && memoizedSolutions.length < (lastGameData.actualTotalFound || lastGameData.totalSolutions || 0) && (
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
                            No solutions found.
                        </Typography>
                    )}
                </CardContent>
            </Card>
        );
    }

    return null;
};

export default GameResults;
