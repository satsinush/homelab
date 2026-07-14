import { GuessWithEntropy } from '../types';

// Parse Dungleon results file
// File format: possible patterns (CSV lines: pattern,entropy,probability), then CSV lines: pattern,entropy,probability
export function parseDungleonOutput(output: string, possibleCount: number): { possiblePatterns: GuessWithEntropy[]; guessesWithEntropy: GuessWithEntropy[] } {
    if (!output || typeof output !== 'string') {
        return { possiblePatterns: [], guessesWithEntropy: [] };
    }

    const lines = output.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const possiblePatterns: GuessWithEntropy[] = [];
    const guessesWithEntropy: GuessWithEntropy[] = [];

    let lineIdx = 0;
    for (const line of lines) {
        if (line.includes(',')) {
            const parts = line.split(',');
            if (parts.length >= 4) {
                const item = {
                    pattern: parts[0].trim(),
                    entropy: parseFloat(parts[1]),
                    wnt: parseFloat(parts[2]),
                    probability: parseFloat(parts[3])
                };
                if (lineIdx < possibleCount) {
                    possiblePatterns.push(item);
                } else {
                    guessesWithEntropy.push(item);
                }
            } else if (parts.length === 3) {
                const item = {
                    pattern: parts[0].trim(),
                    entropy: parseFloat(parts[1]),
                    wnt: Math.ceil(parseFloat(parts[1])),
                    probability: parseFloat(parts[2])
                };
                if (lineIdx < possibleCount) {
                    possiblePatterns.push(item);
                } else {
                    guessesWithEntropy.push(item);
                }
            }
        } else {
            // Backward compatibility
            if (line.split(/\s+/).length === 5) {
                possiblePatterns.push({
                    pattern: line,
                    entropy: 0.0,
                    wnt: 0.0,
                    probability: 1.0
                });
            }
        }
        lineIdx++;
    }

    return { possiblePatterns, guessesWithEntropy };
}
