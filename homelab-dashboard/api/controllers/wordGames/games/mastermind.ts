import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';
import { GuessWithEntropy } from '../types';
import { parseMastermindOutput } from '../parsers/mastermind';

export async function solveMastermind(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            guesses = [],
            blackPegs = [],
            whitePegs = [],
            slots = 4,
            colors = 6,
            duplicates = true,
            maxDepth = 1,
            autoDepth = false,
            maxGuesses = 10
        } = req.body;

        if (!req.body || typeof req.body !== 'object') {
            return sendError(res, 400, 'Invalid request body');
        }

        if (!Array.isArray(guesses) || !Array.isArray(blackPegs) || !Array.isArray(whitePegs) ||
            guesses.length !== blackPegs.length || guesses.length !== whitePegs.length) {
            return sendError(res, 400, 'Guesses, blackPegs, and whitePegs must be arrays of the same length');
        }

        const slotsCount = parseInt(slots) || 4;
        const colorsCount = typeof colors === 'string' ? colors.length : (parseInt(colors) || 6);
        const colorChars = typeof colors === 'string' ? colors.toUpperCase() : Array.from({ length: colorsCount }, (_, i) => String.fromCharCode(65 + i)).join('');

        const duplicatesAllowed = duplicates === true || duplicates === 1 || duplicates === '1' || duplicates === 'true';
        if (!duplicatesAllowed && slotsCount > colorChars.length) {
            return sendError(res, 400, `Number of pegs (${slotsCount}) cannot exceed the number of enabled colors (${colorChars.length}) when duplicates are disabled`);
        }

        // Validate guesses
        for (let i = 0; i < guesses.length; i++) {
            const guess = guesses[i];
            if (typeof guess !== 'string' || guess.length !== slotsCount) {
                return sendError(res, 400, `Guess at index ${i} must be a string of length ${slotsCount}`);
            }

            const charRegex = new RegExp(`^[${colorChars}]+$`, 'i');
            if (!charRegex.test(guess)) {
                return sendError(res, 400, `Guess at index ${i} must only contain letters ${colorChars} (case-insensitive)`);
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
        const resultsFilename = ctx.generateResultsFilename(username, 'mastermind');

        const isAuto = autoDepth || maxDepth === 'auto';
        const args = [
            'mastermind',
            `--pegs ${slotsCount}`,
            `--colors "${colorChars}"`,
            `--allow-duplicates ${duplicates ? 1 : 0}`,
            `--max-depth ${isAuto ? 0 : (parseInt(maxDepth) || 1)}`,
            `--max-guesses ${parseInt(maxGuesses) || 10}`,
            `-o ${resultsFilename}`
        ];
        if (isAuto) {
            args.push('--auto-depth');
        }

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
        const possibleCount = parseInt(outputLines[0]) || 0;
        const guessesCount = parseInt(outputLines[1]) || 0;
        const actualResultsFile = (outputLines[2] || resultsFilename).trim();
        const searchDepth = outputLines[3] ? parseInt(outputLines[3]) : null;

        // Read the results file
        let possiblePatterns: GuessWithEntropy[] = [];
        let guessesWithEntropy: GuessWithEntropy[] = [];

        const fullPath = path.join(ctx.executableDir, actualResultsFile);
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const parsed = parseMastermindOutput(fileContent, possibleCount);
            possiblePatterns = parsed.possiblePatterns;
            guessesWithEntropy = parsed.guessesWithEntropy;

            ctx.scheduleFileCleanup(actualResultsFile);
        }

        const isLimitedPossible = possiblePatterns.length > 100;
        const isLimitedGuesses = guessesWithEntropy.length > 100;

        return sendSuccess(res, {
            success: true,
            possibleCount,
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
        console.error('Mastermind solve error:', error);
        return sendError(res, 500, 'Failed to solve Mastermind step', getErrorMessage(error));
    }
}
