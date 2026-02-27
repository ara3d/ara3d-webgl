const PERF_PREFIX = '[ara3d-perf]';
const DEFAULT_LONG_TASK_THRESHOLD_MS = 16;

function hasPerformanceApi(): boolean {
    return typeof performance !== 'undefined' && typeof performance.now === 'function';
}

export function perfNow(): number {
    return hasPerformanceApi() ? performance.now() : Date.now();
}

export function shouldLogPerf(): boolean {
    if (typeof globalThis === 'undefined') {
        return false;
    }
    const perfFlag = (globalThis as any).__ARA3D_PERF__ as boolean | undefined;
    if (perfFlag !== undefined) {
        return !!perfFlag;
    }
    return true;
}

export function perfLog(stage: string, payload?: Record<string, unknown>): void {
    if (!shouldLogPerf()) return;
    if (payload) {
        console.debug(`${PERF_PREFIX} ${stage}`, payload);
    } else {
        console.debug(`${PERF_PREFIX} ${stage}`);
    }
}

export function perfDuration(
    stage: string,
    startedAtMs: number,
    payload?: Record<string, unknown>
): number {
    const durationMs = perfNow() - startedAtMs;
    perfLog(stage, { durationMs, ...payload });
    return durationMs;
}

export function perfLongTask(
    stage: string,
    startedAtMs: number,
    thresholdMs = DEFAULT_LONG_TASK_THRESHOLD_MS,
    payload?: Record<string, unknown>
): number {
    const durationMs = perfNow() - startedAtMs;
    if (durationMs >= thresholdMs && shouldLogPerf()) {
        console.warn(`${PERF_PREFIX} ${stage}`, { durationMs, thresholdMs, ...payload });
    }
    return durationMs;
}
