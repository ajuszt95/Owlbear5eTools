import { crToNumber, scaleMonster } from "./utils/scaleCreature";
import { getPartneredHomebrewUrl } from "./homebrewSources";
import { resolveMonsterCopy, type MonsterTemplate } from "./monsterCopy";

export interface Monster {
    name: string;
    source: string;
    hp?: { average?: number; formula?: string; special?: number | string };
    ac?: Array<number | { ac: number }>;
    size?: string[]; // e.g. ["M"]
    tokenUrl?: string; // Resolved token image URL (official mirror or homebrew-img)
    sourceUrl?: string; // Original 5e.tools URL
    _displayName?: string;
    _scaledCr?: number;
    _isScaledCr?: boolean;
    _originalCr?: string | number;
    [key: string]: any; // full stat block
}

const GITHUB_MIRROR_BASE = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary";
const GITHUB_IMAGE_BASE = "https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main";

/**
 * The mirror names the Plane Shift books with a hyphen (`bestiary-ps-a.json`),
 * unlike every other source whose filename is just the lowercased source code.
 * Keep the exception explicit so URL imports and search picks resolve the same
 * file. Token directories still use the bare source code (`tokens/PSA/...`).
 */
const OFFICIAL_BESTIARY_FILE_OVERRIDES: Record<string, string> = {
    psa: "bestiary-ps-a.json",
    psd: "bestiary-ps-d.json",
    psi: "bestiary-ps-i.json",
    psk: "bestiary-ps-k.json",
    psx: "bestiary-ps-x.json",
    psz: "bestiary-ps-z.json",
};

export function getOfficialBestiaryFilename(source: string): string {
    const lower = source.trim().toLowerCase();
    return OFFICIAL_BESTIARY_FILE_OVERRIDES[lower] ?? `bestiary-${lower}.json`;
}

/**
 * Calculates a reliable GitHub Raw mirror URL for a monster token.
 * We prefer GitHub for reliability and CORS compatibility.
 */
export function calculateTokenUrl(name: string, source: string): string {
    // 5e.tools mirrors use a specific directory structure and .webp format for tokens.
    // Pattern: bestiary/tokens/[SOURCE]/[NAME].webp
    // Note: Spaces in the filename should be preserved or handled by the requester (encoded).
    return `${GITHUB_IMAGE_BASE}/bestiary/tokens/${source}/${encodeURIComponent(name)}.webp`;
}

/**
 * Normalizes a URL embedded in 5e.tools data. Homebrew `tokenHref` values
 * often contain literal spaces, which work in browsers but are safer
 * percent-encoded before they reach OBR's asset pipeline.
 */
function normalizeEmbeddedUrl(raw: string): string {
    try {
        return new URL(raw).href;
    } catch {
        return raw;
    }
}

/**
 * Maps 5e.tools creature sizes to Owlbear Rodeo grid unit sizes (at 150 DPI default).
 */
export function getMonsterDimensions(size?: string[]): { multiplier: number } {
    const s = size?.[0]?.toUpperCase() || "M";

    // Grid units (multiplier)
    switch (s) {
        case "T": return { multiplier: 0.5 }; // Tiny -> 0.5x0.5
        case "S": return { multiplier: 0.8 }; // Small -> 0.8x0.8 (User requested visual distinction)
        case "M": return { multiplier: 1 };   // Medium -> 1x1
        case "L": return { multiplier: 2 };   // Large -> 2x2
        case "H": return { multiplier: 3 };   // Huge -> 3x3
        case "G": return { multiplier: 4 };   // Gargantuan -> 4x4
        default: return { multiplier: 1 };
    }
}

function parseScaledCr(commaParts: string[]): number | null {
    for (let i = 1; i < commaParts.length; i++) {
        const part = commaParts[i].trim();
        if (part.startsWith("scaled:")) {
            const raw = part.substring("scaled:".length).trim();
            const num = crToNumber(raw);
            if (num !== null && !isNaN(num) && num >= 0 && num <= 30) return num;
        }
    }
    return null;
}

export function buildCanonicalSourceUrl(name: string, source: string): string {
    return `https://5e.tools/bestiary.html#${encodeURIComponent(name.toLowerCase())}_${source.toLowerCase()}`;
}

export interface FetchByIdentityOptions {
    targetCr?: number | null;
    sourceUrl?: string;
}

export interface BestiaryBook {
    monsterList: Monster[];
    isPartnered: boolean;
}

function sanitizeMonsterName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchBestiaryBook(source: string): Promise<BestiaryBook> {
    const cleanSource = source.trim();
    const homebrewUrl = getPartneredHomebrewUrl(cleanSource);
    const isPartnered = homebrewUrl !== undefined;
    const jsonUrl = homebrewUrl ?? `${GITHUB_MIRROR_BASE}/${getOfficialBestiaryFilename(cleanSource)}`;

    const response = await fetch(jsonUrl);
    if (!response.ok) {
        const sourceKind = isPartnered ? "partnered homebrew" : "Bestiary";
        throw new Error(`Failed to fetch ${sourceKind} data for book: ${cleanSource}. (Status ${response.status})`);
    }

    const data = await response.json();
    const monsterList: Monster[] = data.monster;
    if (!monsterList || monsterList.length === 0) {
        throw new Error(`No monsters found in book data for source: ${cleanSource}`);
    }

    return { monsterList, isPartnered };
}

function findMonsterInList(
    monsterList: Monster[],
    name: string,
    source: string,
    isPartnered: boolean
): Monster | undefined {
    // A partnered file can host more than one source id, so prefer
    // entries that match the source from the URL before matching names.
    const sourceMatches = isPartnered
        ? monsterList.filter((m) => m.source.toLowerCase() === source.trim().toLowerCase())
        : [];
    const candidates = sourceMatches.length > 0 ? sourceMatches : monsterList;

    const targetNameSanitized = sanitizeMonsterName(name);
    let foundMonster = candidates.find((m) => sanitizeMonsterName(m.name) === targetNameSanitized);

    // Fallback matching if exact sanitized match fails
    if (!foundMonster) {
        foundMonster = candidates.find(
            (m) =>
                sanitizeMonsterName(m.name).startsWith(targetNameSanitized) ||
                targetNameSanitized.startsWith(sanitizeMonsterName(m.name))
        );
    }

    return foundMonster;
}

async function loadMonsterTemplates(): Promise<MonsterTemplate[]> {
    try {
        const response = await fetch(`${GITHUB_MIRROR_BASE}/template.json`);
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data.monsterTemplate) ? data.monsterTemplate : [];
    } catch {
        // Templates only affect a subset of copied monsters; a template
        // outage should not block an otherwise valid import.
        return [];
    }
}

export async function fetchMonsterByIdentity(
    name: string,
    source: string,
    opts?: FetchByIdentityOptions
): Promise<Monster> {
    const cleanSource = source.trim();
    const cleanName = name.trim();
    if (!cleanSource || !cleanName) {
        throw new Error("Import failed: Could not extract creature name or source book.");
    }

    try {
        // Partnered books (Tome of Beasts, Flee Mortals, etc.) live in the
        // community homebrew repo; WotC books live in the official mirror.
        // Cache per import so a _copy chain that stays inside one book does
        // not download it twice.
        const bookCache = new Map<string, Promise<BestiaryBook>>();
        const loadBook = (bookSource: string): Promise<BestiaryBook> => {
            const key = bookSource.trim().toLowerCase();
            let promise = bookCache.get(key);
            if (!promise) {
                promise = fetchBestiaryBook(bookSource);
                bookCache.set(key, promise);
            }
            return promise;
        };

        const { monsterList, isPartnered } = await loadBook(cleanSource);

        let foundMonster = findMonsterInList(monsterList, cleanName, cleanSource, isPartnered);

        if (!foundMonster) {
            throw new Error(`Monster matching '${cleanName}' not found in the '${cleanSource}' book data.`);
        }

        // 5e.tools stores many creatures as `_copy` references (Plane Shift,
        // named NPCs, template variants). Resolve the chain before exposing
        // HP/AC/actions, otherwise copied monsters import with no stat block.
        let templatesPromise: Promise<MonsterTemplate[]> | undefined;
        const getTemplates = () => (templatesPromise ??= loadMonsterTemplates());
        foundMonster = (await resolveMonsterCopy(foundMonster, {
            loadMonster: async (baseName, baseSource) => {
                const book = await loadBook(baseSource);
                return findMonsterInList(book.monsterList, baseName, baseSource, book.isPartnered);
            },
            loadTemplates: getTemplates,
        })) as Monster;

        // Prefer the token URL embedded in the data (partnered books point at
        // the homebrew image repo). Only synthesize the official mirror path
        // for WotC sources; partnered books without a token keep it unset.
        const embeddedTokenUrl = typeof foundMonster.tokenHref?.url === "string"
            ? foundMonster.tokenHref.url
            : undefined;
        if (embeddedTokenUrl) {
            foundMonster.tokenUrl = normalizeEmbeddedUrl(embeddedTokenUrl);
        } else if (!isPartnered) {
            foundMonster.tokenUrl = calculateTokenUrl(foundMonster.name, foundMonster.source);
        }

        // Store original source URL for hyperlink support.
        // Search picks synthesize a canonical 5e.tools URL so the
        // ViewPopover "view on 5e.tools" link still works.
        foundMonster.sourceUrl = opts?.sourceUrl ?? buildCanonicalSourceUrl(foundMonster.name, foundMonster.source);

        // Apply CR scaling if targetCr is present
        const targetCr = opts?.targetCr ?? null;
        if (targetCr !== null) {
            foundMonster = scaleMonster(foundMonster, targetCr);
        }

        return foundMonster;
    } catch (err: any) {
        if (err.message?.startsWith("Import failed:")) {
            throw err;
        }
        if (err.message) {
            throw new Error(`Import failed: ${err.message}`);
        }
        throw new Error("Invalid URL or network error fetching 5e.tools data.");
    }
}

export async function fetchMonsterData(url: string): Promise<Monster> {
    let source = "";
    let nameIdentifier = "";
    let targetCr: number | null = null;

    try {
        const urlObj = new URL(url);
        const searchParams = urlObj.searchParams;

        // 1. Check for Query Params (New in v1.2.0)
        // Format: index.html?source=WhereEvilLives&hash=abyssal%2520hyena_whereevillives
        if (searchParams.has("hash")) {
            // 5e.tools often double-encodes the hash param (e.g. %2520 for space)
            const rawHash = searchParams.get("hash") || "";
            // Decode twice to handle %25 -> % -> space
            const decodedHash = decodeURIComponent(decodeURIComponent(rawHash));

            const commaParts = decodedHash.split(",");
            const mainIdentity = commaParts[0] || "";

            const parsed = parseScaledCr(commaParts);
            if (parsed !== null) targetCr = parsed;

            if (mainIdentity.includes("_")) {
                const parts = mainIdentity.split("_");
                source = searchParams.get("source") || parts.pop() || "";
                nameIdentifier = parts.join("_");
            } else {
                nameIdentifier = mainIdentity;
                source = searchParams.get("source") || "";
            }
        }
        // 2. Fallback to standard hash format: bestiary.html#aarakocra_lox or #giant%20squid_xmm,scaled:9
        else if (urlObj.hash && urlObj.hash.length > 1) {
            // Decode the hash to handle encoded spaces (e.g. %20)
            const decodedHash = decodeURIComponent(urlObj.hash.substring(1)); // remove leading #
            const commaParts = decodedHash.split(",");
            const mainIdentity = commaParts[0] || "";

            const parsed = parseScaledCr(commaParts);
            if (parsed !== null) targetCr = parsed;

            if (mainIdentity.includes("_")) {
                const hashParts = mainIdentity.split("_");
                source = hashParts.pop() || "";
                nameIdentifier = hashParts.join("_");
            }
        }
        // 3. Fallback to path format: https://5e.tools/bestiary/aarakocra-spelljammer-lox.html
        else if (urlObj.pathname.includes(".html") && urlObj.pathname.includes("/")) {
            const pathPart = urlObj.pathname.split("/").pop() || "";
            const nameWithoutExt = pathPart.replace(".html", "");

            // The path format often uses dashes instead of underscores
            const pathParts = nameWithoutExt.split("-");
            if (pathParts.length >= 2) {
                source = pathParts.pop() || "";
                nameIdentifier = pathParts.join("-");
            }
        }

        if (!source || !nameIdentifier) {
            throw new Error("Invalid 5e.tools URL format. Could not extract creature name or source book.");
        }

        // Delegate to the shared identity core (same matching +
        // tokenUrl/sourceUrl attachment + CR scaling as search picks).
        return await fetchMonsterByIdentity(nameIdentifier, source, { targetCr, sourceUrl: url });
    } catch (err: any) {
        if (err.message?.startsWith("Import failed:")) {
            throw err;
        }
        if (err.message) {
            throw new Error(`Import failed: ${err.message}`);
        }
        throw new Error("Invalid URL or network error fetching 5e.tools data.");
    }
}

export function extractAC(monster: Monster): number {
    if (!monster.ac || monster.ac.length === 0) return 10; // Default AC
    const firstAC = monster.ac[0];
    if (typeof firstAC === "number") {
        return firstAC;
    } else if (firstAC && typeof firstAC === "object" && typeof (firstAC as any).ac === "number") {
        return (firstAC as any).ac;
    }
    return 10;
}

export function extractHP(monster: Monster): number {
    if (monster.hp && typeof monster.hp.average === "number") {
        return monster.hp.average;
    }
    return 10; // Default HP if none found
}
