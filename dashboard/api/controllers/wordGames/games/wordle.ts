import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';
import { GuessWithEntropy } from '../types';
import { parseWordleOutput } from '../parsers/wordle';

export async function solveWordle(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            guesses = [],
            results = [],
            wordLength = 5,
            maxDepth = 0,
            autoDepth = false,
            maxGuesses = 6,
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
            if (!Array.isArray(result) || result.length !== len) {
                return sendError(res, 400, `Result at index ${i} must be a number array of length ${len}`);
            }
            if (result.some((val: unknown) => typeof val !== 'number' || val < 0 || val > 2)) {
                return sendError(res, 400, `Result at index ${i} must contain only numbers 0, 1, or 2`);
            }
        }

        const username = req.user?.username || 'user';
        const resultsFilename = ctx.generateResultsFilename(username, 'wordle');

        // Build command with CLI format: wordle --word-length N --max-depth N --guesses "WORD COLORS;..." -o file
        // The C++ CLI expects --guesses with format "WORD COLORS;WORD2 COLORS2"
        // where COLORS uses 0=grey, 1=yellow, 2=green
        const isAuto = autoDepth || maxDepth === 'auto';
        const args = [
            'wordle',
            `--word-length ${len}`,
            `--max-depth ${isAuto ? 0 : (parseInt(maxDepth) || 0)}`,
            `--max-guesses ${parseInt(maxGuesses) || 6}`,
            `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
            `-o ${resultsFilename}`
        ];
        if (isAuto) {
            args.push('--auto-depth');
        }

        // Build the --guesses string: convert G/Y/X feedback to 0/1/2 numeric format
        // Build the --guesses string: convert feedback array to numeric string format
        if (guesses.length > 0) {
            const guessPairs = guesses.map((guess: string, i: number) => {
                const word = guess.toLowerCase();
                const colors = results[i].join('');
                return `${word} ${colors}`;
            });
            args.push(`--guesses "${guessPairs.join(';')}"`);
        }

        const command = args.join(' ');
        console.log(`Executing Wordle solver: ${command}`);

        const startTime = Date.now();
        const resultVal = await ctx.executeCommand(command, username);
        const executionTime = Date.now() - startTime;

        if (!resultVal.success) {
            console.error(`Solver execution failed for command: ${command}`, resultVal.error);
            return sendError(res, 500, 'Solver error');
        }

        // Parse stdout: the C++ headless mode outputs:
        //   line 1: total possible words count
        //   line 2: total sorted guesses count
        //   line 3: output filename (no trailing newline)
        const outputLines = resultVal.stdout.trim().split('\n');
        const possibleWordsCount = parseInt(outputLines[0]) || 0;
        const guessesCount = parseInt(outputLines[1]) || 0;
        const actualResultsFile = (outputLines[2] || resultsFilename).trim();
        const searchDepth = outputLines[3] ? parseInt(outputLines[3]) : null;

        // Read the results file to get words and entropy data
        // File format: possible words (one per line), then CSV lines: word,entropy,probability
        let possibleWords: GuessWithEntropy[] = [];
        let guessesWithEntropy: GuessWithEntropy[] = [];

        const fullPath = path.join(ctx.executableDir, actualResultsFile);
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const parsed = parseWordleOutput(fileContent, possibleWordsCount);
            possibleWords = parsed.possibleWords;
            guessesWithEntropy = parsed.guessesWithEntropy;

            // Schedule deletion after 1 hour
            ctx.scheduleFileCleanup(actualResultsFile);
        }

        const isLimitedPossible = possibleWords.length > 100;
        const isLimitedGuesses = guessesWithEntropy.length > 100;

        return sendSuccess(res, {
            success: true,
            possibleWordsCount,
            guessesCount,
            searchDepth,
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
        console.error('Wordle solve error:', error);
        return sendError(res, 500, 'Failed to solve Wordle step', getErrorMessage(error));
    }
}
