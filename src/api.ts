export interface Monster {
    name: string;
    source: string;
    hp?: { average?: number };
    ac?: Array<number | { ac: number }>;
    size?: string[]; // e.g. ["M"]
    tokenUrl?: string; // Resolved GitHub Mirror URL
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
export function getMonsterDimensions(size?: string[]): { width: number; height: number } {
    const s = size?.[0]?.toUpperCase() || "M";

    // Grid units * 150 (standard OBR DPI for 1x1 token)
    switch (s) {
        case "T": return { width: 150, height: 150 };  // Tiny -> 1x1
        case "S": return { width: 150, height: 150 };  // Small -> 1x1
        case "M": return { width: 150, height: 150 };  // Medium -> 1x1
        case "L": return { width: 300, height: 300 };  // Large -> 2x2
        case "H": return { width: 450, height: 450 };  // Huge -> 3x3
        case "G": return { width: 600, height: 600 };  // Gargantuan -> 4x4
        default: return { width: 150, height: 150 };
    }
}

export async function fetchMonsterData(url: string): Promise<Monster> {
    let source = "";
    let nameIdentifier = "";

    try {
        const urlObj = new URL(url);

        // 1. Check for standard hash format: https://5e.tools/bestiary.html#aarakocra_lox
        if (urlObj.hash && urlObj.hash.includes("_")) {
            const hashParts = urlObj.hash.substring(1).split("_"); // remove leading #
            source = hashParts.pop() || "";
            nameIdentifier = hashParts.join("_");
        }
        // 2. Check for path format: https://5e.tools/bestiary/aarakocra-spelljammer-lox.html
        else if (urlObj.pathname.includes(".html")) {
            const pathPart = urlObj.pathname.split("/").pop() || "";
            const nameWithoutExt = pathPart.replace(".html", "");
            const pathParts = nameWithoutExt.split("-");
            source = pathParts.pop() || "";
            nameIdentifier = pathParts.join("-");
        } else {
            throw new Error("Invalid 5e.tools URL format. Expected a hash (#name_source) or specific path.");
        }

        if (!source) {
            throw new Error("Could not extract book source from URL.");
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
        const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetNameSanitized = sanitize(nameIdentifier);

        let foundMonster = monsterList.find((m) =>
            sanitize(m.name) === targetNameSanitized ||
            targetNameSanitized.startsWith(sanitize(m.name)) ||
            sanitize(m.name).startsWith(targetNameSanitized)
        );

        // If exact name matching fails, fallback
        if (!foundMonster) {
            foundMonster = monsterList.find(m => sanitize(m.name).includes(targetNameSanitized.substring(0, 5)));
        }

        if (!foundMonster) {
            throw new Error(`Monster matching '${nameIdentifier}' not found in the source book data.`);
        }

        // Attach resolved token URL for the Quick Spawn feature
        if (foundMonster.hasToken) {
            foundMonster.tokenUrl = calculateTokenUrl(foundMonster.name, foundMonster.source);
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
