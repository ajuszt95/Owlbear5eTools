import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FALLBACK_TOKEN_FILENAME, getFallbackTokenUrl } from "./tokenFallback";

const assetPath = fileURLToPath(new URL(`../public/${FALLBACK_TOKEN_FILENAME}`, import.meta.url));

describe("getFallbackTokenUrl", () => {
    it("resolves the bundled placeholder against the extension origin and Vite base path", () => {
        const base = import.meta.env.BASE_URL || "/";
        const expected = new URL(
            base.endsWith("/") ? `${base}${FALLBACK_TOKEN_FILENAME}` : `${base}/${FALLBACK_TOKEN_FILENAME}`,
            "https://example.com"
        ).href;
        expect(getFallbackTokenUrl("https://example.com")).toBe(expected);
        expect(expected).not.toContain("5e.tools");
    });

    it("returns a root-relative path when no origin is available", () => {
        expect(getFallbackTokenUrl(undefined)).toMatch(new RegExp(`/${FALLBACK_TOKEN_FILENAME}$`));
    });

    it("falls back to a relative path for an opaque origin", () => {
        expect(getFallbackTokenUrl("null")).toMatch(new RegExp(`/${FALLBACK_TOKEN_FILENAME}$`));
    });

    it("ships a real PNG asset at public/token-placeholder.png", () => {
        const bytes = readFileSync(assetPath);
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        expect(bytes.length).toBeGreaterThan(1000);
    });
});
