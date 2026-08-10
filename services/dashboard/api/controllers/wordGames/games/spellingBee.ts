import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';

export async function solveSpellingBee(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            centerLetter,
            outerLetters,
            mustIncludeFirstLetter = true,
            reuseLetters = true,
            excludeUncommonWords = false,
            allowAnyLength = false,
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

        if (!allowAnyLength && cleanOuter.length !== 6) {
            return sendError(res, 400, 'Outer letters must be exactly 6 characters');
        }

        if (!/^[a-z]+$/i.test(cleanCenter + cleanOuter)) {
            return sendError(res, 400, 'Letters must only contain alphabetic characters');
        }

        const username = req.user?.username || 'user';
        const resultsFilename = ctx.generateResultsFilename(username, 'spellingbee');

        // Build command with CLI format: spellingbee --letters <letters> [options] -o <file>
        // The C++ CLI expects --letters with center letter first, followed by outer letters
        const allLetters = cleanCenter + cleanOuter;
        const args = [
            'spellingbee',
            `--letters ${allLetters}`,
            `--must-include-first-letter ${mustIncludeFirstLetter ? 1 : 0}`,
            `--reuse-letters ${reuseLetters ? 1 : 0}`,
            `-o ${resultsFilename}`
        ];

        if (excludeUncommonWords) {
            args.push('--exclude-uncommon-words 1');
        }

        const command = args.join(' ');
        console.log(`Executing Spelling Bee solver: ${command}`);

        const startTime = Date.now();
        const result = await ctx.executeCommand(command, username);
        const executionTime = Date.now() - startTime;

        if (!result.success) {
            console.error(`Solver execution failed for command: ${command}`, result.error);
            return sendError(res, 500, 'Solver error');
        }

        // Parse output: the C++ headless mode outputs:
        //   line 1: word count
        //   line 2: output filename (no trailing newline)
        const outputLines = result.stdout.trim().split('\n');
        const totalFound = parseInt(outputLines[0]) || 0;
        const actualResultsFile = (outputLines[1] || resultsFilename).trim();

        // Verify file exists
        const fullResultsPath = path.join(ctx.executableDir, actualResultsFile);
        if (!fs.existsSync(fullResultsPath)) {
            return sendError(res, 500, 'Solver executed but results file was not found');
        }

        // Read the requested chunk (SpellingBee results file has NO header rows, just words)
        const startIndex = parseInt(start) || 0;
        const endIndex = parseInt(end) || 100;
        const solutions = await ctx.readResultsChunkNoHeader(actualResultsFile, startIndex, endIndex);

        // Schedule deletion after 1 hour
        ctx.scheduleFileCleanup(actualResultsFile);

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
        console.error('Spelling Bee solve error:', error);
        return sendError(res, 500, 'Failed to solve Spelling Bee puzzle', getErrorMessage(error));
    }
}
