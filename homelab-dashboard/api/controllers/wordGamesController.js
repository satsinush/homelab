const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses

class WordGamesController {
    constructor() {
        // Path to the word_games executable
        this.executableFile = 'word_games';
        this.executableDir = path.join('/app/word_games');
        this.timeout = 30000; // 30 seconds timeout
        this.resultsFolder = 'results';
        this.cleanupDelay = 60 * 60 * 1000; // 1 hour in milliseconds

        // Initialize words.bin by running a command
        this.executeCommand('--help', 30000);
        
        // Run initial cleanup on startup to handle any leftover files
        this.initialCleanup();
    }

    // Run initial cleanup when the controller starts
    async initialCleanup() {
        try {
            console.log('Running initial cleanup of old results files...');
            await this.cleanupOldResultsFiles();
        } catch (error) {
            console.error('Error during initial cleanup:', error.message);
        }
    }

    // Generate a unique filename for results
    generateResultsFilename(username, gameType) {
        const timestamp = Date.now();
        return path.join(this.resultsFolder, `${username || 'user'}_${gameType}_${timestamp}.txt`);
    }

    // Solve Letter Boxed puzzle
    async solveLetterBoxed(req, res) {
        try {
            const {
                letters,
                maxDepth,
                minWordLength,
                minUniqueLetters,
                pruneRedundantPaths,
                pruneDominatedClasses,
                start = 0,
                end = 100
            } = req.body;

            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate input
            if (!letters || typeof letters !== 'string') {
                return sendError(res, 400, 'Letters parameter is required and must be a string');
            }

            // Remove any spaces and validate length (should be 12 letters for letter boxed)
            const cleanLetters = letters.replace(/\s/g, '').toLowerCase();
            if (cleanLetters.length !== 12) {
                return sendError(res, 400, 'Letters must be exactly 12 characters for Letter Boxed');
            }

            // Validate letters are alphabetic
            if (!/^[a-z]+$/i.test(cleanLetters)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            // Validate all configuration parameters are provided
            if (
                maxDepth === undefined ||
                minWordLength === undefined ||
                minUniqueLetters === undefined ||
                pruneRedundantPaths === undefined ||
                pruneDominatedClasses === undefined
            ) {
                return sendError(res, 400, 'All configuration parameters are required: maxDepth, minWordLength, minUniqueLetters, pruneRedundantPaths, pruneDominatedClasses');
            }

            // Validate parameter ranges
            const depth = parseInt(maxDepth);
            const wordLen = parseInt(minWordLength);
            const uniqueLetters = parseInt(minUniqueLetters);
            const pruneRedundant = parseInt(pruneRedundantPaths);
            const pruneDominated = parseInt(pruneDominatedClasses);

            if (isNaN(depth) || depth < 1 || depth > 3) {
                return sendError(res, 400, 'Max depth must be a number between 1 and 3');
            }
            if (isNaN(wordLen) || wordLen < 1) {
                return sendError(res, 400, 'Min word length must be a number greater than 0');
            }
            if (isNaN(uniqueLetters) || uniqueLetters < 1) {
                return sendError(res, 400, 'Min unique letters must be a number greater than 0');
            }
            if (isNaN(pruneRedundant) || (pruneRedundant !== 0 && pruneRedundant !== 1)) {
                return sendError(res, 400, 'Prune redundant paths must be 0 or 1');
            }
            if (isNaN(pruneDominated) || (pruneDominated !== 0 && pruneDominated !== 1)) {
                return sendError(res, 400, 'Prune dominated classes must be 0 or 1');
            }

            // Generate unique filename for this session
            const resultsFilename = this.generateResultsFilename(req.user.username, 'letterboxed');

            // Build command with flags
            const flags = [
                `--mode letterboxed`,
                `--letters ${cleanLetters}`,
                `--maxDepth ${depth}`,
                `--minWordLength ${wordLen}`,
                `--minUniqueLetters ${uniqueLetters}`,
                `--pruneRedundantPaths ${pruneRedundant}`,
                `--pruneDominatedClasses ${pruneDominated}`,
                `--file ${resultsFilename}`
            ].join(' ');

            // First, get the total number of results
            const countCommand = `${flags}`;
            console.log(`Executing Letter Boxed solver: ${countCommand}`);
            const countResult = await this.executeCommand(countCommand);
            
            // Parse output: first line is count, second line is filename
            const outputLines = countResult.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]);
            const actualResultsFile = outputLines[1];
            
            if (isNaN(totalFound)) {
                return sendError(res, 500, 'Failed to parse result count from solver');
            }

            // Now, read the results for the requested page
            const readCommand = `--mode read --file ${actualResultsFile} --start ${start} --end ${end}`;
            const readResult = await this.executeCommand(readCommand);

            this.scheduleFileCleanup(actualResultsFile);

            // Parse the output into solutions
            const allSolutions = this.parseWordGameOutput(readResult.stdout);

            return sendSuccess(res, {
                success: true,
                gameType: 'letterboxed',
                letters: cleanLetters,
                maxDepth: depth,
                minWordLength: wordLen,
                minUniqueLetters: uniqueLetters,
                pruneRedundantPaths: pruneRedundant,
                pruneDominatedClasses: pruneDominated,
                solutions: allSolutions,
                totalSolutions: allSolutions.length,
                actualTotalFound: totalFound,
                isLimited: totalFound > end,
                executionTime: readResult.executionTime,
                start,
                end,
                resultsFile: resultsFilename,
                actualResultsFile: actualResultsFile
            });

        } catch (error) {
            console.error('Letter Boxed solver error:', error);
            
            if (error.message.includes('Command failed')) {
                return sendError(res, 500, 'Word games executable failed to run. Please check if the executable is available.');
            }
            
            if (error.message.includes('timeout')) {
                return sendError(res, 408, 'Request timeout. The puzzle is too complex or the system is overloaded.');
            }
            
            return sendError(res, 500, 'Failed to solve Letter Boxed puzzle', error.message);
        }
    }

    // Solve Spelling Bee puzzle
    async solveSpellingBee(req, res) {
        try {
            const { letters, start = 0, end = 100 } = req.body;

            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate input
            if (!letters || typeof letters !== 'string') {
                return sendError(res, 400, 'Letters parameter is required and must be a string');
            }

            // Remove any spaces and validate length (should be 7 letters for spelling bee)
            const cleanLetters = letters.replace(/\s/g, '').toLowerCase();
            if (cleanLetters.length !== 7) {
                return sendError(res, 400, 'Letters must be exactly 7 characters for Spelling Bee');
            }

            // Validate letters are alphabetic
            if (!/^[a-z]+$/i.test(cleanLetters)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            // Validate all letters are unique
            const uniqueLetters = new Set(cleanLetters.split(''));
            if (uniqueLetters.size !== 7) {
                return sendError(res, 400, 'All letters must be different for Spelling Bee');
            }

            // Generate unique filename for this session
            const resultsFilename = this.generateResultsFilename(req.user.username, 'spellingbee');

            // Build command with flags
            const flags = [
                `--mode spellingbee`,
                `--letters ${cleanLetters}`,
                `--file ${resultsFilename}`
            ].join(' ');

            // First, get the total number of results
            const countCommand = `${flags}`;
            console.log(`Executing Spelling Bee solver: ${countCommand}`);
            const countResult = await this.executeCommand(countCommand);

            // Parse output: first line is count, second line is filename
            const outputLines = countResult.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]);
            const actualResultsFile = outputLines[1];
            
            if (isNaN(totalFound)) {
                return sendError(res, 500, 'Failed to parse result count from solver');
            }

            // Now, read the results for the requested page
            const readCommand = `--mode read --file ${actualResultsFile} --start ${start} --end ${end}`;
            const readResult = await this.executeCommand(readCommand);

            this.scheduleFileCleanup(actualResultsFile);

            // Parse the output into solutions
            const allSolutions = this.parseWordGameOutput(readResult.stdout);

            return sendSuccess(res, {
                success: true,
                gameType: 'spellingbee',
                letters: cleanLetters,
                solutions: allSolutions,
                totalSolutions: allSolutions.length,
                actualTotalFound: totalFound,
                isLimited: totalFound > end,
                executionTime: readResult.executionTime,
                start,
                end,
                resultsFile: resultsFilename,
                actualResultsFile: actualResultsFile
            });

        } catch (error) {
            console.error('Spelling Bee solver error:', error);
            
            if (error.message.includes('Command failed')) {
                return sendError(res, 500, 'Word games executable failed to run. Please check if the executable is available.');
            }
            
            if (error.message.includes('timeout')) {
                return sendError(res, 408, 'Request timeout. The puzzle is too complex or the system is overloaded.');
            }
            
            return sendError(res, 500, 'Failed to solve Spelling Bee puzzle', error.message);
        }
    }

    // Solve Wordle puzzle
    async solveWordle(req, res) {
        try {
            const { guesses, maxDepth = 0, start = 0, end = 100 } = req.body;

            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate input
            if (!guesses || !Array.isArray(guesses) || guesses.length === 0) {
                return sendError(res, 400, 'Guesses parameter is required and must be a non-empty array');
            }

            // Validate each guess
            for (let i = 0; i < guesses.length; i++) {
                const guess = guesses[i];
                if (!guess.word || !guess.feedback) {
                    return sendError(res, 400, `Guess ${i + 1} must have both 'word' and 'feedback' properties`);
                }

                const word = guess.word.trim().toUpperCase();
                const feedback = guess.feedback.trim();

                if (word.length !== 5) {
                    return sendError(res, 400, `Guess ${i + 1}: Word must be exactly 5 letters`);
                }

                if (!/^[A-Z]+$/.test(word)) {
                    return sendError(res, 400, `Guess ${i + 1}: Word must contain only letters`);
                }

                if (feedback.length !== 5) {
                    return sendError(res, 400, `Guess ${i + 1}: Feedback must be exactly 5 digits`);
                }

                if (!/^[012]+$/.test(feedback)) {
                    return sendError(res, 400, `Guess ${i + 1}: Feedback must contain only 0, 1, or 2`);
                }
            }

            // Validate max depth
            const depth = parseInt(maxDepth);
            if (isNaN(depth) || depth < 0 || depth > 1) {
                return sendError(res, 400, 'Max depth must be 0 or 1 (higher values are too slow)');
            }

            // Generate unique filenames for this session
            const possibleFilename = this.generateResultsFilename(req.user.username, 'wordle_possible');
            const guessesFilename = this.generateResultsFilename(req.user.username, 'wordle_guesses');

            // Build guess arguments for command line
            const guessArgs = guesses.map(g => `"${g.word.toUpperCase()} ${g.feedback}"`).join(' ');

            // Build command with flags
            const flags = [
                `--mode wordle`,
                `--guesses ${guessArgs}`,
                `--maxDepth ${depth}`,
                `--possibleFile ${possibleFilename}`,
                `--guessesFile ${guessesFilename}`
            ].join(' ');

            console.log(`Executing Wordle solver: ${flags}`);
            const result = await this.executeCommand(flags);

            // Parse the initial output to get counts and filenames
            // Expected format:
            // number of possible solutions
            // number of guesses
            // possibleWordsFile
            // guessesFile
            const outputLines = result.stdout.trim().split('\n');
            if (outputLines.length < 4) {
                return sendError(res, 500, 'Invalid output format from Wordle solver');
            }

            const possibleWordsCount = parseInt(outputLines[0]);
            const guessesCount = parseInt(outputLines[1]);
            const actualPossibleFile = outputLines[2];
            const actualGuessesFile = outputLines[3];

            if (isNaN(possibleWordsCount) || isNaN(guessesCount)) {
                return sendError(res, 500, 'Failed to parse counts from Wordle solver output');
            }

            // Schedule cleanup for both files
            this.scheduleFileCleanup(actualPossibleFile);
            this.scheduleFileCleanup(actualGuessesFile);

            // Read the possible words file
            const readPossibleCommand = `--mode read --file ${actualPossibleFile} --start ${start} --end ${end}`;
            const possibleResult = await this.executeCommand(readPossibleCommand);
            const possibleWords = this.parseWordGameOutput(possibleResult.stdout);
            possibleWords.sort(); // Sort alphabetically

            // Read the guesses file and parse it
            const readGuessesCommand = `--mode read --file ${actualGuessesFile} --start ${start} --end ${end}`;
            const guessesResult = await this.executeCommand(readGuessesCommand);
            const guessesWithEntropy = this.parseWordleGuesses(guessesResult.stdout);

            return sendSuccess(res, {
                success: true,
                gameType: 'wordle',
                guesses: guesses,
                maxDepth: depth,
                possibleWords: possibleWords,
                guessesWithEntropy: guessesWithEntropy,
                possibleWordsCount: possibleWordsCount,
                guessesCount: guessesCount,
                actualPossibleWordsFound: possibleWordsCount,
                actualGuessesFound: guessesCount,
                isLimitedPossible: possibleWordsCount > end,
                isLimitedGuesses: guessesCount > end,
                executionTime: result.executionTime,
                start,
                end,
                possibleFile: actualPossibleFile,
                guessesFile: actualGuessesFile
            });

        } catch (error) {
            console.error('Wordle solver error:', error);
            
            if (error.message.includes('Command failed')) {
                return sendError(res, 500, 'Word games executable failed to run. Please check if the executable is available.');
            }
            
            if (error.message.includes('timeout')) {
                return sendError(res, 408, 'Request timeout. The puzzle is too complex or the system is overloaded.');
            }
            
            return sendError(res, 500, 'Failed to solve Wordle puzzle', error.message);
        }
    }

    // Get word games status (check if executable exists and is working)
    async getStatus(req, res) {
        try {
            // Test if the executable exists and responds
            const command = `--help`;
            
            try {
                await this.executeCommand(command, 10000); // 10 second timeout for status check
                return sendSuccess(res, {
                    status: 'available',
                    executable: this.executableFile,
                    platform: os.platform(),
                    message: 'Word games executable is available and responding'
                });
            } catch (error) {
                return sendSuccess(res, {
                    status: 'unavailable',
                    executable: this.executableFile,
                    platform: os.platform(),
                    message: 'Word games executable is not available or not responding',
                    error: error.message
                });
            }

        } catch (error) {
            console.error('Word games status check error:', error);
            return sendError(res, 500, 'Failed to check word games status', error.message);
        }
    }

    // Load a section of results from a file for any game mode
    async loadResults(req, res) {
        try {
            const { start = 0, end = 100, gameMode, fileType, filePath } = req.body;

            // Validate input
            if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
                return sendError(res, 400, 'Invalid start/end parameters');
            }

            if (!gameMode) {
                return sendError(res, 400, 'Game mode is required');
            }

            if (!fileType || !['possible', 'guesses', 'results'].includes(fileType)) {
                return sendError(res, 400, 'Valid file type is required (possible, guesses, or results)');
            }

            if (!filePath) {
                return sendError(res, 400, 'File path is required');
            }

            // Build read command
            const readCommand = `--mode read --file ${filePath} --start ${start} --end ${end}`;
            console.log(`Loading ${gameMode} ${fileType}: ${readCommand}`);
            const readResult = await this.executeCommand(readCommand);

            // Parse the output based on game mode and file type
            let solutions;
            if (gameMode === 'wordle' && fileType === 'guesses') {
                solutions = this.parseWordleGuesses(readResult.stdout);
            } else {
                solutions = this.parseWordGameOutput(readResult.stdout);
            }

            return sendSuccess(res, {
                solutions,
                start,
                end,
                gameMode,
                fileType,
                filePath,
                executionTime: readResult.executionTime
            });
        } catch (error) {
            console.error('Load results error:', error);
            return sendError(res, 500, 'Failed to load results', error.message);
        }
    }

    // Execute a command and return the result
    executeCommand(command, timeoutMs = this.timeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const fullCommand = `./${this.executableFile} ${command}`;
            exec(fullCommand, { 
                timeout: timeoutMs,
                maxBuffer: 1024 * 1024, // 1MB buffer for large outputs
                cwd: this.executableDir // Execute from ~/word_games directory
            }, (error, stdout, stderr) => {
                const executionTime = Date.now() - startTime;
                
                if (error) {
                    const errorMessage = stderr || error.message || 'Unknown error';
                    console.error(`Command execution error: ${errorMessage}`);
                    reject(new Error(`Command failed: ${errorMessage}`));
                    return;
                }

                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    executionTime: executionTime
                });
            });
        });
    }

    // Parse the output from word games executable into an array of solutions
    parseWordGameOutput(output) {
        if (!output || typeof output !== 'string') {
            return [];
        }

        // Split by lines and filter out empty lines
        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // For word games, assume each line is a solution
        // Filter out any lines that don't look like words (contain only letters)
        const solutions = lines.filter(line => /^[a-zA-Z\s\-,]+$/.test(line));

        // Limit results to 100 to prevent overwhelming the UI
        return solutions.slice(0, 100);
    }

    // Parse Wordle guesses output with entropy and probability
    parseWordleGuesses(output) {
        if (!output || typeof output !== 'string') {
            return [];
        }

        // Split by lines and filter out empty lines
        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const guesses = [];
        for (const line of lines) {
            // Expected format: "WORD Probability Entropy1 Entropy2..."
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const word = parts[0];
                const probability = parseFloat(parts[1]);
                const entropy = parseFloat(parts[2]);

                // Validate word format
                guesses.push({
                    word: word,
                    probability: probability,
                    entropy: entropy
                });
            }
        }

        // Limit results to 100 to prevent overwhelming the UI
        return guesses.slice(0, 100);
    }

    // Schedule file cleanup after 24 hours
    scheduleFileCleanup(filePath) {
        setTimeout(() => {
            this.cleanupResultsFile(filePath);
        }, this.cleanupDelay);
    }

    // Clean up a specific results file
    async cleanupResultsFile(filePath) {
        try {
            const fullPath = path.join(this.executableDir, filePath);
            const fs = require('fs').promises;
            
            // Check if file exists before attempting to delete
            try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
                console.log(`Cleaned up results file: ${filePath}`);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error(`Failed to cleanup results file ${filePath}:`, err.message);
                }
                // If file doesn't exist (ENOENT), that's fine - it's already cleaned up
            }
        } catch (error) {
            console.error(`Error during file cleanup for ${filePath}:`, error.message);
        }
    }

    // Clean up all old results files in the directory
    async cleanupOldResultsFiles() {
        try {
            const fs = require('fs').promises;
            const resultsDir = path.join(this.executableDir, this.resultsFolder);
            
            // Check if results directory exists
            try {
                await fs.access(resultsDir);
            } catch (err) {
                console.log('Results directory does not exist, nothing to clean up');
                return;
            }

            // Read all files in the results directory
            const files = await fs.readdir(resultsDir);
            const now = Date.now();

            let cleanedCount = 0;
            
            for (const filename of files) {
                try {
                    const filePath = path.join(resultsDir, filename);
                    const stats = await fs.stat(filePath);
                    
                    // Check if file is older than cleanupDelay
                    const fileAge = now - stats.mtime.getTime();

                    if (fileAge > this.cleanupDelay) {
                        await fs.unlink(filePath);
                        console.log(`Cleaned up old results file: ${filename} (age: ${Math.round(fileAge / 1000)}s)`);
                        cleanedCount++;
                    }
                } catch (err) {
                    console.error(`Error processing file ${filename} during cleanup:`, err.message);
                }
            }
            
        } catch (error) {
            console.error('Error during results directory cleanup:', error.message);
        }
    }
}

module.exports = WordGamesController;
