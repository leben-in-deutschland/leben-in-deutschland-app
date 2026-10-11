import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import enBase from "@/data/translations/en.json";
import deBase from "@/data/translations/de.json";
import { getTranslations, translationAreas } from "@/data/data";

const ROOT = path.resolve(__dirname, "..");

function placeholders(text: string): string[] {
    return Array.from(text.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort();
}

function sourceFiles(dir: string): string[] {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) {
        return [];
    }
    return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
        const relative = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return sourceFiles(relative);
        }
        return /\.(tsx?|jsx?)$/.test(entry.name) ? [relative] : [];
    });
}

describe("translations", () => {
    it("base files have the same keys in English and German", () => {
        expect(Object.keys(deBase).sort()).toEqual(Object.keys(enBase).sort());
    });

    for (const area of Object.keys(translationAreas.en) as (keyof typeof translationAreas.en)[]) {
        describe(`area "${area}"`, () => {
            const en = translationAreas.en[area] as Record<string, string>;
            const de = translationAreas.de[area] as Record<string, string>;

            it("has the same keys in English and German", () => {
                expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
            });

            it("uses the same placeholders in both languages", () => {
                for (const key of Object.keys(en)) {
                    expect({ key, placeholders: placeholders(de[key] ?? "") }).toEqual({ key, placeholders: placeholders(en[key]) });
                }
            });

            it("has no empty texts", () => {
                for (const [key, value] of [...Object.entries(en), ...Object.entries(de)]) {
                    expect({ key, empty: typeof value !== "string" || value.trim() === "" }).toEqual({ key, empty: false });
                }
            });
        });
    }

    it("does not define the same key in two areas", () => {
        const seen = new Map<string, string>();
        const duplicates: string[] = [];
        for (const [area, texts] of Object.entries(translationAreas.en)) {
            for (const key of Object.keys(texts)) {
                if (seen.has(key)) {
                    duplicates.push(`${key} (${seen.get(key)} and ${area})`);
                }
                seen.set(key, area);
            }
        }
        expect(duplicates).toEqual([]);
    });

    it("every key used in the source exists in both languages", () => {
        const en = getTranslations("en") as Record<string, string>;
        const de = getTranslations("de") as Record<string, string>;
        const pattern = /\b(?:t|translation|translations|allTranslations)(?:\.([a-z][a-z0-9_]*)|\[\s*["']([a-z][a-z0-9_]*)["']\s*\])/g;
        const missing: string[] = [];
        for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
            const source = fs.readFileSync(path.join(ROOT, file), "utf8");
            for (const match of source.matchAll(pattern)) {
                const key = match[1] ?? match[2];
                if (!(key in en) || !(key in de)) {
                    missing.push(`${file}: ${key}`);
                }
            }
        }
        expect(Array.from(new Set(missing))).toEqual([]);
    });
});
