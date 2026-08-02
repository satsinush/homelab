import config from '../config';
import { getErrorMessage } from '../utils/errors';

export interface GatusSummary {
    up: number;
    down: number;
    total: number;
}

type GatusEndpointStatus = {
    name?: string;
    results?: Array<{ success?: boolean }>;
};

class GatusService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.gatus.url.replace(/\/$/, '');
    }

    async getSummary(): Promise<GatusSummary> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/endpoints/statuses`, {
                signal: AbortSignal.timeout(8000),
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`Gatus responded ${response.status}`);
            }
            const raw: unknown = await response.json();
            const endpoints: GatusEndpointStatus[] = Array.isArray(raw)
                ? raw
                : raw && typeof raw === 'object'
                  ? (Object.values(raw) as GatusEndpointStatus[])
                  : [];

            let up = 0;
            let down = 0;
            for (const ep of endpoints) {
                const results = Array.isArray(ep.results) ? ep.results : [];
                const latest = results.length > 0 ? results[results.length - 1] : null;
                if (latest?.success === true) up += 1;
                else down += 1;
            }
            return { up, down, total: up + down };
        } catch (error: unknown) {
            console.error('Gatus summary fetch failed:', getErrorMessage(error));
            throw error;
        }
    }
}

export default GatusService;
