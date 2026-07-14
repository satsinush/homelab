import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';

export async function solveLetterBoxed(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            letters,
            preset = 1,
            maxDepth,
            minWordLength,
            minUniqueLetters,
            pruneRedundantPaths,
            pruneDominatedClasses,
            excludeUncommonWords,
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
        const resultsFilename = ctx.generateResultsFilename(username, 'letterboxed');

        // Build command with CLI format: letterboxed --letters <12letters> [--preset N] [-o file]
        const args = [
            'letterboxed',
            `--letters ${cleanLetters}`,
            `-o ${resultsFilename}`
        ];

        if (excludeUncommonWords !== undefined) {
            args.push(`--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`);
        }

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
        const result = await ctx.executeCommand(command, username);
        const executionTime = Date.now() - startTime;

        if (!result.success) {
            console.error(`Solver execution failed for command: ${command}`, result.error);
            return sendError(res, 500, 'Solver error');
        }

        // Parse output: the C++ headless mode outputs:
        //   line 1: solution count
        //   line 2: output filename (no trailing newline)
        const outputLines = result.stdout.trim().split('\n');
        const totalFound = parseInt(outputLines[0]) || 0;
        const actualResultsFile = (outputLines[1] || resultsFilename).trim();

        // Verify file exists
        const fullResultsPath = path.join(ctx.executableDir, actualResultsFile);
        if (!fs.existsSync(fullResultsPath)) {
            return sendError(res, 500, 'Solver executed but results file was not found');
        }

        // Read the requested chunk
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
            letters: cleanLetters,
            timestamp: new Date().toISOString()
        });

    } catch (error: unknown) {
        console.error('Letter Boxed solve error:', error);
        return sendError(res, 500, 'Failed to solve Letter Boxed puzzle', getErrorMessage(error));
    }
}
