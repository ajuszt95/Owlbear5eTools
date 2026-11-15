/**
 * Partnered (non-WotC) 5e.tools sources that ship monster data in the
 * community homebrew repository rather than in the WotC-only mirror.
 *
 * 5e.tools' build places partnered books under
 * `TheGiddyLimit/homebrew`, and their tokens under
 * `TheGiddyLimit/homebrew-img`. This map lets `fetchMonsterByIdentity`
 * route a URL import to the correct file.
 *
 * Keys are the lowercase 5e.tools source ids used in bestiary URLs (the
 * last `_`-segment). Values are repo-relative paths in
 * `TheGiddyLimit/homebrew`.
 *
 * The map lives in `homebrewSources.json` so the runtime import flow and
 * `scripts/build-monster-index.mjs` share one source of truth.
 *
 * To refresh this list, fetch the repo's `_generated/index-meta.json` and
 * `_generated/index-props.json`, keep entries where `meta.p === 1` (partnered)
 * and `props.monster` contains the file, then use each file's monster
 * `source` value (lowercased) as the key. Run `npm run build:index` after
 * editing the JSON to refresh the shipped monster search index.
 */
import registry from "./homebrewSources.json";

const HOMEBREW_RAW_BASE = registry.rawBase;

export const PARTNERED_HOMEBREW_SOURCES: Readonly<Record<string, string>> = registry.sources;

/**
 * Returns the raw GitHub URL for a partnered source's book data, or
 * `undefined` when the source is not partnered (i.e. lives in the
 * official WotC mirror).
 */
export function getPartneredHomebrewUrl(source: string): string | undefined {
    const path = PARTNERED_HOMEBREW_SOURCES[source.trim().toLowerCase()];
    if (!path) return undefined;
    return `${HOMEBREW_RAW_BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
