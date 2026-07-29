import path from 'path';
import fs from 'fs';
import { sendError, sendSuccess } from '../../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../../utils/errors';
import { WordGamesContext } from '../shared';
import { LetterSuggestion } from '../types';
import { parseHangmanOutput } from '../parsers/hangman';

export async function solveHangman(ctx: WordGamesContext, req: Request, res: Response) {
    try {
        const {
            pattern,
            excludedLetters = '',
            maxDepth = 0,
            autoDepth = false,
            maxGuesses = 6,
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
        const resultsFilename = ctx.generateResultsFilename(username, 'hangman');

        // Build command with CLI format: hangman --input "PATTERN;STRIKES" --max-depth N --exclude-uncommon-words N -o file
        // The C++ CLI expects --input with format "PATTERN;STRIKES" or separate --pattern and --strikes
        // Pattern uses _ for unknown letters (lowercase internally)
        const patternLower = cleanPattern.toLowerCase();

        const isAuto = autoDepth || maxDepth === 'auto';
        const args = [
            'hangman',
            `--max-depth ${isAuto ? 0 : (parseInt(maxDepth) || 0)}`,
            `--max-guesses ${parseInt(maxGuesses) || 6}`,
            `--exclude-uncommon-words ${excludeUncommonWords ? 1 : 0}`,
            `-o ${resultsFilename}`
        ];
        if (isAuto) {
            args.push('--auto-depth');
        }

        // Use --input format: "pattern;strikes"
        if (cleanGuessed.length > 0) {
            args.push(`--input "${patternLower};${cleanGuessed.toLowerCase()}"`);
        } else {
            args.push(`--pattern "${patternLower}"`);
        }

        const command = args.join(' ');
        console.log(`Executing Hangman solver: ${command}`);

        const startTime = Date.now();
        const result = await ctx.executeCommand(command, username);
        const executionTime = Date.now() - startTime;

        if (!result.success) {
            console.error(`Solver execution failed for command: ${command}`, result.error);
            return sendError(res, 500, 'Solver error');
        }

        // Parse stdout: the C++ headless mode outputs:
        //   line 1: total possible words count
        //   line 2: total letter guesses count
        //   line 3: output filename (no trailing newline)
        const outputLines = result.stdout.trim().split('\n');
        const possiblePatternsCount = parseInt(outputLines[0]) || 0;
        const letterGuessesCount = parseInt(outputLines[1]) || 0;
        const actualResultsFile = (outputLines[2] || resultsFilename).trim();
        const searchDepth = outputLines[3] ? parseInt(outputLines[3]) : null;
        const possibleWordsCount = outputLines[4] ? (parseInt(outputLines[4]) || 0) : possiblePatternsCount;

        // Read the results file
        let letterSuggestions: LetterSuggestion[] = [];
        let possibleWords: string[] = [];

        const fullPath = path.join(ctx.executableDir, actualResultsFile);
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            const parsed = parseHangmanOutput(fileContent, letterGuessesCount);
            letterSuggestions = parsed.letterSuggestions;
            possibleWords = parsed.possibleWords;

            ctx.scheduleFileCleanup(actualResultsFile);
        }

        const isLimited = possibleWords.length > 100;

        return sendSuccess(res, {
            success: true,
            pattern: cleanPattern,
            excludedLetters: cleanGuessed,
            possibleWordsCount,
            possiblePatternsCount,
            letterGuessesCount,
            searchDepth,
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
        console.error('Hangman solve error:', error);
        return sendError(res, 500, 'Failed to solve Hangman step', getErrorMessage(error));
    }
}
