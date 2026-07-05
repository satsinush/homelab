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

            return sendSuccess(res, {
                success: true,
                total: totalFound,
                solutions: solutions,
                resultsFile: actualResultsFile,
                letters: cleanLetters,
                range: { start: startIndex, end: endIndex },
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

            // Build command with new CLI format
            const command = `spellingbee --center ${cleanCenter} --outer ${cleanOuter} --min-len ${parseInt(minWordLength)} -o ${resultsFilename}`;
            console.log(`Executing Spelling Bee solver: ${command}`);
            const result = await this.executeCommand(command);

            // Parse output: count and filename
            const outputLines = result.stdout.trim().split('\n');
            const totalFound = parseInt(outputLines[0]);
            const actualResultsFile = outputLines[1];

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

            return sendSuccess(res, {
                success: true,
                total: totalFound,
                solutions: solutions,
                resultsFile: actualResultsFile,
                centerLetter: cleanCenter,
                outerLetters: cleanOuter,
                range: { start: startIndex, end: endIndex },
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
                dictionary = 'wordle',
                possibleWordsCount = 20,
                guessesCount = 20
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

            const args = [
                'wordle',
                `--len ${len}`,
                `--dict ${dictionary}`,
                `--limit-words ${parseInt(possibleWordsCount)}`,
                `--limit-guesses ${parseInt(guessesCount)}`
            ];

            // Add guesses and results in format: --guess G1:R1 --guess G2:R2
            for (let i = 0; i < guesses.length; i++) {
                args.push(`--guess ${guesses[i].toLowerCase()}:${results[i].toUpperCase()}`);
            }

            const command = args.join(' ');
            console.log(`Executing Wordle solver: ${command}`);
            const result = await this.executeCommand(command);

            const parsed = this.parseWordleOutput(result.stdout, possibleWordsCount);

            return sendSuccess(res, {
                success: true,
                possibleWords: parsed.possibleWords,
                guessesWithEntropy: parsed.guessesWithEntropy,
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
                possiblePatternsCount = 20,
                guessesCount = 20
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

            const args = [
                'mastermind',
                `--slots ${slotsCount}`,
                `--colors ${colorsCount}`,
                `--dups ${duplicates ? 1 : 0}`,
                `--limit-patterns ${parseInt(possiblePatternsCount)}`,
                `--limit-guesses ${parseInt(guessesCount)}`
            ];

            // Add guesses and pegs: --guess PATTERN:B:W
            for (let i = 0; i < guesses.length; i++) {
                args.push(`--guess ${guesses[i].toUpperCase()}:${blackPegs[i]}:${whitePegs[i]}`);
            }

            const command = args.join(' ');
            console.log(`Executing Mastermind solver: ${command}`);
            const result = await this.executeCommand(command);

            const parsed = this.parseMastermindOutput(result.stdout, possiblePatternsCount);

            return sendSuccess(res, {
                success: true,
                possiblePatterns: parsed.possiblePatterns,
                guessesWithEntropy: parsed.guessesWithEntropy,
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
                possiblePatternsCount = 20,
                guessesCount = 20
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

            const args = [
                'dungleon',
                `--limit-patterns ${parseInt(possiblePatternsCount)}`,
                `--limit-guesses ${parseInt(guessesCount)}`
            ];

            // Add guesses and results in format: --guess "hero monster chest sword shield:GGYYX"
            for (let i = 0; i < guesses.length; i++) {
                // Ensure guess is normalized (single spaces, lowercase)
                const normalizedGuess = guesses[i].toLowerCase().replace(/\s+/g, ' ');
                args.push(`--guess "${normalizedGuess}:${results[i].toUpperCase()}"`);
            }

            const command = args.join(' ');
            console.log(`Executing Dungleon solver: ${command}`);
            const result = await this.executeCommand(command);

            const parsed = this.parseDungleonOutput(result.stdout, possiblePatternsCount);

            return sendSuccess(res, {
                success: true,
                possiblePatterns: parsed.possiblePatterns,
                guessesWithEntropy: parsed.guessesWithEntropy,
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
                guessedLetters = '',
                dictionary = 'wordle',
                letterSuggestionsCount = 26,
                possibleWordsCount = 20
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!pattern || typeof pattern !== 'string') {
                return sendError(res, 400, 'Pattern is required and must be a string (e.g., "_PP_E")');
            }

            const cleanPattern = pattern.trim().replace(/\s/g, '').toUpperCase();
            const cleanGuessed = (typeof guessedLetters === 'string' ? guessedLetters : '').replace(/[^a-z]/gi, '').toUpperCase();

            // Validate pattern (must contain only letters and underscores)
            if (!/^[A-Z_]+$/.test(cleanPattern)) {
                return sendError(res, 400, 'Pattern must contain only alphabetic characters and underscores');
            }

            const args = [
                'hangman',
                `--pattern ${cleanPattern}`,
                `--dict ${dictionary}`,
                `--limit-letters ${parseInt(letterSuggestionsCount)}`,
                `--limit-words ${parseInt(possibleWordsCount)}`
            ];

            if (cleanGuessed.length > 0) {
                args.push(`--guessed ${cleanGuessed}`);
            }

            const command = args.join(' ');
            console.log(`Executing Hangman solver: ${command}`);
            const result = await this.executeCommand(command);

            const parsed = this.parseHangmanOutput(result.stdout, letterSuggestionsCount);

            return sendSuccess(res, {
                success: true,
                letterSuggestions: parsed.letterSuggestions,
                possibleWords: parsed.possibleWords,
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
                resultsFile,
                start = 0,
                end = 100
            } = req.body;

            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            if (!resultsFile || typeof resultsFile !== 'string') {
                return sendError(res, 400, 'resultsFile parameter is required and must be a string');
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
            const solutions = await this.readResultsChunk(relativePath, startIndex, endIndex);

            return sendSuccess(res, {
                success: true,
                solutions: solutions,
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

    // Read a specific chunk of lines from a results file (efficiently using readline)
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

    // Parse Wordle output
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

    // Parse Mastermind output
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

    // Parse Hangman output
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

    // Parse Dungleon output
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
