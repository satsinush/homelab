import { exec, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { sendError, sendSuccess } from '../../utils/response';
import { Request, Response } from 'express';
import { getErrorMessage } from '../../utils/errors';
import { CommandResult } from './types';

export class WordGamesContext {
    private executableFile: string;
    executableDir: string;
    private timeout: number;
    resultsFolder: string;
    private cleanupDelay: number;
    private activeProcesses: Map<string, ChildProcess>;

    constructor() {
        // Path to the word_games executable (built as p++)
        this.executableFile = 'word_games';
        this.executableDir = path.join('/app/word_games');
        this.timeout = 300000; // 5 minutes timeout
        this.resultsFolder = 'results';
        this.cleanupDelay = 60 * 60 * 1000; // 1 hour in milliseconds
        this.activeProcesses = new Map();

        // Initialize by running --help
        this.executeCommand('--help', undefined, 30000);

        // Run initial cleanup on startup
        this.initialCleanup();
    }

    async initialCleanup() {
        try {
            console.log('Running initial cleanup of old results files...');
            await this.cleanupOldResultsFiles();
        } catch (error: unknown) {
            console.error('Error during initial cleanup:', getErrorMessage(error));
        }
    }

    generateResultsFilename(username: string, gameType: string): string {
        const timestamp = Date.now();
        return path.join(this.resultsFolder, `${username || 'user'}_${gameType}_${timestamp}.txt`);
    }

    // Get CLI solver binary status
    async getStatus(req: Request, res: Response) {
        try {
            const versionResult = await this.executeCommand('--version', undefined, 10000);
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
    executeCommand(args: string, username?: string, timeout = this.timeout): Promise<CommandResult> {
        return new Promise((resolve) => {
            const command = `./${this.executableFile} ${args}`;

            // If username is provided, kill any existing solver process for this user
            if (username) {
                const existing = this.activeProcesses.get(username);
                if (existing) {
                    try {
                        console.log(`Killing existing active process for user: ${username}`);
                        existing.kill('SIGTERM');
                    } catch (e) {
                        console.error(`Error killing existing process for user ${username}:`, e);
                    }
                    this.activeProcesses.delete(username);
                }
            }

            const child = exec(command, { cwd: this.executableDir, timeout }, (error, stdout, stderr) => {
                // Remove from active processes map if it's still this child
                if (username && this.activeProcesses.get(username) === child) {
                    this.activeProcesses.delete(username);
                }

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

            // Store the child process if username is provided
            if (username) {
                this.activeProcesses.set(username, child);
            }
        });
    }

    // Cancel active solve process for user
    async cancelSolve(req: Request, res: Response) {
        try {
            const username = req.user?.username || 'user';
            const child = this.activeProcesses.get(username);
            if (child) {
                console.log(`Killing active word game solver process for user: ${username}`);
                try {
                    child.kill('SIGTERM');
                } catch (e) {
                    console.error(`Error killing active process for user ${username}:`, e);
                }
                this.activeProcesses.delete(username);
                return sendSuccess(res, { message: 'Solve cancelled successfully' });
            }
            return sendSuccess(res, { message: 'No active solve process to cancel' });
        } catch (error: unknown) {
            console.error('Cancel solve error:', error);
            return sendError(res, 500, 'Failed to cancel solve operation', getErrorMessage(error));
        }
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
            console.error(`Error during file cleanup for ${filePath}:`, getErrorMessage(error));
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
                    console.error(`Error processing file ${filename} during cleanup:`, getErrorMessage(err));
                }
            }
        } catch (error: unknown) {
            console.error('Error during results directory cleanup:', getErrorMessage(error));
        }
    }
}
