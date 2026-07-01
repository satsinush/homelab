const fs = require('fs');

/**
 * Gets the value of an environment variable, supporting _FILE fallback.
 * If VAR_NAME exists, returns its value.
 * Otherwise, if VAR_NAME_FILE exists and points to a valid file, returns the file's trimmed contents.
 * 
 * @param {string} varName - The name of the environment variable (e.g. 'DASHBOARD_OIDC_SECRET')
 * @param {any} [defaultValue] - The default value if neither is set
 * @returns {any} The resolved environment variable value
 */
function getEnv(varName, defaultValue = undefined) {
    if (process.env[varName] !== undefined) {
        return process.env[varName];
    }
    
    const fileEnvName = varName + '_FILE';
    if (process.env[fileEnvName]) {
        try {
            const filePath = process.env[fileEnvName];
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf8').trim();
            }
        } catch (error) {
            console.error(`Failed to read environment secret file from ${process.env[fileEnvName]}:`, error.message);
        }
    }
    
    return defaultValue;
}

module.exports = { getEnv };
