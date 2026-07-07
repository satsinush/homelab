import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { sendError, sendSuccess } from '../utils/response';
import { Request, Response } from 'express';

interface GuessWithEntropy {
    word?: string;
    pattern?: string;
    entropy: number;
    probability: number;
}

interface LetterSuggestion {
    letter: string;
    entropy: number;
    probability: number;
}

class WordGamesController {
    private executableFile: string;
    private executableDir: string;
    private timeout: number;
    private resultsFolder: string;
    private cleanupDelay: number;

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
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Error during initial cleanup:', err.message);
        }
    }

    generateResultsFilename(username: string, gameType: string): string {
        const timestamp = Date.now();
        return path.join(this.resultsFolder, `${username || 'user'}_${gameType}_${timestamp}.txt`);
    }

    // Solve Letter Boxed puzzle
    async solveLetterBoxed(req: Request, res: Response) {
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

            const username = req.user?.username || 'user';
            const resultsFilename = this.generateResultsFilename(username, 'letterboxed');

            // Build command with CLI format: letterboxed --letters <12letters> [--preset N] [-o file]
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

            const startTime = Date.now();
            const result = await this.executeCommand(command);
            const executionTime = Date.now() - startTime;

            // Parse output: the C++ headless mode outputs:
            //   line 1: solution count
            //   line 2: output filename (no trailing newline)
            const outputLines = result.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]) || 0;
            const actualResultsFile = (outputLines[1] || resultsFilename).trim();

            // Verify file exists
            const fullResultsPath = path.join(this.executableDir, actualResultsFile);
            if (!fs.existsSync(fullResultsPath)) {
                return sendError(res, 500, 'Solver executed but results file was not found');
            }

            // Read the requested chunk
            const startIndex = parseInt(start) || 0;
            const endIndex = parseInt(end) || 100;
            const solutions = await this.readResultsChunk(actualResultsFile, startIndex, endIndex);

            // Schedule deletion after 1 hour
            this.scheduleFileCleanup(actualResultsFile);

            const isLimited = totalFound > (endIndex - startIndex);

            return sendSuccess(res, {
                success: true,
                totalSolutions: Math.min(totalFound, endIndex - startIndex),
                actualTotalFound: totalFound,
                isLimited,
                executionTime,
                start: startIndex,
                end: endIndex,
                solutions: solutions,
                resultsFile: actualResultsFile,
                actualResultsFile: actualResultsFile,
                letters: cleanLetters,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Letter Boxed solve error:', err);
            return sendError(res, 500, 'Failed to solve Letter Boxed puzzle', err.message);
        }
    }

    // Solve Spelling Bee puzzle
    async solveSpellingBee(req: Request, res: Response) {
        try {
            const {
                centerLetter,
                outerLetters,
                minWordLength = 4,
                start = 0,
                end = 100
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!centerLetter || typeof centerLetter !== 'string' || centerLetter.trim().length !== 1) {
                return sendError(res, 400, 'Center letter is required and must be a single character');
            }

            if (!outerLetters || typeof outerLetters !== 'string') {
                return sendError(res, 400, 'Outer letters are required and must be a string');
            }

            const cleanCenter = centerLetter.trim().toLowerCase();
            const cleanOuter = outerLetters.replace(/\s/g, '').toLowerCase();

            if (cleanOuter.length !== 6) {
                return sendError(res, 400, 'Outer letters must be exactly 6 characters');
            }

            if (!/^[a-z]+$/i.test(cleanCenter + cleanOuter)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            // Check if center letter is in outer letters
            if (cleanOuter.includes(cleanCenter)) {
                return sendError(res, 400, 'Center letter cannot be in outer letters list');
            }

            const username = req.user?.username || 'user';
            const resultsFilename = this.generateResultsFilename(username, 'spellingbee');

            // Build command with CLI format: spellingbee --letters <letters> [options] -o <file>
            // The C++ CLI expects --letters with center letter first, followed by outer letters
            const allLetters = cleanCenter + cleanOuter;
            const args = [
                'spellingbee',
                `--letters ${allLetters}`,
                `--must-include-first-letter 1`,
                `--reuse-letters 1`,
                `-o ${resultsFilename}`
            ];

            const command = args.join(' ');
            console.log(`Executing Spelling Bee solver: ${command}`);

            const startTime = Date.now();
            const result = await this.executeCommand(command);
            const executionTime = Date.now() - startTime;

            // Parse output: the C++ headless mode outputs:
            //   line 1: word count
            //   line 2: output filename (no trailing newline)
            const outputLines = result.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]) || 0;
            const actualResultsFile = (outputLines[1] || resultsFilename).trim();

            // Verify file exists
            const fullResultsPath = path.join(this.executableDir, actualResultsFile);
            if (!fs.existsSync(fullResultsPath)) {
                return sendError(res, 500, 'Solver executed but results file was not found');
            }

            // Read the requested chunk (SpellingBee results file has NO header rows, just words)
            const startIndex = parseInt(start) || 0;
            const endIndex = parseInt(end) || 100;
            const solutions = await this.readResultsChunkNoHeader(actualResultsFile, startIndex, endIndex);

            // Schedule deletion after 1 hour
            this.scheduleFileCleanup(actualResultsFile);

            const isLimited = totalFound > (endIndex - startIndex);

            return sendSuccess(res, {
                success: true,
                totalSolutions: Math.min(totalFound, endIndex - startIndex),
                actualTotalFound: totalFound,
                isLimited,
                executionTime,
                start: startIndex,
                end: endIndex,
                solutions: solutions,
                resultsFile: actualResultsFile,
                actualResultsFile: actualResultsFile,
                letters: allLetters,
                centerLetter: cleanCenter,
                outerLetters: cleanOuter,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Spelling Bee solve error:', err);
            return sendError(res, 500, 'Failed to solve Spelling Bee puzzle', err.message);
        }
    }

    // Solve Wordle puzzle step
    async solveWordle(req: Request, res: Response) {
        try {
            const {
                guesses = [],
                results = [],
                wordLength = 5,
                maxDepth = 0,
                excludeUncommonWords = 0
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!Array.isArray(guesses) || !Array.isArray(results) || guesses.length !== results.length) {
                return sendError(res, 400, 'Guesses and results must be arrays of the same length');
            }

            const len = parseInt(wordLength) || 5;

            // Validate guesses and results
            for (let i = 0; i < guesses.length; i++) {
                const guess = guesses[i];
                const result = results[i];
                if (typeof guess !== 'string' || guess.length !== len) {
                    return sendError(res, 400, `Guess at index ${i} must be a string of length ${len}`);
                }
                if (typeof result !== 'string' || result.length !== len) {
                    return sendError(res, 400, `Result at index ${i} must be a string of length ${len} containing only G, Y, X`);
                }
                if (!/^[gyx]+$/i.test(result)) {
                    return sendError(res, 400, `Result at index ${i} must contain only G, Y, or X (case-insensitive)`);
                }
            }

            const username = req.user?.username || 'user';
            const resultsFilename = this.generateResultsFilename(username, 'wordle');

            // Build command with CLI format: wordle --word-length N --max-depth N --guesses "WORD COLORS;..." -o file
            // The C++ CLI expects --guesses with format "WORD COLORS;WORD2 COLORS2"
            // where COLORS uses 0=grey, 1=yellow, 2=green
            const args = [
                'wordle',
                `--word-length ${len}`,
                `--max-depth ${parseInt(maxDepth) || 0}`,
                `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            // Build the --guesses string: convert G/Y/X feedback to 0/1/2 numeric format
            if (guesses.length > 0) {
                const feedbackColorMap: Record<string, string> = { 'X': '0', 'Y': '1', 'G': '2' };
                const guessPairs = guesses.map((guess: string, i: number) => {
                    const word = guess.toLowerCase();
                    const colors = results[i].toUpperCase().split('').map((c: string) => feedbackColorMap[c] || '0').join('');
                    return `${word} ${colors}`;
                });
                args.push(`--guesses "${guessPairs.join(';')}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Wordle solver: ${command}`);

            const startTime = Date.now();
            const resultVal = await this.executeCommand(command);
            const executionTime = Date.now() - startTime;

            // Parse stdout: the C++ headless mode outputs:
            //   line 1: total possible words count
            //   line 2: total sorted guesses count
            //   line 3: output filename (no trailing newline)
            const outputLines = resultVal.stdout.trim().split('\n');
            const possibleWordsCount = parseInt(outputLines[0]) || 0;
            const guessesCount = parseInt(outputLines[1]) || 0;
            const actualResultsFile = (outputLines[2] || resultsFilename).trim();

            // Read the results file to get words and entropy data
            // File format: possible words (one per line), then CSV lines: word,entropy,probability
            let possibleWords: string[] = [];
            let guessesWithEntropy: GuessWithEntropy[] = [];

            const fullPath = path.join(this.executableDir, actualResultsFile);
            if (fs.existsSync(fullPath)) {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                const parsed = this.parseWordleOutput(fileContent, possibleWordsCount);
                possibleWords = parsed.possibleWords;
                guessesWithEntropy = parsed.guessesWithEntropy;

                // Schedule deletion after 1 hour
                this.scheduleFileCleanup(actualResultsFile);
            }

            const isLimitedPossible = possibleWords.length > 100;
            const isLimitedGuesses = guessesWithEntropy.length > 100;

            return sendSuccess(res, {
                success: true,
                possibleWordsCount,
                guessesCount,
                isLimitedPossible,
                isLimitedGuesses,
                executionTime,
                start: 0,
                end: 100,
                possibleWords: possibleWords.slice(0, 100),
                guessesWithEntropy: guessesWithEntropy.slice(0, 100),
                resultsFile: actualResultsFile,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Wordle solve error:', err);
            return sendError(res, 500, 'Failed to solve Wordle step', err.message);
        }
    }

    // Solve Mastermind step
    async solveMastermind(req: Request, res: Response) {
        try {
            const {
                guesses = [],
                blackPegs = [],
                whitePegs = [],
                slots = 4,
                colors = 6,
                duplicates = true,
                maxDepth = 1
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!Array.isArray(guesses) || !Array.isArray(blackPegs) || !Array.isArray(whitePegs) ||
                guesses.length !== blackPegs.length || guesses.length !== whitePegs.length) {
                return sendError(res, 400, 'Guesses, blackPegs, and whitePegs must be arrays of the same length');
            }

            const slotsCount = parseInt(slots) || 4;
            const colorsCount = parseInt(colors) || 6;

            // Validate guesses
            for (let i = 0; i < guesses.length; i++) {
                const guess = guesses[i];
                if (typeof guess !== 'string' || guess.length !== slotsCount) {
                    return sendError(res, 400, `Guess at index ${i} must be a string of length ${slotsCount}`);
                }
                
                // Colors are letters starting from A, e.g. 6 colors -> A-F
                const maxChar = String.fromCharCode(65 + colorsCount - 1);
                const charRegex = new RegExp(`^[A-${maxChar}]+$`, 'i');
                if (!charRegex.test(guess)) {
                    return sendError(res, 400, `Guess at index ${i} must only contain letters A-${maxChar} (case-insensitive)`);
                }

                const b = parseInt(blackPegs[i]);
                const w = parseInt(whitePegs[i]);
                if (isNaN(b) || b < 0 || b > slotsCount) {
                    return sendError(res, 400, `blackPegs at index ${i} must be a number between 0 and ${slotsCount}`);
                }
                if (isNaN(w) || w < 0 || w > slotsCount || (b + w) > slotsCount) {
                    return sendError(res, 400, `Invalid pegs total at index ${i}. Black + White pegs cannot exceed slots count (${slotsCount})`);
                }
            }

            const username = req.user?.username || 'user';
            const resultsFilename = this.generateResultsFilename(username, 'mastermind');

            // Build command with CLI format: mastermind --pegs N --colors "CHARS" --allow-duplicates N --max-depth N --guesses "PATTERN B W;..." -o file
            // Generate the color character string (e.g., 6 colors -> "ABCDEF")
            let colorChars = '';
            for (let i = 0; i < colorsCount; i++) {
                colorChars += String.fromCharCode(65 + i);
            }

            const args = [
                'mastermind',
                `--pegs ${slotsCount}`,
                `--colors "${colorChars}"`,
                `--allow-duplicates ${duplicates ? 1 : 0}`,
                `--max-depth ${parseInt(maxDepth) || 1}`,
                `-o ${resultsFilename}`
            ];

            // Build the --guesses string: "PATTERN B W;PATTERN2 B2 W2"
            if (guesses.length > 0) {
                const guessPairs = guesses.map((guess: string, i: number) => {
                    return `${guess.toUpperCase()} ${blackPegs[i]} ${whitePegs[i]}`;
                });
                args.push(`--guesses "${guessPairs.join(';')}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Mastermind solver: ${command}`);

            const startTime = Date.now();
            const result = await this.executeCommand(command);
            const executionTime = Date.now() - startTime;

            // Parse stdout: the C++ headless mode outputs:
            //   line 1: total possible patterns count
            //   line 2: total sorted guesses count
            //   line 3: output filename (no trailing newline)
            const outputLines = result.stdout.trim().split('\n');
            const possibleCount = parseInt(outputLines[0]) || 0;
            const guessesCount = parseInt(outputLines[1]) || 0;
            const actualResultsFile = (outputLines[2] || resultsFilename).trim();

            // Read the results file
            let possiblePatterns: string[] = [];
            let guessesWithEntropy: GuessWithEntropy[] = [];

            const fullPath = path.join(this.executableDir, actualResultsFile);
            if (fs.existsSync(fullPath)) {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                const parsed = this.parseMastermindOutput(fileContent, possibleCount);
                possiblePatterns = parsed.possiblePatterns;
                guessesWithEntropy = parsed.guessesWithEntropy;

                this.scheduleFileCleanup(actualResultsFile);
            }

            const isLimitedPossible = possiblePatterns.length > 100;
            const isLimitedGuesses = guessesWithEntropy.length > 100;

            return sendSuccess(res, {
                success: true,
                possibleCount,
                guessesCount,
                isLimitedPossible,
                isLimitedGuesses,
                executionTime,
                start: 0,
                end: 100,
                possiblePatterns: possiblePatterns.slice(0, 100),
                guessesWithEntropy: guessesWithEntropy.slice(0, 100),
                resultsFile: actualResultsFile,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Mastermind solve error:', err);
            return sendError(res, 500, 'Failed to solve Mastermind step', err.message);
        }
    }

    // Solve Dungleon step
    async solveDungleon(req: Request, res: Response) {
        try {
            const {
                guesses = [],
                results = [],
                maxDepth = 0,
                excludeImpossiblePatterns = 0
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!Array.isArray(guesses) || !Array.isArray(results) || guesses.length !== results.length) {
                return sendError(res, 400, 'Guesses and results must be arrays of the same length');
            }

            // Validate guesses and results
            for (let i = 0; i < guesses.length; i++) {
                const guess = guesses[i];
                const result = results[i];
                if (typeof guess !== 'string' || guess.trim().split(/\s+/).length !== 5) {
                    return sendError(res, 400, `Guess at index ${i} must be a space-separated string of exactly 5 character IDs`);
                }
                if (typeof result !== 'string' || result.length !== 5) {
                    return sendError(res, 400, `Result at index ${i} must be a string of length 5 containing only G, Y, X, R, D`);
                }
                if (!/^[gyxrd]+$/i.test(result)) {
                    return sendError(res, 400, `Result at index ${i} must contain only G, Y, X, R, D (case-insensitive)`);
                }
            }

            const username = req.user?.username || 'user';
            const resultsFilename = this.generateResultsFilename(username, 'dungleon');

            // Build command with CLI format: dungleon --max-depth N --guesses "chars colors;..." -o file
            // The C++ CLI expects --guesses with format "ar kn ma bt dr 01234;ar kn bo ne fr 00010"
            // where colors are 0-4 (not G/Y/X/R/D)
            const args = [
                'dungleon',
                `--max-depth ${parseInt(maxDepth) || 0}`,
                `--exclude-impossible ${excludeImpossiblePatterns ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            // Build the --guesses string: convert G/Y/X/R/D to 0-4 numeric format
            if (guesses.length > 0) {
                // Dungleon colors: X=0 (not present), Y=1 (wrong pos no more), G=2 (correct pos no more),
                //                   R=3 (wrong pos one more), D=4 (correct pos one more)
                const feedbackColorMap: Record<string, string> = { 'X': '0', 'Y': '1', 'G': '2', 'R': '3', 'D': '4' };
                const guessPairs = guesses.map((guess: string, i: number) => {
                    const normalizedGuess = guess.toLowerCase().replace(/\s+/g, ' ').trim();
                    const colors = results[i].toUpperCase().split('').map((c: string) => feedbackColorMap[c] || '0').join('');
                    return `${normalizedGuess} ${colors}`;
                });
                args.push(`--guesses "${guessPairs.join(';')}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Dungleon solver: ${command}`);

            const startTime = Date.now();
            const result = await this.executeCommand(command);
            const executionTime = Date.now() - startTime;

            // Parse stdout: the C++ headless mode outputs:
            //   line 1: total possible patterns count
            //   line 2: total sorted guesses count
            //   line 3: output filename (no trailing newline)
            const outputLines = result.stdout.trim().split('\n');
            const possiblePatternsCount = parseInt(outputLines[0]) || 0;
            const guessesCount = parseInt(outputLines[1]) || 0;
            const actualResultsFile = (outputLines[2] || resultsFilename).trim();

            // Read the results file
            let possiblePatterns: string[] = [];
            let guessesWithEntropy: GuessWithEntropy[] = [];

            const fullPath = path.join(this.executableDir, actualResultsFile);
            if (fs.existsSync(fullPath)) {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                const parsed = this.parseDungleonOutput(fileContent, possiblePatternsCount);
                possiblePatterns = parsed.possiblePatterns;
                guessesWithEntropy = parsed.guessesWithEntropy;

                this.scheduleFileCleanup(actualResultsFile);
            }

            const isLimitedPossible = possiblePatterns.length > 100;
            const isLimitedGuesses = guessesWithEntropy.length > 100;

            return sendSuccess(res, {
                success: true,
                possiblePatternsCount,
                guessesCount,
                isLimitedPossible,
                isLimitedGuesses,
                executionTime,
                start: 0,
                end: 100,
                possiblePatterns: possiblePatterns.slice(0, 100),
                guessesWithEntropy: guessesWithEntropy.slice(0, 100),
                resultsFile: actualResultsFile,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Dungleon solve error:', err);
            return sendError(res, 500, 'Failed to solve Dungleon step', err.message);
        }
    }

    // Solve Hangman step
    async solveHangman(req: Request, res: Response) {
        try {
            const {
                pattern,
                excludedLetters = '',
                maxDepth = 0,
                excludeUncommonWords = false
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!pattern || typeof pattern !== 'string') {
                return sendError(res, 400, 'Pattern is required and must be a string (e.g., "_PP_E")');
            }

            // Accept both ? and _ as unknown characters, normalize to _
            const cleanPattern = pattern.trim().toUpperCase().replace(/\?/g, '_');
            const cleanGuessed = (typeof excludedLetters === 'string' ? excludedLetters : '').replace(/[^a-z]/gi, '').toUpperCase();

            // Validate pattern (must contain only letters, underscores, and spaces)
            if (!/^[A-Z_ ]+$/.test(cleanPattern)) {
                return sendError(res, 400, 'Pattern must contain only alphabetic characters, underscores (_), and spaces');
            }

            const username = req.user?.username || 'user';
            const resultsFilename = this.generateResultsFilename(username, 'hangman');

            // Build command with CLI format: hangman --input "PATTERN;STRIKES" --max-depth N --exclude-uncommon-words N -o file
            // The C++ CLI expects --input with format "PATTERN;STRIKES" or separate --pattern and --strikes
            // Pattern uses _ for unknown letters (lowercase internally)
            const patternLower = cleanPattern.toLowerCase();

            const args = [
                'hangman',
                `--max-depth ${parseInt(maxDepth) || 0}`,
                `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
                `-o ${resultsFilename}`
            ];

            // Use --input format: "pattern;strikes"
            if (cleanGuessed.length > 0) {
                args.push(`--input "${patternLower};${cleanGuessed.toLowerCase()}"`);
            } else {
                args.push(`--pattern "${patternLower}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Hangman solver: ${command}`);

            const startTime = Date.now();
            const result = await this.executeCommand(command);
            const executionTime = Date.now() - startTime;

            // Parse stdout: the C++ headless mode outputs:
            //   line 1: total possible words count
            //   line 2: total letter guesses count
            //   line 3: output filename (no trailing newline)
            const outputLines = result.stdout.trim().split('\n');
            const possibleWordsCount = parseInt(outputLines[0]) || 0;
            const letterGuessesCount = parseInt(outputLines[1]) || 0;
            const actualResultsFile = (outputLines[2] || resultsFilename).trim();

            // Read the results file
            let letterSuggestions: LetterSuggestion[] = [];
            let possibleWords: string[] = [];

            const fullPath = path.join(this.executableDir, actualResultsFile);
            if (fs.existsSync(fullPath)) {
                const fileContent = fs.readFileSync(fullPath, 'utf8');
                const parsed = this.parseHangmanOutput(fileContent, letterGuessesCount);
                letterSuggestions = parsed.letterSuggestions;
                possibleWords = parsed.possibleWords;

                this.scheduleFileCleanup(actualResultsFile);
            }

            const isLimited = possibleWords.length > 100;

            return sendSuccess(res, {
                success: true,
                pattern: cleanPattern,
                excludedLetters: cleanGuessed,
                possibleWordsCount,
                letterGuessesCount,
                isLimited,
                executionTime,
                start: 0,
                end: 100,
                letterSuggestions,
                possibleWords: possibleWords.slice(0, 100),
                resultsFile: actualResultsFile,
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Hangman solve error:', err);
            return sendError(res, 500, 'Failed to solve Hangman step', err.message);
        }
    }

    // Load results chunk endpoint
    async loadResults(req: Request, res: Response) {
        try {
            const {
                start = 0,
                end = 100,
                gameMode,
                fileType
            } = req.body;

            const resultsFile = req.body.resultsFile || req.body.filePath;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!resultsFile || typeof resultsFile !== 'string') {
                return sendError(res, 400, 'resultsFile or filePath parameter is required and must be a string');
            }

            // Prevent path traversal
            const cleanResultsFile = path.basename(resultsFile);
            const fullResultsPath = path.join(this.executableDir, this.resultsFolder, cleanResultsFile);

            if (!fs.existsSync(fullResultsPath)) {
                return sendError(res, 404, 'Results file not found or has expired');
            }

            const startIndex = parseInt(start) || 0;
            const endIndex = parseInt(end) || 100;
            
            const relativePath = path.join(this.resultsFolder, cleanResultsFile);

            // Handle pagination based on gameMode
            if (gameMode === 'wordle' || gameMode === 'mastermind' || gameMode === 'hangman' || gameMode === 'dungleon') {
                const fileContent = fs.readFileSync(fullResultsPath, 'utf8');
                let solutions: any = {};

                if (gameMode === 'wordle') {
                    const parsed = this.parseWordleOutput(fileContent, 0);
                    if (fileType === 'possible') {
                        solutions = { possibleWords: parsed.possibleWords.slice(startIndex, endIndex) };
                    } else {
                        solutions = { guessesWithEntropy: parsed.guessesWithEntropy.slice(startIndex, endIndex) };
                    }
                } else if (gameMode === 'mastermind') {
                    const parsed = this.parseMastermindOutput(fileContent, 0);
                    if (fileType === 'possible') {
                        solutions = { possiblePatterns: parsed.possiblePatterns.slice(startIndex, endIndex) };
                    } else {
                        solutions = { guessesWithEntropy: parsed.guessesWithEntropy.slice(startIndex, endIndex) };
                    }
                } else if (gameMode === 'hangman') {
                    const parsed = this.parseHangmanOutput(fileContent, 0);
                    solutions = { possibleWords: parsed.possibleWords.slice(startIndex, endIndex) };
                } else if (gameMode === 'dungleon') {
                    const parsed = this.parseDungleonOutput(fileContent, 0);
                    if (fileType === 'possible') {
                        solutions = { possiblePatterns: parsed.possiblePatterns.slice(startIndex, endIndex) };
                    } else {
                        solutions = { guessesWithEntropy: parsed.guessesWithEntropy.slice(startIndex, endIndex) };
                    }
                }

                return sendSuccess(res, {
                    success: true,
                    solutions: solutions,
                    resultsFile: relativePath,
                    range: { start: startIndex, end: endIndex },
                    timestamp: new Date().toISOString()
                });
            }

            let solutions: string[] = [];
            if (gameMode === 'spellingbee') {
                solutions = await this.readResultsChunkNoHeader(relativePath, startIndex, endIndex);
            } else {
                solutions = await this.readResultsChunk(relativePath, startIndex, endIndex);
            }

            return sendSuccess(res, {
                success: true,
                solutions: solutions,
                solutionsList: solutions,
                resultsFile: relativePath,
                range: { start: startIndex, end: endIndex },
                timestamp: new Date().toISOString()
            });

        } catch (error: unknown) {
            const err = error as Error;
            console.error('Load results chunk error:', err);
            return sendError(res, 500, 'Failed to load results chunk', err.message);
        }
    }

    // Get CLI solver binary status
    async getStatus(req: Request, res: Response) {
        try {
            const versionResult = await this.executeCommand('--version', 10000);
            const healthy = versionResult.success;
            const status = healthy ? 'online' : 'offline';
            
            // Extract version string from stdout and trim whitespace
            let version = 'Unknown';
            if (healthy && versionResult.stdout) {
                version = `${versionResult.stdout.trim()}`;
            }
            
            return sendSuccess(res, {
                status,
                healthy,
                version,
                path: path.join(this.executableDir, this.executableFile),
                timestamp: new Date().toISOString(),
                error: versionResult.error || undefined
            });
        } catch (error) {
            console.error('Solver binary status error:', error);
            return sendSuccess(res, {
                status: 'offline',
                healthy: false,
                version: 'Unknown',
                path: path.join(this.executableDir, this.executableFile),
                timestamp: new Date().toISOString()
            });
        }
    }

    // Execute word_games command
    executeCommand(args: string, timeout = this.timeout): Promise<{ success: boolean; stdout: string; stderr: string; error?: string }> {
        return new Promise((resolve) => {
            const command = `./${this.executableFile} ${args}`;
            exec(command, { cwd: this.executableDir, timeout }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Command execution failed: ${command}`, error);
                    return resolve({
                        success: false,
                        stdout: stdout.toString(),
                        stderr: stderr.toString(),
                        error: error.message
                    });
                }
                resolve({
                    success: true,
                    stdout: stdout.toString(),
                    stderr: stderr.toString()
                });
            });
        });
    }

    // Read a specific chunk of lines from a results file (with 2-line header skip)
    readResultsChunk(resultsFile: string, start: number, end: number): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const fullPath = path.join(this.executableDir, resultsFile);
            
            if (!fs.existsSync(fullPath)) {
                return reject(new Error(`Results file not found: ${resultsFile}`));
            }

            const input = fs.createReadStream(fullPath);
            const rl = readline.createInterface({
                input,
                crlfDelay: Infinity
            });

            const lines: string[] = [];
            let lineCount = 0;

            rl.on('line', (line) => {
                // Header rows are the first 2 lines
                if (lineCount >= 2) {
                    const actualIndex = lineCount - 2;
                    if (actualIndex >= start && actualIndex < end) {
                        lines.push(line);
                    }
                }
                lineCount++;
                
                // Stop reading if we've reached the end
                if (lineCount - 2 >= end) {
                    rl.close();
                }
            });

            rl.on('close', () => {
                resolve(lines);
            });

            rl.on('error', (err) => {
                reject(err);
            });
        });
    }

    // Read a specific chunk of lines from a results file (no header skip)
    readResultsChunkNoHeader(resultsFile: string, start: number, end: number): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const fullPath = path.join(this.executableDir, resultsFile);
            
            if (!fs.existsSync(fullPath)) {
                return reject(new Error(`Results file not found: ${resultsFile}`));
            }

            const input = fs.createReadStream(fullPath);
            const rl = readline.createInterface({
                input,
                crlfDelay: Infinity
            });

            const lines: string[] = [];
            let lineCount = 0;

            rl.on('line', (line) => {
                if (lineCount >= start && lineCount < end) {
                    lines.push(line.trim());
                }
                lineCount++;
                
                if (lineCount >= end) {
                    rl.close();
                }
            });

            rl.on('close', () => {
                resolve(lines);
            });

            rl.on('error', (err) => {
                reject(err);
            });
        });
    }

    // Parse generic word game output
    parseWordGameOutput(output: string): string[] {
        if (!output || typeof output !== 'string') {
            return [];
        }

        const lines = output.split('\n')
            .map(line => line.trim().toUpperCase())
            .filter(line => line.length > 0);

        const solutions = lines.filter(line => /^[A-Z\s\-,]+$/.test(line));
        return solutions;
    }

    // Parse Wordle results file
    // File format: possible words (plain words, one per line), then CSV lines: word,entropy,probability
    parseWordleOutput(output: string, _possibleCount: number): { possibleWords: string[]; guessesWithEntropy: GuessWithEntropy[] } {
        if (!output || typeof output !== 'string') {
            return { possibleWords: [], guessesWithEntropy: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const possibleWords: string[] = [];
        const guessesWithEntropy: GuessWithEntropy[] = [];

        for (const line of lines) {
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
                const word = line.toUpperCase();
                if (/^[A-Z]+$/.test(word)) {
                    possibleWords.push(word);
                }
            }
        }

        return { possibleWords, guessesWithEntropy };
    }

    // Parse Mastermind results file
    // File format: possible patterns (plain, one per line), then CSV lines: pattern,entropy,probability
    parseMastermindOutput(output: string, _possibleCount: number): { possiblePatterns: string[]; guessesWithEntropy: GuessWithEntropy[] } {
        if (!output || typeof output !== 'string') {
            return { possiblePatterns: [], guessesWithEntropy: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const possiblePatterns: string[] = [];
        const guessesWithEntropy: GuessWithEntropy[] = [];

        for (const line of lines) {
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
                const pattern = line.toUpperCase();
                if (/^[A-Z]+$/.test(pattern)) {
                    possiblePatterns.push(pattern);
                }
            }
        }

        return { possiblePatterns, guessesWithEntropy };
    }

    // Parse Hangman results file
    // File format: letter guesses (letter entropy probability, space-separated), then possible words (one per line)
    parseHangmanOutput(output: string, _letterCount: number): { letterSuggestions: LetterSuggestion[]; possibleWords: string[] } {
        if (!output || typeof output !== 'string') {
            return { letterSuggestions: [], possibleWords: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const letterSuggestions: LetterSuggestion[] = [];
        const possibleWords: string[] = [];

        for (const line of lines) {
            const parts = line.split(/[\s,]+/);
            if (parts.length >= 3 && parts[0].length === 1 && /^[A-Z]$/i.test(parts[0])) {
                letterSuggestions.push({
                    letter: parts[0].toUpperCase(),
                    entropy: parseFloat(parts[1]),
                    probability: parseFloat(parts[2])
                });
            } else {
                const word = line.toUpperCase();
                if (/^[A-Z]+$/.test(word)) {
                    possibleWords.push(word);
                }
            }
        }

        return { letterSuggestions, possibleWords };
    }

    // Parse Dungleon results file
    // File format: possible patterns (space-separated char pairs, one per line), then CSV lines: pattern,entropy,probability
    parseDungleonOutput(output: string, _possibleCount: number): { possiblePatterns: string[]; guessesWithEntropy: GuessWithEntropy[] } {
        if (!output || typeof output !== 'string') {
            return { possiblePatterns: [], guessesWithEntropy: [] };
        }

        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const possiblePatterns: string[] = [];
        const guessesWithEntropy: GuessWithEntropy[] = [];

        for (const line of lines) {
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
                if (line.split(/\s+/).length === 5) {
                    possiblePatterns.push(line);
                }
            }
        }

        return { possiblePatterns, guessesWithEntropy };
    }


    // Schedule file cleanup
    scheduleFileCleanup(filePath: string) {
        setTimeout(() => {
            this.cleanupResultsFile(filePath);
        }, this.cleanupDelay);
    }

    // Clean up a specific results file
    async cleanupResultsFile(filePath: string) {
        try {
            const fullPath = path.join(this.executableDir, filePath);
            const fsPromises = fs.promises;
            
            try {
                await fsPromises.access(fullPath);
                await fsPromises.unlink(fullPath);
                console.log(`Cleaned up results file: ${filePath}`);
            } catch (err: unknown) {
                const errorObj = err as { code?: string; message?: string };
                if (errorObj.code !== 'ENOENT') {
                    console.error(`Failed to cleanup results file ${filePath}:`, errorObj.message);
                }
            }
        } catch (error: unknown) {
            const err = error as Error;
            console.error(`Error during file cleanup for ${filePath}:`, err.message);
        }
    }

    // Clean up all old results files
    async cleanupOldResultsFiles() {
        try {
            const fsPromises = fs.promises;
            const resultsDir = path.join(this.executableDir, this.resultsFolder);
            
            try {
                await fsPromises.access(resultsDir);
            } catch {
                console.log('Results directory does not exist, nothing to clean up');
                return;
            }

            const files = await fsPromises.readdir(resultsDir);
            const now = Date.now();
            
            for (const filename of files) {
                try {
                    const filePath = path.join(resultsDir, filename);
                    const stats = await fsPromises.stat(filePath);
                    const fileAge = now - stats.mtime.getTime();

                    if (fileAge > this.cleanupDelay) {
                        await fsPromises.unlink(filePath);
                        console.log(`Cleaned up old results file: ${filename} (age: ${Math.round(fileAge / 1000)}s)`);
                    }
                } catch (err: unknown) {
                    const errorObj = err as Error;
                    console.error(`Error processing file ${filename} during cleanup:`, errorObj.message);
                }
            }
            
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Error during results directory cleanup:', err.message);
        }
    }
}

export default WordGamesController;
