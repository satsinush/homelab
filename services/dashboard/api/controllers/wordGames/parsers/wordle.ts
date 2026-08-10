import { GuessWithEntropy } from '../types';

// Parse Wordle results file
// File format: possible words (CSV lines: word,entropy,probability), then CSV lines: word,entropy,probability
export function parseWordleOutput(output: string, possibleCount: number): { possibleWords: GuessWithEntropy[]; guessesWithEntropy: GuessWithEntropy[] } {
    if (!output || typeof output !== 'string') {
        return { possibleWords: [], guessesWithEntropy: [] };
    }

    const lines = output.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const possibleWords: GuessWithEntropy[] = [];
    const guessesWithEntropy: GuessWithEntropy[] = [];

    let lineIdx = 0;
    for (const line of lines) {
        if (line.includes(',')) {
            const parts = line.split(',');
            if (parts.length >= 4) {
                const item = {
                    word: parts[0].toUpperCase(),
                    entropy: parseFloat(parts[1]),
                    wnt: parseFloat(parts[2]),
                    probability: parseFloat(parts[3])
                };
                if (lineIdx < possibleCount) {
                    possibleWords.push(item);
                } else {
                    guessesWithEntropy.push(item);
                }
            } else if (parts.length === 3) {
                const item = {
                    word: parts[0].toUpperCase(),
                    entropy: parseFloat(parts[1]),
                    wnt: Math.ceil(parseFloat(parts[1])),
                    probability: parseFloat(parts[2])
                };
                if (lineIdx < possibleCount) {
                    possibleWords.push(item);
                } else {
                    guessesWithEntropy.push(item);
                }
            }
        } else {
            // Backward compatibility if any old file style is read
            const word = line.toUpperCase();
            if (/^[A-Z]+$/.test(word)) {
                possibleWords.push({
                    word,
                    entropy: 0.0,
                    wnt: 0.0,
                    probability: 1.0
                });
            }
        }
        lineIdx++;
    }

    return { possibleWords, guessesWithEntropy };
}
