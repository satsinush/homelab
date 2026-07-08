import { UserProfile } from '../contexts/AuthContextCore';

export interface User {
    id: number;
    username: string;
    role: string;
}

export interface LoginResponse {
    user: UserProfile;
}

export interface VerifyResponse {
    user: UserProfile;
}

export interface LogoutResponse {
    redirect?: string;
}

export interface ConfigResponse {
    disableLocalAuth: boolean;
    ssoEnabled: boolean;
    piholeWebHostname?: string;
    dockhandWebHostname?: string;
    vaultwardenWebHostname?: string;
    gatusWebHostname?: string;
    gotifyWebHostname?: string;
    authentikWebHostname?: string;
}

export interface RustdeskConfig {
    available: boolean;
    relayHost: string;
    publicKey: string;
}

export interface Device {
    id?: number;
    name: string;
    mac: string;
    macNormalized?: string;
    isFavorite?: boolean;
    description: string;
    rustdeskId?: string;
    ip?: string;
    status?: 'online' | 'offline';
    lastActive?: string;
}

export interface DevicesResponse {
    devices: Device[];
}

export interface DeviceResponse {
    device: Device;
}

export interface ScanResponse {
    devices: Device[];
}

export interface ClearCacheResponse {
    deletedCount?: number;
    devices: Device[];
}

export interface FavoriteResponse {
    device: Device;
}

export interface Secret {
    name: string;
    value: string;
    description?: string;
}

export interface SecretsResponse {
    secrets: Secret[];
}

export interface SystemInfo {
    hostname: string;
    platform: string;
    uptime: number;
}

export interface ResourceMetrics {
    cpu?: {
        usage: number;
    };
    memory?: {
        percentage: number;
        used: number;
        total: number;
    };
    disk?: {
        percentage: number;
        available: number;
        total: number;
    };
    processes?: {
        total: number;
        running: number;
        sleeping: number;
    };
}

export interface NetworkInterface {
    name: string;
    active: boolean;
    downloadSpeed: number;
    uploadSpeed: number;
}

export interface NetworkInfo {
    interfaces: NetworkInterface[];
}

export interface SystemTemperature {
    cpu: number;
    gpu?: number;
}

export interface SystemDataResponse {
    system: SystemInfo;
    resources: ResourceMetrics;
    temperature: SystemTemperature | null;
    network: NetworkInfo;
}

export interface GameStatus {
    status: string;
    healthy?: boolean;
    message?: string;
    error?: string;
}

export interface LetterBoxedResponse {
    letters: string;
    totalSolutions: number;
    actualTotalFound: number;
    isLimited: boolean;
    executionTime: number;
    start: number;
    end: number;
    solutions: string[];
    actualResultsFile?: string;
    resultsFile: string;
}

export interface SpellingBeeResponse {
    letters: string;
    totalSolutions: number;
    actualTotalFound: number;
    isLimited: boolean;
    executionTime: number;
    start: number;
    end: number;
    solutions: string[];
    actualResultsFile?: string;
    resultsFile: string;
}

export interface WordleResponse {
    possibleWordsCount: number;
    guessesCount: number;
    isLimitedPossible: boolean;
    isLimitedGuesses: boolean;
    executionTime: number;
    start: number;
    end: number;
    possibleWords: {
        word: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        word: string;
        probability: number | null;
        entropy: number | null;
    }[];
    resultsFile: string;
}

export interface MastermindResponse {
    possibleCount: number;
    guessesCount: number;
    isLimitedPossible: boolean;
    isLimitedGuesses: boolean;
    executionTime: number;
    start: number;
    end: number;
    possiblePatterns: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    resultsFile: string;
}

export interface HangmanResponse {
    pattern: string;
    excludedLetters: string;
    possibleWordsCount: number;
    letterGuessesCount: number;
    isLimited: boolean;
    executionTime: number;
    start: number;
    end: number;
    letterSuggestions: {
        letter: string;
        probability: number | null;
        entropy: number | null;
    }[];
    possibleWords: string[];
    resultsFile: string;
}

export interface DungleonResponse {
    possiblePatternsCount: number;
    guessesCount: number;
    isLimitedPossible: boolean;
    isLimitedGuesses: boolean;
    executionTime: number;
    start: number;
    end: number;
    possiblePatterns: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    resultsFile: string;
}

export interface LoadMoreResponse {
    solutions?: {
        possibleWords?: (string | {
            word: string;
            probability: number | null;
            entropy: number | null;
        })[];
        possiblePatterns?: (string | {
            pattern: string;
            probability: number | null;
            entropy: number | null;
        })[];
        guessesWithEntropy?: {
            word?: string;
            pattern?: string;
            probability: number | null;
            entropy: number | null;
        }[];
    };
    solutionsList?: string[];
}

export interface ChatStatusResponse {
    status: string;
    version?: string;
}

export interface ChatModel {
    name: string;
    size: number;
    modified_at: string;
    details?: {
        family?: string;
        parameter_size?: string;
    };
}

export interface ChatModelsResponse {
    models: ChatModel[];
}

export interface ChatConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatConversationResponse {
    conversationHistory: ChatConversationMessage[];
}

export interface ChatMessageAction {
    type: string;
    payload: unknown;
}

export interface ChatMessageResponse {
    response: string;
    conversationHistory: ChatConversationMessage[];
    actions?: ChatMessageAction[];
}

export interface ChatModelDetails {
    name: string;
    installed: boolean;
    description?: string;
    size?: string;
    parameterSize?: string;
    quantizationLevel?: string;
}

export interface ChatModelsDetailedResponse {
    models: ChatModelDetails[];
}

export interface ServerSettings {
    theme?: string;
    [key: string]: unknown;
}

export interface UserSettings {
    theme?: string;
    [key: string]: unknown;
}

export interface LetterBoxedResultState {
    solutions: string[];
    gameData: {
        letters: string;
        config: number;
        totalSolutions: number;
        actualTotalFound: number;
        isLimited: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
}

export interface SpellingBeeResultState {
    solutions: string[];
    gameData: {
        letters: string;
        totalSolutions: number;
        actualTotalFound: number;
        isLimited: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
}

export interface WordleResultState {
    possibleWords: {
        word: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        word: string;
        probability: number | null;
        entropy: number | null;
    }[];
    gameData: {
        guesses: unknown;
        wordLength: number;
        maxDepth: number;
        excludeUncommonWords: boolean;
        possibleWordsCount: number;
        guessesCount: number;
        isLimitedPossible: boolean;
        isLimitedGuesses: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
}

export interface MastermindResultState {
    possiblePatterns: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    gameData: {
        guesses: unknown;
        pegs: number;
        colors: number;
        allowDuplicates: boolean;
        colorMapping?: {
            originalToMastermind: Record<number, number>;
            mastermindToOriginal: Record<number, number>;
        } | null;
        possibleCount: number;
        guessesCount: number;
        isLimitedPossible: boolean;
        isLimitedGuesses: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
}

export interface HangmanResultState {
    letterSuggestions: {
        letter: string;
        probability: number | null;
        entropy: number | null;
    }[];
    possibleWords: string[];
    gameData: {
        pattern: string;
        excludedLetters: string;
        possibleWordsCount: number;
        letterGuessesCount: number;
        isLimited: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
}

export interface DungleonResultState {
    possiblePatterns: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    guessesWithEntropy: {
        pattern: string;
        probability: number | null;
        entropy: number | null;
    }[];
    gameData: {
        guesses: unknown;
        possiblePatternsCount: number;
        guessesCount: number;
        isLimitedPossible: boolean;
        isLimitedGuesses: boolean;
        executionTime: number;
        start: number;
        end: number;
        resultsFile: string;
    } | null;
}

export interface LetterBoxedRequest {
    letters: string;
    preset: number;
    maxDepth?: number;
    minWordLength?: number;
    minUniqueLetters?: number;
    pruneRedundantPaths?: number;
    pruneDominatedClasses?: number;
    start?: number;
    end?: number;
}

export interface SpellingBeeRequest {
    letters: string;
    excludeUncommonWords: boolean;
    mustIncludeFirstLetter: boolean;
    reuseLetters: boolean;
    start?: number;
    end?: number;
}

export interface WordleRequest {
    guesses: unknown;
    wordLength: number;
    maxDepth: number;
    excludeUncommonWords: boolean;
    start?: number;
    end?: number;
}

export interface MastermindRequest {
    guesses: unknown;
    pegs: number;
    colors: number;
    allowDuplicates: boolean;
    maxDepth: number;
    colorMapping?: {
        originalToMastermind: Record<number, number>;
        mastermindToOriginal: Record<number, number>;
    } | null;
    start?: number;
    end?: number;
}

export interface HangmanRequest {
    pattern: string;
    excludedLetters: string;
    maxDepth: number;
    excludeUncommonWords: boolean;
    start?: number;
    end?: number;
}

export interface DungleonRequest {
    guesses: string[];
    results?: string[];
    solutions?: string[];
    maxDepth?: number;
    excludeImpossiblePatterns?: number;
    possiblePatternsCount?: number;
    guessesCount?: number;
    isLimitedPossible?: boolean;
    isLimitedGuesses?: boolean;
    executionTime?: number;
    start?: number;
    end?: number;
    resultsFile?: string;
}

export interface OllamaStatus {
    status: 'online' | 'offline';
    error?: string;
}


