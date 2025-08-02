const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const { sendError, sendSuccess } = require('../utils/response'); // Utility for standardized responses

class WordGamesController {
    constructor() {
        // Path to the word_games executable (relative to word-games directory)
        this.executablePath = './word_games';
        this.timeout = 30000; // 30 seconds timeout
    }

    // Solve Letter Boxed puzzle
    async solveLetterBoxed(req, res) {
        try {
            const { letters, maxDepth, minWordLength, minUniqueLetters, pruneRedundantPaths, pruneDominatedClasses } = req.body;

            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate input
            if (!letters || typeof letters !== 'string') {
                return sendError(res, 400, 'Letters parameter is required and must be a string');
            }

            // Remove any spaces and validate length (should be 12 letters for letter boxed)
            const cleanLetters = letters.replace(/\s/g, '').toLowerCase();
            if (cleanLetters.length !== 12) {
                return sendError(res, 400, 'Letters must be exactly 12 characters for Letter Boxed');
            }

            // Validate letters are alphabetic
            if (!/^[a-z]+$/i.test(cleanLetters)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            // Validate all configuration parameters are provided
            if (
                maxDepth === undefined ||
                minWordLength === undefined ||
                minUniqueLetters === undefined ||
                pruneRedundantPaths === undefined ||
                pruneDominatedClasses === undefined
            ) {
                return sendError(res, 400, 'All configuration parameters are required: maxDepth, minWordLength, minUniqueLetters, pruneRedundantPaths, pruneDominatedClasses');
            }

            // Validate parameter ranges
            const depth = parseInt(maxDepth);
            const wordLen = parseInt(minWordLength);
            const uniqueLetters = parseInt(minUniqueLetters);
            const pruneRedundant = parseInt(pruneRedundantPaths);
            const pruneDominated = parseInt(pruneDominatedClasses);

            if (isNaN(depth) || depth < 1 || depth > 3) {
                return sendError(res, 400, 'Max depth must be a number between 1 and 3');
            }
            if (isNaN(wordLen) || wordLen < 1) {
                return sendError(res, 400, 'Min word length must be a number greater than 0');
            }
            if (isNaN(uniqueLetters) || uniqueLetters < 1) {
                return sendError(res, 400, 'Min unique letters must be a number greater than 0');
            }
            if (isNaN(pruneRedundant) || (pruneRedundant !== 0 && pruneRedundant !== 1)) {
                return sendError(res, 400, 'Prune redundant paths must be 0 or 1');
            }
            if (isNaN(pruneDominated) || (pruneDominated !== 0 && pruneDominated !== 1)) {
                return sendError(res, 400, 'Prune dominated classes must be 0 or 1');
            }

            // Build command with all parameters
            const command = `${this.executablePath} letterboxed ${cleanLetters} 0 ${depth} ${wordLen} ${uniqueLetters} ${pruneRedundant} ${pruneDominated}`;
            
            console.log(`Executing Letter Boxed solver: ${command}`);

            const result = await this.executeCommand(command);
            
            // Parse the output into solutions
            const allSolutions = this.parseWordGameOutput(result.stdout);
            const totalFound = result.stdout.split('\n').filter(line => line.trim().length > 0 && /^[a-zA-Z\s\-,]+$/.test(line.trim())).length;

            return sendSuccess(res, {
                success: true,
                gameType: 'letterboxed',
                letters: cleanLetters,
                maxDepth: depth,
                minWordLength: wordLen,
                minUniqueLetters: uniqueLetters,
                pruneRedundantPaths: pruneRedundant,
                pruneDominatedClasses: pruneDominated,
                solutions: allSolutions,
                totalSolutions: allSolutions.length,
                actualTotalFound: totalFound,
                isLimited: totalFound > 100,
                executionTime: result.executionTime
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
            const { letters } = req.body;

            // Basic request validation
            if (!req.body || typeof req.body !== 'object') {
                return sendError(res, 400, 'Invalid request body');
            }

            // Validate input
            if (!letters || typeof letters !== 'string') {
                return sendError(res, 400, 'Letters parameter is required and must be a string');
            }

            // Remove any spaces and validate length (should be 7 letters for spelling bee)
            const cleanLetters = letters.replace(/\s/g, '').toLowerCase();
            if (cleanLetters.length !== 7) {
                return sendError(res, 400, 'Letters must be exactly 7 characters for Spelling Bee');
            }

            // Validate letters are alphabetic
            if (!/^[a-z]+$/i.test(cleanLetters)) {
                return sendError(res, 400, 'Letters must only contain alphabetic characters');
            }

            // Validate all letters are unique
            const uniqueLetters = new Set(cleanLetters.split(''));
            if (uniqueLetters.size !== 7) {
                return sendError(res, 400, 'All letters must be different for Spelling Bee');
            }

            const command = `${this.executablePath} spellingbee ${cleanLetters}`;
            
            console.log(`Executing Spelling Bee solver: ${command}`);

            const result = await this.executeCommand(command);
            
            // Parse the output into solutions
            const allSolutions = this.parseWordGameOutput(result.stdout);
            const totalFound = result.stdout.split('\n').filter(line => line.trim().length > 0 && /^[a-zA-Z\s\-,]+$/.test(line.trim())).length;

            return sendSuccess(res, {
                success: true,
                gameType: 'spellingbee',
                letters: cleanLetters,
                solutions: allSolutions,
                totalSolutions: allSolutions.length,
                actualTotalFound: totalFound,
                isLimited: totalFound > 100,
                executionTime: result.executionTime
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

    // Get word games status (check if executable exists and is working)
    async getStatus(req, res) {
        try {
            // Test if the executable exists and responds
            const command = `${this.executablePath} --help`;
            
            try {
                await this.executeCommand(command, 5000); // 5 second timeout for status check
                return sendSuccess(res, {
                    status: 'available',
                    executable: this.executablePath,
                    platform: os.platform(),
                    message: 'Word games executable is available and responding'
                });
            } catch (error) {
                return sendSuccess(res, {
                    status: 'unavailable',
                    executable: this.executablePath,
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

    // Execute a command and return the result
    executeCommand(command, timeoutMs = this.timeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            exec(command, { 
                timeout: timeoutMs,
                maxBuffer: 1024 * 1024, // 1MB buffer for large outputs
                cwd: path.join(os.homedir(), 'word-games') // Execute from ~/word-games directory
            }, (error, stdout, stderr) => {
                const executionTime = Date.now() - startTime;
                
                if (error) {
                    // Include both error and stderr in the rejection
                    const errorMessage = stderr || error.message || 'Unknown error';
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

    // Parse the output from word games executable into an array of solutions
    parseWordGameOutput(output) {
        if (!output || typeof output !== 'string') {
            return [];
        }

        // Split by lines and filter out empty lines
        const lines = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // For word games, assume each line is a solution
        // Filter out any lines that don't look like words (contain only letters)
        const solutions = lines.filter(line => /^[a-zA-Z\s\-,]+$/.test(line));

        // Limit results to 100 to prevent overwhelming the UI
        return solutions.slice(0, 100);
    }
}

module.exports = WordGamesController;
