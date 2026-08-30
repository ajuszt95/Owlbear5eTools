import { crToNumber, scaleMonster } from "./utils/scaleCreature";

export interface Monster {
    name: string;
    source: string;
    hp?: { average?: number; formula?: string; special?: number | string };
    ac?: Array<number | { ac: number }>;
    size?: string[]; // e.g. ["M"]
    tokenUrl?: string; // Resolved GitHub Mirror URL
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

        // Fetch the JSON for the specific book
        const jsonUrl = `${GITHUB_MIRROR_BASE}/bestiary-${source.toLowerCase()}.json`;
        const response = await fetch(jsonUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch Bestiary data for book: ${source}. (Status ${response.status})`);
        }

        const data = await response.json();
        const monsterList: Monster[] = data.monster;

        if (!monsterList || monsterList.length === 0) {
            throw new Error(`No monsters found in book data for source: ${source}`);
        }

        // Find the specific monster
        // Use a more relaxed sanitizer for external URLs which might have complex characters
        const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetNameSanitized = sanitize(nameIdentifier);

        let foundMonster = monsterList.find((m) =>
            sanitize(m.name) === targetNameSanitized ||
            targetNameSanitized === sanitize(m.name)
        );

        // Fallback matching if exact sanitized match fails
        if (!foundMonster) {
            foundMonster = monsterList.find(m => 
                sanitize(m.name).startsWith(targetNameSanitized) || 
                targetNameSanitized.startsWith(sanitize(m.name))
            );
        }

        if (!foundMonster) {
            throw new Error(`Monster matching '${nameIdentifier}' not found in the '${source}' book data.`);
        }

        // Attach resolved token URL for the Quick Spawn feature
        if (foundMonster.hasToken || foundMonster.tokenUrl === undefined) {
            foundMonster.tokenUrl = calculateTokenUrl(foundMonster.name, foundMonster.source);
        }

        // Store original source URL for hyperlink support
        foundMonster.sourceUrl = url;

        // Apply CR scaling if targetCr is present
        if (targetCr !== null) {
            foundMonster = scaleMonster(foundMonster, targetCr);
        }

        return foundMonster;
    } catch (err: any) {
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
