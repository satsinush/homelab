import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';
import { GuessWithEntropy } from '../types';
import { parseDungleonOutput } from '../parsers/dungleon';

export async function solveDungleon(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            guesses = [],
            results = [],
            solutions = [],
            maxDepth = 0,
            autoDepth = false,
            maxGuesses = 10,
            excludeImpossiblePatterns = 0
        } = req.body;

        if (!req.body || typeof req.body !== 'object') {
            return sendError(res, 400, 'Invalid request body');
        }

        if (!Array.isArray(guesses) || !Array.isArray(results) || guesses.length !== results.length || !Array.isArray(solutions)) {
            return sendError(res, 400, 'Guesses and results must be arrays of the same length, and solutions must be an array');
        }

        // Validate guesses and results
        for (let i = 0; i < guesses.length; i++) {
            const guess = guesses[i];
            const result = results[i];
            if (typeof guess !== 'string' || guess.trim().split(/\s+/).length !== 5) {
                return sendError(res, 400, `Guess at index ${i} must be a space-separated string of exactly 5 character IDs`);
            }
            if (!Array.isArray(result) || result.length !== 5) {
                return sendError(res, 400, `Result at index ${i} must be a number array of length 5`);
            }
            if (result.some((val: unknown) => typeof val !== 'number' || val < 0 || val > 4)) {
                return sendError(res, 400, `Result at index ${i} must contain only numbers 0 to 4`);
            }
        }

        // Validate solutions
        for (let i = 0; i < solutions.length; i++) {
            const sol = solutions[i];
            if (typeof sol !== 'string' || sol.trim().split(/\s+/).length !== 5) {
                return sendError(res, 400, `Solution at index ${i} must be a space-separated string of exactly 5 character IDs`);
            }
        }

        const username = req.user?.username || 'user';
        const resultsFilename = ctx.generateResultsFilename(username, 'dungleon');

        // Build command with CLI format: dungleon --max-depth N --guesses "chars colors;..." --solutions "chars;..." -o file
        // The C++ CLI expects --guesses with format "ar kn ma bt dr 01234;ar kn bo ne fr 00010"
        // where colors are 0-4 (not G/Y/X/R/D)
        const isAuto = autoDepth || maxDepth === 'auto';
        const args = [
            'dungleon',
            `--max-depth ${isAuto ? 0 : (parseInt(maxDepth) || 0)}`,
            `--max-guesses ${Math.max(1, (parseInt(maxGuesses) || 6) - solutions.length)}`,
            `--exclude-impossible ${excludeImpossiblePatterns ? 1 : 0}`,
            `-o ${resultsFilename}`
        ];
        if (isAuto) {
            args.push('--auto-depth');
        }

        // Build the --guesses string: convert feedback array to numeric string format
        if (guesses.length > 0) {
            const guessPairs = guesses.map((guess: string, i: number) => {
                const normalizedGuess = guess.toLowerCase().replace(/\s+/g, ' ').trim();
                const colors = results[i].join('');
                return `${normalizedGuess} ${colors}`;
            });
            args.push(`--guesses "${guessPairs.join(';')}"`);
        }

        // Build the --solutions string
        if (solutions.length > 0) {
            const solutionPairs = solutions.map((sol: string) => {
                return sol.toLowerCase().replace(/\s+/g, ' ').trim();
            });
            args.push(`--solutions "${solutionPairs.join(';')}"`);
        }

        const command = args.join(' ');
        console.log(`Executing Dungleon solver: ${command}`);

        const startTime = Date.now();
        const result = await ctx.executeCommand(command, username);
        const executionTime = Date.now() - startTime;

        if (!result.success) {
            console.error(`Solver execution failed for command: ${command}`, result.error);
            return sendError(res, 500, 'Solver error');
        }

        // Parse stdout: the C++ headless mode outputs:
        //   line 1: total possible patterns count
        //   line 2: total sorted guesses count
        //   line 3: output filename (no trailing newline)
        const outputLines = result.stdout.trim().split('\n');
        const possiblePatternsCount = parseInt(outputLines[0]) || 0;
        const guessesCount = parseInt(outputLines[1]) || 0;
        const actualResultsFile = (outputLines[2] || resultsFilename).trim();
        const searchDepth = outputLines[3] ? parseInt(outputLines[3]) : null;

        // Read the results file
        let possiblePatterns: GuessWithEntropy[] = [];
        let guessesWithEntropy: GuessWithEntropy[] = [];

        const fullPath = path.join(ctx.executableDir, actualResultsFile);
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const parsed = parseDungleonOutput(fileContent, possiblePatternsCount);
            possiblePatterns = parsed.possiblePatterns;
            guessesWithEntropy = parsed.guessesWithEntropy;

            ctx.scheduleFileCleanup(actualResultsFile);
        }

        const isLimitedPossible = possiblePatterns.length > 100;
        const isLimitedGuesses = guessesWithEntropy.length > 100;

        return sendSuccess(res, {
            success: true,
            possiblePatternsCount,
            guessesCount,
            searchDepth,
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
        console.error('Dungleon solve error:', error);
        return sendError(res, 500, 'Failed to solve Dungleon step', getErrorMessage(error));
    }
}
