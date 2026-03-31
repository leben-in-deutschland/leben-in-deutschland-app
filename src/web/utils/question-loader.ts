import { QuestionTranslation } from "@/types/question";

/**
 * In-memory caches so each file is fetched at most once per session.
 */
const contextCache = new Map<string, Record<string, string>>();
const translationCache = new Map<string, Record<string, QuestionTranslation>>();

/**
 * Load context (explanation) for a given language.
 * Files live at /data/context/{lang}.json
 * Returns a map of questionNum -> context markdown string.
 */
export async function loadContext(lang: string): Promise<Record<string, string>> {
    const cached = contextCache.get(lang);
    if (cached) return cached;

    const res = await fetch(`/data/context/${lang}.json`);
    if (!res.ok) {
        console.error(`Failed to load context for lang "${lang}": ${res.status}`);
        return {};
    }
    const data = await res.json() as Record<string, string>;
    contextCache.set(lang, data);
    return data;
}

/**
 * Load translations (question + a-d) for a given language.
 * Files live at /data/translations/{lang}.json
 * Returns a map of questionNum -> { question, a, b, c, d }.
 */
export async function loadTranslation(lang: string): Promise<Record<string, QuestionTranslation>> {
    const cached = translationCache.get(lang);
    if (cached) return cached;

    const res = await fetch(`/data/translations/${lang}.json`);
    if (!res.ok) {
        console.error(`Failed to load translation for lang "${lang}": ${res.status}`);
        return {};
    }
    const data = await res.json() as Record<string, QuestionTranslation>;
    translationCache.set(lang, data);
    return data;
}

/**
 * Load a single question's context for a given language.
 * Convenience wrapper that fetches the full language file (cached) and returns one entry.
 */
export async function loadQuestionContext(num: string, lang: string): Promise<string | null> {
    const contexts = await loadContext(lang);
    return contexts[num] ?? null;
}

/**
 * Load a single question's translation for a given language.
 * Convenience wrapper that fetches the full language file (cached) and returns one entry.
 */
export async function loadQuestionTranslation(num: string, lang: string): Promise<QuestionTranslation | null> {
    const translations = await loadTranslation(lang);
    return translations[num] ?? null;
}
