import { LetterSuggestion } from '../types';

// Parse Hangman results file
// File format: letter guesses (letter entropy probability, space-separated), then possible words (one per line)
export function parseHangmanOutput(output: string, _letterCount: number): { letterSuggestions: LetterSuggestion[]; possibleWords: string[] } {
    if (!output || typeof output !== 'string') {
        return { letterSuggestions: [], possibleWords: [] };
    }

    const lines = output.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const letterSuggestions: LetterSuggestion[] = [];
    const possibleWords: string[] = [];

    for (const line of lines) {
        const parts = line.split(/[\s,]+/);
        if (parts.length >= 4 && parts[0].length === 1 && /^[A-Z]$/i.test(parts[0])) {
            letterSuggestions.push({
                letter: parts[0].toUpperCase(),
                entropy: parseFloat(parts[1]),
                wnt: parseFloat(parts[2]),
                probability: parseFloat(parts[3])
            });
        } else if (parts.length === 3 && parts[0].length === 1 && /^[A-Z]$/i.test(parts[0])) {
            letterSuggestions.push({
                letter: parts[0].toUpperCase(),
                entropy: parseFloat(parts[1]),
                wnt: Math.ceil(parseFloat(parts[1])),
                probability: parseFloat(parts[2])
            });
        } else {
            const word = line.toUpperCase();
            if (/^[A-Z]+$/.test(word)) {
                possibleWords.push(word);
            }
        }
    }

    return { letterSuggestions, possibleWords };
}
