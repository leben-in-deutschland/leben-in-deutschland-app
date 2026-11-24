import type { RegistryCentre } from "@/types/termine";
import registry from "./termine-registry.json";

/**
 * The exam centres whose course pages the dates sync reads (ADR-050): name,
 * town and the address of the page. The pages under /termine list them in
 * their HTML, so a visitor - or a search engine that runs no script - finds
 * the centres before the dates arrive. `termine-registry.json` is a copy of
 * `src/termine/sources.json` without the sync's own fields, written by
 * `node src/termine/web-registry.mjs`; the dates themselves are never part
 * of a build (`services/termine.ts`).
 */
export function termineRegistry(): RegistryCentre[] {
    return registry;
}
