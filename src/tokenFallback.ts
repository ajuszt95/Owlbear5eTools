/**
 * Local placeholder art for monsters that have no token image.
 *
 * Many partnered homebrew books (and some official entries) ship no token.
 * 5e.tools' old `img/token/blank.png` fallback is a 404, so the extension
 * ships its own asset under `public/` and resolves it against the extension
 * origin. Keeping it local also avoids a third-party request just to render
 * a placeholder.
 */
export const FALLBACK_TOKEN_FILENAME = "token-placeholder.png";

/**
 * Absolute URL for the bundled placeholder. Falls back to a root-relative
 * path in non-browser contexts (unit tests).
 */
export function getFallbackTokenUrl(
    origin: string | undefined = typeof window !== "undefined" ? window.location.origin : undefined
): string {
    const base = import.meta.env.BASE_URL || "/";
    const path = base.endsWith("/") ? `${base}${FALLBACK_TOKEN_FILENAME}` : `${base}/${FALLBACK_TOKEN_FILENAME}`;
    if (!origin) return path;
    try {
        return new URL(path, origin).href;
    } catch {
        // Opaque origins (e.g. a sandboxed iframe reporting "null") cannot be
        // used as a URL base; the root-relative path still resolves correctly.
        return path;
    }
}
