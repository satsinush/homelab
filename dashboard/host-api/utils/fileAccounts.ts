/**
 * Samba/SFTPGo file-access account management.
 *
 * TypeScript port of setup/file_accounts.py + the loaddata generation in
 * sftpgo/setup.py so the dashboard can manage accounts at runtime. Both
 * services read the same source of truth: volumes/file-accounts/accounts.env.
 */
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// host-api runs with WorkingDirectory=${PROJECT_ROOT}/dashboard/host-api (systemd unit)
export const REPO_ROOT = path.resolve(process.cwd(), '..', '..');

const ACCOUNTS_ENV = path.join(REPO_ROOT, 'volumes', 'accounts', 'accounts.env');
const LOADDATA_PATH = path.join(REPO_ROOT, 'sftpgo', 'volumes', 'config', 'loaddata.json');
const USERS_ROOT = path.join(REPO_ROOT, 'storage', 'users');

const SFTPGO_USERS_HOME_PREFIX = '/srv/sftpgo/storage/users/';
const SFTPGO_SHARED_GROUP = 'file-users';

export interface FileAccount {
    username: string;
    password: string;
    isAdmin?: boolean;
}

export function safeUsername(name: string): string {
    // Lowercased because the samba image lowercases account names when hashing.
    const cleaned = (name || '').trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    if (!cleaned) {
        throw new Error('Invalid username: only letters, digits, ".", "_" and "-" are allowed');
    }
    return cleaned;
}

export function validatePassword(password: string): void {
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }
    // accounts.env is newline-delimited KEY=value
    if (/[\r\n]/.test(password)) {
        throw new Error('Password may not contain newlines');
    }
}

export function readAccounts(): Map<string, FileAccount> {
    const accounts = new Map<string, FileAccount>();
    if (!fs.existsSync(ACCOUNTS_ENV)) {
        return accounts;
    }
    for (const raw of fs.readFileSync(ACCOUNTS_ENV, 'utf8').split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const idx = line.indexOf('=');
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1);
        if (key.startsWith('ACCOUNT_')) {
            const username = key.slice('ACCOUNT_'.length);
            // Read optional config metadata from env variable suffix or similar if we ever need to persist,
            // but for now, we just pass the flag when calling writeSftpgoLoaddata.
            accounts.set(username, { username, password: value });
        }
    }
    return accounts;
}

function writeAccounts(accounts: Map<string, FileAccount>): void {
    const parent = path.dirname(ACCOUNTS_ENV);
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    try {
        fs.chmodSync(parent, 0o700);
    } catch {
        // Best-effort.
    }
    const lines = [
        '# User accounts for Samba (SMB), SFTPGo (WebDAV), and Radicale (CalDAV/CardDAV).',
        '# Shared source of truth — managed by setup scripts and the dashboard.',
        '# Usernames should match Authentik; password is local (≠ Authentik SSO).'
    ];
    for (const username of [...accounts.keys()].sort()) {
        lines.push(`ACCOUNT_${username}=${accounts.get(username)!.password}`);
    }
    fs.writeFileSync(ACCOUNTS_ENV, lines.join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(ACCOUNTS_ENV, 0o600);
}

function ensureUserHome(username: string): void {
    const home = path.join(USERS_ROOT, username);
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    try {
        fs.chmodSync(home, 0o700);
    } catch {
        // Best-effort: host-api runs as PUID so ownership is already correct.
    }
}

function writeSftpgoLoaddata(accounts: Map<string, FileAccount>): void {
    // SFTPGo admins are users who have isAdmin set to true in their FileAccount object
    const admins = [...accounts.values()]
        .filter((acc) => acc.isAdmin === true)
        .sort((a, b) => a.username.localeCompare(b.username))
        .map((acc) => ({
            username: acc.username,
            password: acc.password,
            status: 1,
            permissions: ['*']
        }));

    const folders = [
        {
            name: 'shared',
            mapped_path: '/srv/sftpgo/storage/shared',
            description: 'Shared storage for all file-access users',
            filesystem: { provider: 0 }
        }
    ];

    const users = [...accounts.keys()].sort().map((username) => {
        const home_dir = `/var/lib/sftpgo/home_roots/.home_${username}`;
        
        // Ensure the empty home root directory exists inside sftpgo volumes
        const hostHomeRoot = path.join(REPO_ROOT, 'sftpgo', 'volumes', 'data', 'home_roots', `.home_${username}`);
        fs.mkdirSync(hostHomeRoot, { recursive: true, mode: 0o700 });
        try { fs.chmodSync(hostHomeRoot, 0o700); } catch { /* ignore */ }

        folders.push({
            name: `personal_${username}`,
            mapped_path: `${SFTPGO_USERS_HOME_PREFIX}${username}`,
            description: `Personal storage for ${username}`,
            filesystem: { provider: 0 }
        });

        return {
            status: 1,
            username,
            password: accounts.get(username)!.password,
            home_dir,
            permissions: { '/': ['*'] },
            filters: {
                web_client: ['password-change-disabled']
            },
            virtual_folders: [
                {
                    name: `personal_${username}`,
                    virtual_path: '/personal',
                    quota_size: 0,
                    quota_files: 0
                },
                {
                    name: 'shared',
                    virtual_path: '/shared',
                    quota_size: 0,
                    quota_files: 0
                }
            ]
        };
    });

    const payload = {
        admins,
        users,
        folders,
        groups: [],
        version: 17
    };

    fs.mkdirSync(path.dirname(LOADDATA_PATH), { recursive: true });
    fs.writeFileSync(LOADDATA_PATH, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 });
    fs.chmodSync(LOADDATA_PATH, 0o600);
}

function writeRadicaleUsers(accounts: Map<string, FileAccount>): void {
    const lines: string[] = [];
    for (const [username, account] of [...accounts.entries()].sort()) {
        const hashed = crypto.createHash('sha1').update(account.password).digest();
        const sha = '{SHA}' + hashed.toString('base64');
        lines.push(`${username}:${sha}`);
    }
    const radicaleUsersPath = path.join(REPO_ROOT, 'radicale', 'volumes', 'config', 'users');
    fs.mkdirSync(path.dirname(radicaleUsersPath), { recursive: true });
    fs.writeFileSync(radicaleUsersPath, lines.join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(radicaleUsersPath, 0o600);
}

function recreateContainers(): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(
            'docker compose up -d --force-recreate samba sftpgo radicale',
            { cwd: REPO_ROOT, timeout: 120000 },
            (error, _stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to recreate containers: ${stderr || error.message}`));
                } else {
                    resolve();
                }
            }
        );
    });
}

/** Persist accounts to both services and recreate their containers. */
async function applyAccounts(accounts: Map<string, FileAccount>): Promise<void> {
    writeAccounts(accounts);
    writeSftpgoLoaddata(accounts);
    writeRadicaleUsers(accounts);
    await recreateContainers();
}

// Keep signature to match what's exported/used. We'll map internally.
export function listAccounts(): Array<{ username: string }> {
    return [...readAccounts().values()]
        .map(({ username }) => ({ username }))
        .sort((a, b) => a.username.localeCompare(b.username));
}

export async function createAccount(usernameRaw: string, password: string, isAdmin?: boolean): Promise<string> {
    const username = safeUsername(usernameRaw);
    validatePassword(password);
    const accounts = readAccounts();
    if (accounts.has(username)) {
        throw new Error(`Account "${username}" already exists`);
    }
    ensureUserHome(username);
    accounts.set(username, { username, password, isAdmin });
    await applyAccounts(accounts);
    return username;
}

export async function updateAccountPassword(usernameRaw: string, password: string, isAdmin?: boolean): Promise<string> {
    const username = safeUsername(usernameRaw);
    validatePassword(password);
    const accounts = readAccounts();
    const existing = accounts.get(username);
    if (!existing) {
        throw new Error(`Account "${username}" not found`);
    }
    accounts.set(username, { ...existing, password, ...(isAdmin !== undefined ? { isAdmin } : {}) });
    await applyAccounts(accounts);
    return username;
}

export async function deleteAccount(usernameRaw: string): Promise<string> {
    const username = safeUsername(usernameRaw);
    const accounts = readAccounts();
    if (!accounts.has(username)) {
        throw new Error(`Account "${username}" not found`);
    }
    accounts.delete(username);
    // Home directory in ./storage/users/<username> is kept — files are never deleted here.
    await applyAccounts(accounts);
    return username;
}
