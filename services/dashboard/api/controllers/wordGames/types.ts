export interface GuessWithEntropy {
    word?: string;
    pattern?: string;
    entropy: number;
    wnt?: number;
    probability: number;
}

export interface LetterSuggestion {
    letter: string;
    entropy: number;
    wnt?: number;
    probability: number;
}

export interface CommandResult {
    success: boolean;
    stdout: string;
    stderr: string;
    error?: string;
}
