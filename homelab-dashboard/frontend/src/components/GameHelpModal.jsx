import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    List,
    ListItem,
    ListItemText,
    Divider
} from '@mui/material';

const GameHelpModal = ({ open, onClose, gameType }) => {
    const getHelpContent = () => {
        switch (gameType) {
            case 'letterboxed':
                return {
                    title: 'Letter Boxed Rules & Tips',
                    content: (
                        <Box>
                            <Typography variant="h6" gutterBottom>How to Play:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Create words using the letters around the box edges" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="You cannot use two letters from the same side consecutively" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Each new word must start with the last letter of the previous word" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Use all 12 letters to complete the puzzle" />
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>Configuration Options:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Max Depth"
                                        secondary="Maximum number of words allowed in a solution (1-10)"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Min Word Length"
                                        secondary="Minimum length for each word (3+ recommended)"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Min Unique Letters"
                                        secondary="Minimum unique letters required per word"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Prune Redundant Paths"
                                        secondary="Eliminates duplicate solution paths for faster processing"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Prune Dominated Classes"
                                        secondary="Advanced optimization that removes inferior solution branches"
                                    />
                                </ListItem>
                            </List>

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                <strong>Tip:</strong> Enter letters clockwise starting from the top edge.
                                Use "Default" preset for typical puzzles, "Fast" for quicker results, or "Thorough" for comprehensive solutions.
                            </Typography>
                        </Box>
                    )
                };

            case 'spellingbee':
                return {
                    title: 'Spelling Bee Rules & Tips',
                    content: (
                        <Box>
                            <Typography variant="h6" gutterBottom>How to Play:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Create words using the 7 letters provided" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Every word must contain the center letter" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Words must be at least 4 letters long" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Letters can be used multiple times" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Find the pangram - a word that uses all 7 letters!" />
                                </ListItem>
                            </List>

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                <strong>Tip:</strong> Enter the center letter first, then the 6 outer letters.
                                The solver will find all valid words including pangrams.
                            </Typography>
                        </Box>
                    )
                };

            case 'wordle':
                return {
                    title: 'Wordle Solver Rules & Tips',
                    content: (
                        <Box>
                            <Typography variant="h6" gutterBottom>How to Use:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Enter your guesses and the color feedback you received" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Click on letter boxes to cycle through colors:" />
                                </ListItem>
                                <ListItem sx={{ pl: 4 }}>
                                    <ListItemText
                                        primary="• Gray: Letter not in the word"
                                    />
                                </ListItem>
                                <ListItem sx={{ pl: 4 }}>
                                    <ListItemText primary="• Yellow: Letter in word but wrong position" />
                                </ListItem>
                                <ListItem sx={{ pl: 4 }}>
                                    <ListItemText primary="• Green: Letter in correct position" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="The solver will suggest possible words and optimal next guesses" />
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>Configuration:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Solver Mode"
                                        secondary="What the solver will do (Filter all words for all possible solutions, or get all possible solutions and calculate the best next guesses)"
                                    />
                                </ListItem>
                            </List>
                        </Box>
                    )
                };

            default:
                return {
                    title: 'Word Games Help',
                    content: <Typography>Select a game to see specific help information.</Typography>
                };
        }
    };

    const { title, content } = getHelpContent();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {content}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} variant="contained">
                    Got it
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default GameHelpModal;
