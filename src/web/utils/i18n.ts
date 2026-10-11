/**
 * Small translation helpers.
 *
 * Translation files are flat key/value maps (see `data/data.ts`). Templates use
 * `{name}` placeholders. Countable phrases use two keys, `<key>_one` and
 * `<key>_other`, which covers German and English.
 */

export type Translations = Record<string, string>;
export type TranslationParams = Record<string, string | number>;

/** Replaces `{name}` placeholders. Unknown placeholders are left as they are. */
export function fmt(template: string | undefined, params?: TranslationParams): string {
    if (!template) {
        return "";
    }
    if (!params) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
    );
}

/**
 * Picks `<baseKey>_one` for a count of 1 and `<baseKey>_other` otherwise, then
 * fills `{count}` and any extra params.
 */
export function plural(
    t: Translations,
    baseKey: string,
    count: number,
    params?: TranslationParams,
): string {
    const key = count === 1 ? `${baseKey}_one` : `${baseKey}_other`;
    return fmt(t[key] ?? t[`${baseKey}_other`] ?? baseKey, { count, ...params });
}

/** BCP 47 locale for the app language. */
export function localeFor(language: string | undefined): string {
    return language === "de" ? "de-DE" : "en-GB";
}

/** Locale-aware date text, e.g. "9. Okt. 2026" or "9 Oct 2026". */
export function formatDate(
    value: Date | string | number,
    language: string | undefined,
    options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return new Intl.DateTimeFormat(localeFor(language), options).format(date);
}

/** Locale-aware number text. */
export function formatNumber(value: number, language: string | undefined, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(localeFor(language), options).format(value);
}

/** "mm:ss" for a number of seconds (minutes may exceed 59). */
export function formatClock(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
