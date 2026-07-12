// Parse generic word game output
export function parseWordGameOutput(output: string): string[] {
    if (!output || typeof output !== 'string') {
        return [];
    }

    const lines = output.split('\n')
        .map(line => line.trim().toUpperCase())
        .filter(line => line.length > 0);

    const solutions = lines.filter(line => /^[A-Z\s\-,]+$/.test(line));
    return solutions;
}
