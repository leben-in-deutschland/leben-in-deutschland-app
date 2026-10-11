import { useEffect, useSyncExternalStore } from "react";
import { evaluationData } from "@/data/data";
import { refreshEvaluation } from "@/services/evaluation";
import type { EvaluationData } from "@/types/evaluation";
import { newestEvaluation, readEvaluationCache, subscribeEvaluationCache } from "@/utils/evaluation-store";

const bundled = evaluationData();

function cachedSnapshot(): EvaluationData | null {
    return readEvaluationCache().data;
}

function serverSnapshot(): EvaluationData | null {
    return null;
}

/** The newest BAMF status we know: the bundled file or a fresher download. Triggers one refresh per mount on Android. */
export function useEvaluation(): EvaluationData {
    const cached = useSyncExternalStore(subscribeEvaluationCache, cachedSnapshot, serverSnapshot);
    useEffect(() => {
        void refreshEvaluation();
    }, []);
    return newestEvaluation(bundled, cached);
}
