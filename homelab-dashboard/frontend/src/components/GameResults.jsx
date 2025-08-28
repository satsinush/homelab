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
    TableRow,
    Tooltip
} from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';

// Color palette for mastermind pegs (same as MastermindGame)
const PEG_COLORS = [
    '#df312b', // Red - 0
    '#5cda3c', // Green - 1
    '#1e65ff', // Blue - 2
    '#FFD700', // Yellow - 3
    '#e02f8e', // Magenta - 4
    '#40E0D0', // Cyan - 5
    '#FF8C00', // Orange - 6
    '#8A2BE2', // Purple - 7
    '#f1f1f1', // White - 8
    '#1d1d1d'  // Black - 9
];

const PEG_COLOR_NAMES = [
    'Red', 'Green', 'Blue', 'Yellow', 'Magenta',
    'Cyan', 'Orange', 'Purple', 'White', 'Black'
];

// Text colors for readability on each peg color
// const PEG_TEXT_COLORS = [
//     '#000000', // Black text on Red
//     '#000000', // White text on Green
//     '#FFFFFF', // White text on Blue
//     '#000000', // Black text on Yellow
//     '#000000', // White text on Magenta
//     '#000000', // Black text on Cyan
//     '#000000', // Black text on Orange
//     '#FFFFFF', // White text on Purple
//     '#000000', // Black text on White
//     '#FFFFFF'  // White text on Black
// ];
const PEG_TEXT_COLORS = [
    '#FFFFFF', // Red
    '#FFFFFF', // Green
    '#FFFFFF', // Blue
    '#FFFFFF', // Yellow
    '#FFFFFF', // Magenta
    '#FFFFFF', // Cyan
    '#FFFFFF', // Orange
    '#FFFFFF', // Purple
    '#FFFFFF', // White
    '#FFFFFF'  // Black
];

// Component to display mastermind pattern with colored pegs
const MastermindPatternDisplay = ({ pattern, size = 'small', colorMapping = null }) => {
    const pegSize = size === 'small' ? 20 : 25;
    const fontSize = size === 'small' ? '0.5rem' : '0.7rem';

    if (!pattern || typeof pattern !== 'string') {
        return <Typography variant="body2">-</Typography>;
    }

    const pegValues = pattern.split(' ').map(p => parseInt(p.trim(), 10));

    return (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {pegValues.map((color, index) => {
                // Map mastermind indices back to original color indices if colorMapping is provided
                const actualColorIndex = colorMapping?.mastermindToOriginal?.[color] ?? color;

                return (
                    <Tooltip key={index} title={`${PEG_COLOR_NAMES[actualColorIndex]} (${actualColorIndex})`}>
                        <Box
                            sx={{
                                width: pegSize,
                                height: pegSize,
                                borderRadius: '50%',
                                backgroundColor: PEG_COLORS[actualColorIndex] || '#ccc',
                                border: '1px solid #333',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: PEG_TEXT_COLORS[actualColorIndex] || '#fff',
                                textShadow: `0px 0px 5px #000`,
                                fontSize: fontSize,
                                fontWeight: 'bold',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                            }}
                        >
                            {color}
                        </Box>
                    </Tooltip>
                );
            })}
        </Box>
    );
};

const GameResults = ({
    gameType,
    solutions,
    possibleWords,
    guessesWithEntropy,
    lastGameData,
    lastGameType,
    isLoading,
    onLoadMore,
    onCopyToClipboard,
    onSuggestedGuessSelect,
    onPossibleSolutionSelect
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
                                    <Box>
                                        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                            Possible Words ({memoizedPossibleWords.length}/{lastGameData?.possibleWordsCount || memoizedPossibleWords.length})
                                        </Typography>
                                        {onPossibleSolutionSelect && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Click a word to fill the guess form
                                            </Typography>
                                        )}
                                    </Box>
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
                                                    onClick={() => onPossibleSolutionSelect ? onPossibleSolutionSelect(word) : onCopyToClipboard(word)}
                                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                                >
                                                    <ListItemText
                                                        primary={word}
                                                        slotProps={{
                                                            primary: {
                                                                fontFamily: 'monospace',
                                                                fontSize: '1rem',
                                                                fontWeight: 'bold'
                                                            }
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
                                    No solutions found. Check that all guesses are valid or don't exclude common words and try again.
                                </Typography>
                            </CardContent>
                        }
                    </Card>
                </Grid>

                {/* Suggested Guesses with Entropy - Always show if there are guesses */}
                {(memoizedGuesses.length > 0) && (
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                            Suggested Guesses ({memoizedGuesses.length}/{lastGameData?.guessesCount || memoizedGuesses.length})
                                        </Typography>
                                        {onSuggestedGuessSelect && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Click a word to fill the guess form
                                            </Typography>
                                        )}
                                    </Box>
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
                                                        <TableRow
                                                            key={index}
                                                            hover
                                                            onClick={() => onSuggestedGuessSelect && onSuggestedGuessSelect(guess.word)}
                                                            sx={{
                                                                cursor: onSuggestedGuessSelect ? 'pointer' : 'default',
                                                                '&:hover': onSuggestedGuessSelect ? {
                                                                    backgroundColor: 'action.hover'
                                                                } : {}
                                                            }}
                                                        >
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
                                        No suggested guesses available.
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                )}
            </Grid>
        );
    }

    if (gameType === 'mastermind' && (memoizedPossibleWords.length > 0 || memoizedGuesses.length > 0 || lastGameData)) {
        return (
            <Grid container spacing={3}>
                {/* Possible Patterns */}
                <Grid size={{ xs: 12, md: memoizedGuesses.length > 0 ? 6 : 12 }}>
                    <Card>
                        {(memoizedPossibleWords.length > 0) ? (
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                            Possible Patterns ({memoizedPossibleWords.length}/{lastGameData?.possibleWordsCount || memoizedPossibleWords.length})
                                        </Typography>
                                        {onPossibleSolutionSelect && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Click a pattern to fill the guess form
                                            </Typography>
                                        )}
                                    </Box>
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
                                        {memoizedPossibleWords.map((pattern, index) => (
                                            <React.Fragment key={index}>
                                                <ListItem
                                                    onClick={() => onPossibleSolutionSelect ? onPossibleSolutionSelect(pattern) : onCopyToClipboard(pattern)}
                                                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                                                >
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                <MastermindPatternDisplay
                                                                    pattern={pattern}
                                                                    size="medium"
                                                                    colorMapping={lastGameData?.colorMapping}
                                                                />
                                                            </Box>
                                                        }
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
                                    Possible Patterns ({memoizedPossibleWords.length}/{lastGameData?.possibleWordsCount || 0})
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    No patterns found. Check that all guesses are valid and try again.
                                </Typography>
                            </CardContent>
                        }
                    </Card>
                </Grid>

                {/* Suggested Guesses with Entropy - Only show if there are guesses or guesses are expected */}
                {(memoizedGuesses.length > 0) && (
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                                            Suggested Guesses ({memoizedGuesses.length}/{lastGameData?.guessesCount || memoizedGuesses.length})
                                        </Typography>
                                        {onSuggestedGuessSelect && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Click a pattern to fill the guess form
                                            </Typography>
                                        )}
                                    </Box>
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
                                                        <TableCell sx={{ fontWeight: 'bold' }}>Pattern</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Probability</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Information</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {memoizedGuesses.map((guess, index) => (
                                                        <TableRow
                                                            key={index}
                                                            hover
                                                            onClick={() => onSuggestedGuessSelect && onSuggestedGuessSelect(guess.word)}
                                                            sx={{
                                                                cursor: onSuggestedGuessSelect ? 'pointer' : 'default',
                                                                '&:hover': onSuggestedGuessSelect ? {
                                                                    backgroundColor: 'action.hover'
                                                                } : {}
                                                            }}
                                                        >
                                                            <TableCell>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                    <MastermindPatternDisplay
                                                                        pattern={guess.word}
                                                                        size="medium"
                                                                        colorMapping={lastGameData?.colorMapping}
                                                                    />
                                                                </Box>
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
                                        No suggested guesses available.
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
                                                    slotProps={{
                                                        primary: {
                                                            fontFamily: 'monospace',
                                                            fontSize: '1rem',
                                                            fontWeight: 'bold'
                                                        }
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
                            No solutions found. Check that all inputs are valid and try again.
                        </Typography>
                    )}
                </CardContent>
            </Card>
        );
    }

    return null;
};

export default React.memo(GameResults);
