import fs from 'fs';

/**
 * Gets the value of an environment variable, supporting _FILE fallback.
 */
export function getEnv(varName: string, defaultValue: string | undefined = undefined): string | undefined {
    if (process.env[varName] !== undefined) {
        return process.env[varName];
    }
    
    const fileEnvName = varName + '_FILE';
    const filePath = process.env[fileEnvName];
    if (filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf8').trim();
            }
        } catch (error: any) {
            console.error(`Failed to read environment secret file from ${filePath}:`, error.message);
        }
    }
    
    return defaultValue;
}
