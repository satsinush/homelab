import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../utils/errors';
import { WordGamesContext } from './shared';
import { parseWordleOutput } from './parsers/wordle';
import { parseMastermindOutput } from './parsers/mastermind';
import { parseHangmanOutput } from './parsers/hangman';
import { parseDungleonOutput } from './parsers/dungleon';

export async function loadResults(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            start = 0,
            end = 100,
            gameMode,
            fileType,
            possibleCount = 0
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
        const fullResultsPath = path.join(ctx.executableDir, ctx.resultsFolder, cleanResultsFile);

        if (!fs.existsSync(fullResultsPath)) {
            return sendError(res, 404, 'Results file not found or has expired');
        }

        const startIndex = parseInt(start) || 0;
        const endIndex = parseInt(end) || 100;

        const relativePath = path.join(ctx.resultsFolder, cleanResultsFile);

        // Handle pagination based on gameMode
        if (gameMode === 'wordle' || gameMode === 'mastermind' || gameMode === 'hangman' || gameMode === 'dungleon') {
            const fileContent = fs.readFileSync(fullResultsPath, 'utf8');
            let solutions: Record<string, unknown> = {};

            if (gameMode === 'wordle') {
                const parsed = parseWordleOutput(fileContent, possibleCount);
                if (fileType === 'possible') {
                    solutions = { possibleWords: parsed.possibleWords.slice(startIndex, endIndex) };
                } else {
                    solutions = { guessesWithEntropy: parsed.guessesWithEntropy.slice(startIndex, endIndex) };
                }
            } else if (gameMode === 'mastermind') {
                const parsed = parseMastermindOutput(fileContent, possibleCount);
                if (fileType === 'possible') {
                    solutions = { possiblePatterns: parsed.possiblePatterns.slice(startIndex, endIndex) };
                } else {
                    solutions = { guessesWithEntropy: parsed.guessesWithEntropy.slice(startIndex, endIndex) };
                }
            } else if (gameMode === 'hangman') {
                const parsed = parseHangmanOutput(fileContent, 0);
                solutions = { possibleWords: parsed.possibleWords.slice(startIndex, endIndex) };
            } else if (gameMode === 'dungleon') {
                const parsed = parseDungleonOutput(fileContent, possibleCount);
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

        // Only spellingbee and letterboxed games reach here (others return early above)
        // Both of these games write solved lists directly without a header.
        const solutions = await ctx.readResultsChunkNoHeader(relativePath, startIndex, endIndex);

        return sendSuccess(res, {
            success: true,
            solutions: solutions,
            solutionsList: solutions,
            resultsFile: relativePath,
            range: { start: startIndex, end: endIndex },
            timestamp: new Date().toISOString()
        });

    } catch (error: unknown) {
        console.error('Load results chunk error:', error);
        return sendError(res, 500, 'Failed to load results chunk', getErrorMessage(error));
    }
}
