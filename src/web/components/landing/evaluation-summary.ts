import type { EvaluationData } from "@/types/evaluation";
import { dayKey, daysBetween, parseGermanDate } from "@/utils/date-utils";

export type EvaluationCycle = {
    /** "DD.MM.YYYY" as published by the BAMF. */
    examDate: string;
    checkedAt: string;
    waitDays: number;
};

/** Serializable facts about the BAMF evaluation tracker, computed once at build time. */
export type EvaluationSummary = {
    examDate: string;
    /** Date part of the last sync, "DD.MM.YYYY". */
    lastSync: string;
    lastSyncAt: string;
    /** Median days between exam date and result publication. */
    avgWait: number;
    historyCount: number;
    /** The latest cycles, oldest first. */
    recent: EvaluationCycle[];
    /** ISO day keys of the first exam and the last check, when history exists. */
    coverage: [string, string] | null;
};

const RECENT_CYCLES = 10;

function toDayKey(germanDate: string): string {
    return dayKey(parseGermanDate(germanDate));
}

function median(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function summarizeEvaluation(data: EvaluationData): EvaluationSummary {
    const cycles: EvaluationCycle[] = data.history.map((entry) => ({
        examDate: entry.examDate,
        checkedAt: entry.checkedAt,
        waitDays: Math.abs(daysBetween(toDayKey(entry.examDate), toDayKey(entry.checkedAt))),
    }));
    const first = data.history[0];
    const last = data.history[data.history.length - 1];
    return {
        examDate: data.examDate,
        lastSync: data.lastSyncAt.split(" ")[0],
        lastSyncAt: data.lastSyncAt,
        avgWait: median(cycles.map((cycle) => cycle.waitDays)),
        historyCount: data.history.length,
        recent: cycles.slice(-RECENT_CYCLES),
        coverage: first && last ? [toDayKey(first.examDate), toDayKey(last.checkedAt)] : null,
    };
}
