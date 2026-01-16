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
                                        secondary="Eliminates paths that include words which don't use any new letters"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Prune Dominated Classes"
                                        secondary="Advanced optimization that removes groups of words which have less unique words than another group that starts and ends with the same letters"
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
                                    <ListItemText primary="• Gray (Symbol: None): Letter not in the word" />
                                </ListItem>
                                <ListItem sx={{ pl: 4 }}>
                                    <ListItemText primary="• Yellow (Symbol: ●): Letter in word but wrong position" />
                                </ListItem>
                                <ListItem sx={{ pl: 4 }}>
                                    <ListItemText primary="• Green (Symbol: ■): Letter in correct position" />
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

            case 'mastermind':
                return {
                    title: 'Mastermind Rules & Tips',
                    content: (
                        <Box>
                            <Typography variant="h6" gutterBottom>How to Play:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Enter your guesses as sequences of colored pegs" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="For each guess, provide feedback on how many pegs are correct" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Correct Position: Number of pegs in the right position with the right color" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Correct Color: Number of additional pegs with the right color but wrong position" />
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>Configuration Options:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Number of Pegs"
                                        secondary="How many pegs in each pattern (3-6)"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Number of Colors"
                                        secondary="How many different colors are available (3-10)"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Allow Duplicates"
                                        secondary="Whether the secret pattern can have repeated colors"
                                    />
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>Color Legend:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="R=Red, G=Green, B=Blue, Y=Yellow, M=Magenta" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="C=Cyan, O=Orange, P=Purple, W=White, K=Black" />
                                </ListItem>
                            </List>
                        </Box>
                    )
                };

            case 'hangman':
                return {
                    title: 'Hangman Solver Help',
                    content: (
                        <Box>
                            <Typography variant="h6" gutterBottom>How to Use:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Enter the known pattern"
                                        secondary="Use ? for unknown letters, actual letters for known positions (e.g., 'h?ll?' for a 5-letter word starting with h)"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Enter excluded letters"
                                        secondary="Letters that have already been guessed wrong (e.g., 'xyz')"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Set the solver depth"
                                        secondary="Higher depth = more thorough analysis but slower"
                                    />
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>Results:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText
                                        primary="Best Letters"
                                        secondary="The top letters to guess next, ranked by how many possible words they could reveal"
                                    />
                                </ListItem>
                                <ListItem>
                                    <ListItemText
                                        primary="Possible Words"
                                        secondary="All words that match the current pattern and excluded letters"
                                    />
                                </ListItem>
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="h6" gutterBottom>Tips:</Typography>
                            <List dense>
                                <ListItem>
                                    <ListItemText primary="Start with common vowels (e, a, i, o) and consonants (t, n, s, r)" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Use depth 0 for quick results with many unknown letters" />
                                </ListItem>
                                <ListItem>
                                    <ListItemText primary="Increase depth when you have more letters revealed for better suggestions" />
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
