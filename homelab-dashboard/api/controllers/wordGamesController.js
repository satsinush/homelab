const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const { sendError, sendSuccess } = require('../utils/response');

class WordGamesController {
    constructor() {
        // Path to the word_games executable (built as p++)
        this.executableFile = 'word_games';
        this.executableDir = path.join('/app/word_games');
        this.timeout = 300000; // 5 minutes timeout
        this.resultsFolder = 'results';
        this.cleanupDelay = 60 * 60 * 1000; // 1 hour in milliseconds

        // Initialize by running --help
        this.executeCommand('--help', 30000);
        
        // Run initial cleanup on startup
        this.initialCleanup();
    }

    async initialCleanup() {
        try {
            console.log('Running initial cleanup of old results files...');
            await this.cleanupOldResultsFiles();
        } catch (error) {
            console.error('Error during initial cleanup:', error.message);
        }
    }

    generateResultsFilename(username, gameType) {
        const timestamp = Date.now();
        return path.join(this.resultsFolder, `${username || 'user'}_${gameType}_${timestamp}.txt`);
    }

    // Solve Letter Boxed puzzle
    async solveLetterBoxed(req, res) {
        try {
            const {
                letters,
                preset = 1,
                maxDepth,
                minWordLength,
                minUniqueLetters,
                pruneRedundantPaths,
                pruneDominatedClasses,
                start = 0,
                end = 100
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!letters || typeof letters !== 'string') {
                return sendError(res, 400, 'Letters parameter is required and must be a string');
            }

            const cleanLetters = letters.replace(/\s/g, '').toLowerCase();
            if (cleanLetters.length !== 12) {
                return sendError(res, 400, 'Letters must be exactly 12 characters for Letter Boxed');
            }

            if (!/^[a-z]+$/i.test(cleanLetters)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            const resultsFilename = this.generateResultsFilename(req.user.username, 'letterboxed');

            // Build command with new CLI format
            const args = [
                'letterboxed',
                `--letters ${cleanLetters}`,
                `-o ${resultsFilename}`
            ];

            // Use preset or custom config
            const presetVal = parseInt(preset);
            if (presetVal >= 1 && presetVal <= 3) {
                args.push(`--preset ${presetVal}`);
            } else {
                // Custom configuration (preset 0)
                if (maxDepth !== undefined) args.push(`--max-depth ${parseInt(maxDepth)}`);
                if (minWordLength !== undefined) args.push(`--min-word-length ${parseInt(minWordLength)}`);
                if (minUniqueLetters !== undefined) args.push(`--min-unique-letters ${parseInt(minUniqueLetters)}`);
                if (pruneRedundantPaths !== undefined) args.push(`--prune-paths ${pruneRedundantPaths ? 1 : 0}`);
                if (pruneDominatedClasses !== undefined) args.push(`--prune-classes ${pruneDominatedClasses ? 1 : 0}`);
            }

            const command = args.join(' ');
            console.log(`Executing Letter Boxed solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output: count and filename
            const outputLines = result.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]);
            const actualResultsFile = outputLines[1];

            if (isNaN(totalFound)) {
                return sendError(res, 500, 'Failed to parse result count from solver');
            }

            // Read results for the requested page
            const readCommand = `read ${actualResultsFile} --start ${start} --end ${end}`;
            const readResult = await this.executeCommand(readCommand);

            this.scheduleFileCleanup(actualResultsFile);

            const allSolutions = this.parseWordGameOutput(readResult.stdout);

            return sendSuccess(res, {
                success: true,
                gameType: 'letterboxed',
                letters: cleanLetters,
                preset: presetVal,
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
            const { 
                letters, 
                excludeUncommonWords = false,
                mustIncludeFirstLetter = true,
                reuseLetters = true,
                start = 0, 
                end = 100 
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!letters || typeof letters !== 'string') {
                return sendError(res, 400, 'Letters parameter is required and must be a string');
            }

            const cleanLetters = letters.replace(/\s/g, '').toLowerCase();
            if (cleanLetters.length < 3) {
                return sendError(res, 400, 'Letters must be at least 3 characters for Spelling Bee');
            }

            if (!/^[a-z]+$/i.test(cleanLetters)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            const resultsFilename = this.generateResultsFilename(req.user.username, 'spellingbee');

            // Build command with new CLI format
            const args = [
                'spellingbee',
                `--letters ${cleanLetters}`,
                `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
                `--must-include-first-letter ${mustIncludeFirstLetter ? 1 : 0}`,
                `--reuse-letters ${reuseLetters ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            const command = args.join(' ');
            console.log(`Executing Spelling Bee solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output: count and filename
            const outputLines = result.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]);
            const actualResultsFile = outputLines[1];

            if (isNaN(totalFound)) {
                return sendError(res, 500, 'Failed to parse result count from solver');
            }

            // Read results for the requested page
            const readCommand = `read ${actualResultsFile} --start ${start} --end ${end}`;
            const readResult = await this.executeCommand(readCommand);

            this.scheduleFileCleanup(actualResultsFile);

            const allSolutions = this.parseWordGameOutput(readResult.stdout);

            return sendSuccess(res, {
                success: true,
                gameType: 'spelling_bee',
                letters: cleanLetters,
                excludeUncommonWords,
                mustIncludeFirstLetter,
                reuseLetters,
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
    // Helper to read results file in chunks (parallel pagination for words and guesses)
    async readResultsFileChunks(filePath, start, end, possibleCount) {
        // We want to read two chunks:
        // 1. Possible words: lines [start+1, end] (capped at possibleCount)
        // 2. Guesses: lines [possibleCount + start + 1, possibleCount + end]
        // Note: sed is 1-indexed. end is exclusive in slice but inclusive in our logic?
        // Let's assume frontend requests count=100 (start=0, end=100) -> lines 1-100.
        
        const limit = end - start;
        const sedCommands = [];
        
        // Chunk 1: Possible Words
        if (start < possibleCount) {
            const chunk1Start = start + 1;
            const chunk1End = Math.min(end, possibleCount);
            if (chunk1Start <= chunk1End) {
                sedCommands.push(`${chunk1Start},${chunk1End}p`);
            }
        }
        
        // Chunk 2: Guesses
        // Guesses start after possibleCount lines
        const chunk2Start = possibleCount + start + 1;
        const chunk2End = possibleCount + end;
        // We don't strictly cap chunk2End effectively because file ends anyway, but sed handles it.
        sedCommands.push(`${chunk2Start},${chunk2End}p`);
        
        const info = sedCommands.join(';');
        const command = `sed -n '${info}' "${filePath}"`;
        
        try {
            const result = await this.executeCommand(command);
            return result.stdout;
        } catch (error) {
            console.error('Error reading results chunks:', error);
            // Fallback to reading head if sed fails (shouldn't happen on linux)
            return '';
        }
    }

    async solveWordle(req, res) {
        try {
            const { 
                guesses, 
                wordLength = 5,
                maxDepth = 0, 
                excludeUncommonWords = true, 
                start = 0, 
                end = 100 
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate max depth
            const depth = parseInt(maxDepth);
            if (isNaN(depth) || depth < 0 || depth > 1) {
                return sendError(res, 400, 'Max depth must be 0 or 1');
            }

            // Validate word length
            const wordLen = parseInt(wordLength);
            if (isNaN(wordLen) || wordLen < 1 || wordLen > 32) {
                return sendError(res, 400, 'Word length must be between 1 and 32');
            }

            const resultsFilename = this.generateResultsFilename(req.user.username, 'wordle');

            // Build guesses string in new format: "WORD COLORS;WORD2 COLORS2"
            let guessesStr = '';
            if (guesses && Array.isArray(guesses) && guesses.length > 0) {
                // Validate each guess
                for (let i = 0; i < guesses.length; i++) {
                    const guess = guesses[i];
                    if (!guess.word || !guess.feedback) {
                        return sendError(res, 400, `Guess ${i + 1} must have both 'word' and 'feedback' properties`);
                    }

                    const word = guess.word.trim().toUpperCase();
                    const feedback = guess.feedback.trim();

                    if (word.length !== wordLen) {
                        return sendError(res, 400, `Guess ${i + 1}: Word must be exactly ${wordLen} letters`);
                    }

                    if (!/^[A-Z]+$/.test(word)) {
                        return sendError(res, 400, `Guess ${i + 1}: Word must contain only letters`);
                    }

                    if (feedback.length !== wordLen) {
                        return sendError(res, 400, `Guess ${i + 1}: Feedback must be exactly ${wordLen} digits`);
                    }

                    if (!/^[012]+$/.test(feedback)) {
                        return sendError(res, 400, `Guess ${i + 1}: Feedback must contain only 0, 1, or 2`);
                    }
                }

                guessesStr = guesses.map(g => `${g.word.toUpperCase()} ${g.feedback}`).join(';');
            }

            // Build command with new CLI format
            const args = [
                'wordle',
                `--word-length ${wordLen}`,
                `--max-depth ${depth}`,
                `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            if (guessesStr) {
                args.push(`--guesses "${guessesStr}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Wordle solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output: possible count, guesses count, possible file, guesses file
            const outputLines = result.stdout.trim().split('\n');
            if (outputLines.length < 3) {
                return sendError(res, 500, 'Invalid output format from Wordle solver');
            }

            const possibleWordsCount = parseInt(outputLines[0]);
            const guessesCount = parseInt(outputLines[1]);
            const actualResultsFile = outputLines[2];

            if (isNaN(possibleWordsCount) || isNaN(guessesCount)) {
                return sendError(res, 500, 'Failed to parse counts from Wordle solver output');
            }

            this.scheduleFileCleanup(actualResultsFile);

            // Read results file chunks
            const stdout = await this.readResultsFileChunks(actualResultsFile, parseInt(start), parseInt(end), possibleWordsCount);
            const parsedResults = this.parseWordleOutput(stdout, possibleWordsCount);

            return sendSuccess(res, {
                success: true,
                gameType: 'wordle',
                guesses: guesses || [],
                wordLength: wordLen,
                maxDepth: depth,
                excludeUncommonWords,
                possibleWords: parsedResults.possibleWords,
                guessesWithEntropy: parsedResults.guessesWithEntropy,
                possibleWordsCount: possibleWordsCount,
                guessesCount: guessesCount,
                isLimitedPossible: possibleWordsCount > end,
                isLimitedGuesses: guessesCount > end,
                executionTime: result.executionTime,
                start,
                end,
                resultsFile: actualResultsFile
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

    async solveMastermind(req, res) {
        try {
            const { 
                guesses, 
                pegs = 4,
                colors = 6,
                maxDepth = 0,
                allowDuplicates = true,
                start = 0, 
                end = 100 
            } = req.body;

            // Validate pegs
            const numPegs = parseInt(pegs);
            const numColors = isNaN(parseInt(colors)) ? colors.length : parseInt(colors);
            
            if (isNaN(numPegs) || numPegs < 1 || numPegs > 10) return sendError(res, 400, 'Pegs must be between 1 and 10');
            if (numColors < 1 || numColors > 10) return sendError(res, 400, 'Colors must be between 1 and 10');

            const resultsFilename = this.generateResultsFilename(req.user.username, 'mastermind');

            // Build guesses string: "PATTERN R-W;PATTERN2 R-W"
            // where pattern is standard indices "0123" or CLI chars "RGBY"
            let guessesStr = '';
            if (guesses && Array.isArray(guesses) && guesses.length > 0) {
                 guessesStr = guesses.map(g => {
                     // Ensure pattern is clean
                     const pattern = String(g.pattern).replace(/\s+/g, '');
                     const red = g.feedback?.red || 0;
                     const white = g.feedback?.white || 0;
                     return `${pattern} ${red}-${white}`;
                 }).join(';');
            }

            // Build command
            const args = [
                'mastermind',
                `--pegs ${numPegs}`,
                `--colors ${numColors}`,
                `--duplicate ${allowDuplicates ? 1 : 0}`,
                `--max-depth ${maxDepth}`,
                `-o ${resultsFilename}`
            ];

            if (guessesStr) {
                args.push(`--guesses "${guessesStr}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Mastermind solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output
            const outputLines = result.stdout.trim().split('\n');
            if (outputLines.length < 3) {
                return sendError(res, 500, 'Invalid output format from Mastermind solver');
            }

            const possibleCount = parseInt(outputLines[0]);
            const guessesCount = parseInt(outputLines[1]);
            const actualResultsFile = outputLines[2];

            if (isNaN(possibleCount) || isNaN(guessesCount)) {
                return sendError(res, 500, 'Failed to parse counts from Mastermind solver output');
            }

            this.scheduleFileCleanup(actualResultsFile);

            // Read results file chunks
            const stdout = await this.readResultsFileChunks(actualResultsFile, parseInt(start), parseInt(end), possibleCount);
            const parsedResults = this.parseMastermindOutput(stdout, possibleCount);

            return sendSuccess(res, {
                success: true,
                gameType: 'mastermind',
                guesses: guesses || [],
                pegs: numPegs,
                colors: numColors,
                allowDuplicates,
                maxDepth,
                colorMapping: req.body.colorMapping, // Pass through color mapping
                possiblePatterns: parsedResults.possiblePatterns,
                guessesWithEntropy: parsedResults.guessesWithEntropy,
                possibleCount: possibleCount,
                guessesCount: guessesCount,
                isLimitedPossible: possibleCount > end,
                isLimitedGuesses: guessesCount > end,
                executionTime: result.executionTime,
                start,
                end,
                resultsFile: actualResultsFile
            });

        } catch (error) {
            console.error('Mastermind solver error:', error);
            if (error.message.includes('Command failed')) {
                return sendError(res, 500, 'Solver executable failed to run.');
            }
            return sendError(res, 500, 'Failed to solve Mastermind puzzle', error.message);
        }
    }

    // Solve Hangman puzzle
    async solveHangman(req, res) {
        try {
            const { 
                pattern,
                excludedLetters = '',
                maxDepth = 1,
                excludeUncommonWords = true,
                start = 0, 
                end = 100 
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!pattern || typeof pattern !== 'string') {
                return sendError(res, 400, 'Pattern parameter is required and must be a string');
            }

            // Validate pattern - should contain ? for unknown letters and actual letters for known
            const cleanPattern = pattern.toUpperCase();
            if (!/^[A-Z? ]+$/.test(cleanPattern)) {
                return sendError(res, 400, 'Pattern must contain only letters, ? for unknowns, and spaces');
            }

            // Validate excluded letters
            const cleanExcluded = excludedLetters.toUpperCase().replace(/[^A-Z]/g, '');

            // Validate max depth
            const depth = parseInt(maxDepth);
            if (isNaN(depth) || depth < 0 || depth > 2) {
                return sendError(res, 400, 'Max depth must be between 0 and 2');
            }

            const resultsFilename = this.generateResultsFilename(req.user.username, 'hangman');

            // Build input string in new format: "PATTERN;EXCLUDED"
            const inputStr = cleanExcluded ? `${cleanPattern};${cleanExcluded}` : cleanPattern;

            // Build command with new CLI format
            const args = [
                'hangman',
                `--input "${inputStr}"`,
                `--max-depth ${depth}`,
                `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            const command = args.join(' ');
            console.log(`Executing Hangman solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output: possible words count, letter guesses count, file
            const outputLines = result.stdout.trim().split('\n');
            if (outputLines.length < 3) {
                return sendError(res, 500, 'Invalid output format from Hangman solver');
            }

            const possibleWordsCount = parseInt(outputLines[0]);
            const letterGuessesCount = parseInt(outputLines[1]);
            const actualResultsFile = outputLines[2];

            if (isNaN(possibleWordsCount) || isNaN(letterGuessesCount)) {
                return sendError(res, 500, 'Failed to parse counts from Hangman solver output');
            }

            this.scheduleFileCleanup(actualResultsFile);

            // Read results file
            const readCommand = `read ${actualResultsFile} --start ${start} --end ${end}`;
            const readResult = await this.executeCommand(readCommand);
            const parsedResults = this.parseHangmanOutput(readResult.stdout, letterGuessesCount);

            return sendSuccess(res, {
                success: true,
                gameType: 'hangman',
                pattern: cleanPattern,
                excludedLetters: cleanExcluded,
                maxDepth: depth,
                excludeUncommonWords,
                letterSuggestions: parsedResults.letterSuggestions,
                possibleWords: parsedResults.possibleWords,
                possibleWordsCount: possibleWordsCount,
                letterGuessesCount: letterGuessesCount,
                isLimited: possibleWordsCount > end,
                executionTime: result.executionTime,
                start,
                end,
                resultsFile: actualResultsFile
            });

        } catch (error) {
            console.error('Hangman solver error:', error);
            
            if (error.message.includes('Command failed')) {
                return sendError(res, 500, 'Word games executable failed to run. Please check if the executable is available.');
            }
            
            if (error.message.includes('timeout')) {
                return sendError(res, 408, 'Request timeout. The puzzle is too complex or the system is overloaded.');
            }
            
            return sendError(res, 500, 'Failed to solve Hangman puzzle', error.message);
        }
    }

    // Solve Dungleon puzzle
    async solveDungleon(req, res) {
        try {
            const { 
                guesses, 
                solutions, // Past solutions for Gauntlet mode
                maxDepth = 0,
                excludeImpossiblePatterns = true,
                start = 0, 
                end = 100 
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate max depth
            const depth = parseInt(maxDepth);
            if (isNaN(depth) || depth < 0 || depth > 3) {
                return sendError(res, 400, 'Max depth must be between 0 and 3');
            }

            const resultsFilename = this.generateResultsFilename(req.user.username, 'dungleon');

            // Build guesses string in format: "aa bb cc dd ee 01234;..." without brackets/quotes per CLI expectation in dungleon.cpp
            let guessesStr = '';
            if (guesses && Array.isArray(guesses) && guesses.length > 0) {
                const guessStrs = [];
                for (let i = 0; i < guesses.length; i++) {
                    const guess = guesses[i];
                    if (!guess.pattern || !guess.feedback) {
                        return sendError(res, 400, `Guess ${i + 1} must have 'pattern' (space separated IDs) and 'feedback' (5 digits) properties`);
                    }

                    // Pattern should be space separated char IDs e.g. "ar kn ma bt dr"
                    const pattern = guess.pattern.trim().toLowerCase();
                    const feedback = guess.feedback.trim();

                    if (pattern.split(/\s+/).length !== 5) {
                        return sendError(res, 400, `Guess ${i + 1}: Pattern must be 5 space-separated character IDs`);
                    }

                    if (feedback.length !== 5 || !/^[0-4]+$/.test(feedback)) {
                        return sendError(res, 400, `Guess ${i + 1}: Feedback must be exactly 5 digits (0-4)`);
                    }

                    guessStrs.push(`${pattern} ${feedback}`);
                }
                guessesStr = guessStrs.join(';');
            }

            // Build solutions string in format: "aa bb cc dd ee;..."
            let solutionsStr = '';
            if (solutions && Array.isArray(solutions) && solutions.length > 0) {
                const solStrs = [];
                for (let i = 0; i < solutions.length; i++) {
                    const sol = solutions[i];
                    if (!sol.pattern) {
                         // Support both object {pattern: "..."} and direct string
                         if (typeof sol === 'string') {
                             // Direct string
                         } else {
                             return sendError(res, 400, `Solution ${i + 1} must have 'pattern' property or be a string`);
                         }
                    }

                    const pattern = (typeof sol === 'string' ? sol : sol.pattern).trim().toLowerCase();

                    if (pattern.split(/\s+/).length !== 5) {
                        return sendError(res, 400, `Solution ${i + 1}: Pattern must be 5 space-separated character IDs`);
                    }
                    solStrs.push(pattern);
                }
                solutionsStr = solStrs.join(';');
            }

            // Build command
            const args = [
                'dungleon',
                `--max-depth ${depth}`,
                `--exclude-impossible ${excludeImpossiblePatterns ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            if (guessesStr) args.push(`--guesses "${guessesStr}"`);
            if (solutionsStr) args.push(`--solutions "${solutionsStr}"`);

            const command = args.join(' ');
            console.log(`Executing Dungleon solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output
            const outputLines = result.stdout.trim().split('\n');
            if (outputLines.length < 3) {
                return sendError(res, 500, 'Invalid output from Dungleon solver');
            }

            const possibleCount = parseInt(outputLines[0]);
            const guessesCount = parseInt(outputLines[1]);
            const actualResultsFile = outputLines[2];

            this.scheduleFileCleanup(actualResultsFile);

            // Read results file chunks
            const stdout = await this.readResultsFileChunks(actualResultsFile, parseInt(start), parseInt(end), possibleCount);
            const parsedResults = this.parseDungleonOutput(stdout, possibleCount);

            return sendSuccess(res, {
                success: true,
                gameType: 'dungleon',
                guesses: guesses || [],
                solutions: solutions || [],
                maxDepth,
                excludeImpossiblePatterns,
                possiblePatterns: parsedResults.possiblePatterns,
                guessesWithEntropy: parsedResults.guessesWithEntropy,
                possiblePatternsCount: possibleCount,
                guessesCount: guessesCount,
                isLimitedPossible: possibleCount > end,
                isLimitedGuesses: guessesCount > end,
                executionTime: result.executionTime,
                start,
                end,
                resultsFile: actualResultsFile
            });

        } catch (error) {
            console.error('Dungleon solver error:', error);
            if (error.message.includes('Command failed')) {
                return sendError(res, 500, 'Solver executable failed to run.');
            }
            return sendError(res, 500, 'Failed to solve Dungleon puzzle', error.message);
        }
    }

    // Get word games status
    async getStatus(req, res) {
        try {
            const command = `--help`;
            
            try {
                await this.executeCommand(command, 10000);
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

    // Load a section of results from a file
    async loadResults(req, res) {
        try {
            const { start = 0, end = 100, gameMode, fileType, filePath } = req.body;

            if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
                return sendError(res, 400, 'Invalid start/end parameters');
            }

            if (!gameMode) {
                return sendError(res, 400, 'Game mode is required');
            }

            if (!filePath) {
                return sendError(res, 400, 'File path is required');
            }

            const readCommand = `read ${filePath} --start ${start} --end ${end}`;
            console.log(`Loading ${gameMode} results: ${readCommand}`);
            const readResult = await this.executeCommand(readCommand);

            // Parse based on game mode
            let solutions;
            switch (gameMode) {
                case 'wordle':
                    solutions = this.parseWordleOutput(readResult.stdout, 0);
                    break;
                case 'mastermind':
                    solutions = this.parseMastermindOutput(readResult.stdout, 0);
                    break;
                case 'hangman':
                    solutions = this.parseHangmanOutput(readResult.stdout, 0);
                    break;
                case 'dungleon':
                    solutions = this.parseDungleonOutput(readResult.stdout, 0);
                    break;
                default:
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
                maxBuffer: 1024 * 1024 * 5, // 5MB buffer for large outputs
                cwd: this.executableDir,
                shell: '/bin/sh'
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

    // Parse generic word game output
    parseWordGameOutput(output) {
        if (!output || typeof output !== 'string') {
            return [];
        }

        const lines = output.split('\n')
            .map(line => line.trim().toUpperCase())
            .filter(line => line.length > 0);

        // Filter to lines that look like words/solutions
        const solutions = lines.filter(line => /^[A-Z\s\-,]+$/.test(line));

        return solutions;
    }

    // Parse Wordle output with possible words and guesses with entropy
    parseWordleOutput(output, possibleCount) {
        if (!output || typeof output !== 'string') {
            return { possibleWords: [], guessesWithEntropy: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const possibleWords = [];
        const guessesWithEntropy = [];

        for (const line of lines) {
            // Check if it's a guess with entropy: "WORD,entropy,probability"
            if (line.includes(',')) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    guessesWithEntropy.push({
                        word: parts[0].toUpperCase(),
                        entropy: parseFloat(parts[1]),
                        probability: parseFloat(parts[2])
                    });
                }
            } else {
                // It's a possible word
                const word = line.toUpperCase();
                if (/^[A-Z]+$/.test(word)) {
                    possibleWords.push(word);
                }
            }
        }

        return { possibleWords, guessesWithEntropy };
    }

    // Parse Mastermind output with possible patterns and guesses with entropy
    parseMastermindOutput(output, possibleCount) {
        if (!output || typeof output !== 'string') {
            return { possiblePatterns: [], guessesWithEntropy: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const possiblePatterns = [];
        const guessesWithEntropy = [];

        for (const line of lines) {
            // Check if it's a guess with entropy: "PATTERN,entropy,probability"
            if (line.includes(',')) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    guessesWithEntropy.push({
                        pattern: parts[0].toUpperCase(),
                        entropy: parseFloat(parts[1]),
                        probability: parseFloat(parts[2])
                    });
                }
            } else {
                // It's a possible pattern
                const pattern = line.toUpperCase();
                if (/^[A-Z]+$/.test(pattern)) {
                    possiblePatterns.push(pattern);
                }
            }
        }

        return { possiblePatterns, guessesWithEntropy };
    }

    // Parse Hangman output with letter suggestions and possible words
    parseHangmanOutput(output, letterCount) {
        if (!output || typeof output !== 'string') {
            return { letterSuggestions: [], possibleWords: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const letterSuggestions = [];
        const possibleWords = [];

        for (const line of lines) {
            // Check if it's a letter suggestion: "LETTER entropy probability"
            const parts = line.split(/[\s,]+/);
            if (parts.length >= 3 && parts[0].length === 1 && /^[A-Z]$/i.test(parts[0])) {
                letterSuggestions.push({
                    letter: parts[0].toUpperCase(),
                    entropy: parseFloat(parts[1]),
                    probability: parseFloat(parts[2])
                });
            } else {
                // It's a possible word
                const word = line.toUpperCase();
                if (/^[A-Z]+$/.test(word)) {
                    possibleWords.push(word);
                }
            }
        }

        return { letterSuggestions, possibleWords };
    }

    // Parse Dungleon output
    parseDungleonOutput(output, possibleCount) {
        if (!output || typeof output !== 'string') {
            return { possiblePatterns: [], guessesWithEntropy: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const possiblePatterns = [];
        const guessesWithEntropy = [];

        for (const line of lines) {
            // Check if it's a guess with entropy: "aa bb cc dd ee,entropy,probability"
            if (line.includes(',')) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    guessesWithEntropy.push({
                        pattern: parts[0].trim(),
                        entropy: parseFloat(parts[1]),
                        probability: parseFloat(parts[2])
                    });
                }
            } else {
                // It's a possible pattern: "aa bb cc dd ee"
                if (line.split(/\s+/).length === 5) {
                    possiblePatterns.push(line);
                }
            }
        }

        return { possiblePatterns, guessesWithEntropy };
    }

    // Schedule file cleanup
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
            
            try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
                console.log(`Cleaned up results file: ${filePath}`);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error(`Failed to cleanup results file ${filePath}:`, err.message);
                }
            }
        } catch (error) {
            console.error(`Error during file cleanup for ${filePath}:`, error.message);
        }
    }

    // Clean up all old results files
    async cleanupOldResultsFiles() {
        try {
            const fs = require('fs').promises;
            const resultsDir = path.join(this.executableDir, this.resultsFolder);
            
            try {
                await fs.access(resultsDir);
            } catch (err) {
                console.log('Results directory does not exist, nothing to clean up');
                return;
            }

            const files = await fs.readdir(resultsDir);
            const now = Date.now();

            let cleanedCount = 0;
            
            for (const filename of files) {
                try {
                    const filePath = path.join(resultsDir, filename);
                    const stats = await fs.stat(filePath);
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
