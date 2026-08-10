import { tryApiCall } from './api';
import type { SystemDataResponse } from '../types/api';

/** Fetch /system; pass force to bypass the dashboard-api metrics cache. */
export async function fetchSystemMetrics(options?: {
    force?: boolean;
}): Promise<SystemDataResponse> {
    const force = options?.force ?? false;
    const res = await tryApiCall<SystemDataResponse>(
        force ? '/system?refresh=1' : '/system'
    );
    return res.data;
}
