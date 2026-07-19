/**
 * Samba/SFTPGo/Radicale file-access account management.
 *
 * Interfaces with the Python `setup/file_accounts.py` CRUD CLI to manage
 * users in accounts.json and trigger synchronization hooks across services.
 */
import { exec } from 'child_process';
import path from 'path';

// host-api runs with WorkingDirectory=${PROJECT_ROOT}/dashboard/host-api (systemd unit)
export const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

export interface FileAccount {
    username: string;
    isAdmin?: boolean;
}

function runPythonCli(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const cmd = `python3 setup/file_accounts.py ${args.join(' ')}`;
        exec(
            cmd,
            { cwd: REPO_ROOT, timeout: 150000 },
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Account CLI failed: ${stderr || error.message}`));
                } else {
                    resolve(stdout.trim());
                }
            }
        );
    });
}

export async function listAccounts(): Promise<Array<{ username: string; isAdmin?: boolean }>> {
    const raw = await runPythonCli(['list']);
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export async function createAccount(usernameRaw: string, password: string, isAdmin?: boolean, id?: number): Promise<string> {
    // Shell escape arguments
    const username = usernameRaw.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    const cmdArgs = ['create', username, `"${password.replace(/"/g, '\\"')}"` ];
    if (isAdmin) {
        cmdArgs.push('--admin True');
    }
    if (id !== undefined) {
        cmdArgs.push(`--id ${id}`);
    }
    await runPythonCli(cmdArgs);
    return username;
}

export async function updateAccountPassword(usernameRaw: string, password: string, isAdmin?: boolean, id?: number): Promise<string> {
    const username = usernameRaw.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    const cmdArgs = ['update-password', username, `"${password.replace(/"/g, '\\"')}"` ];
    if (isAdmin !== undefined) {
        cmdArgs.push(`--admin ${isAdmin ? 'True' : 'False'}`);
    }
    if (id !== undefined) {
        cmdArgs.push(`--id ${id}`);
    }
    await runPythonCli(cmdArgs);
    return username;
}

export async function deleteAccount(usernameRaw: string): Promise<string> {
    const username = usernameRaw.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    await runPythonCli(['delete', username]);
    return username;
}

export async function syncUsername(userId: number, usernameRaw: string): Promise<void> {
    const username = usernameRaw.trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    await runPythonCli(['sync-username', `--id ${userId}`, username]);
}
