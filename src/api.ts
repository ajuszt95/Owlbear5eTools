export interface Monster {
    name: string;
    source: string;
    hp?: { average?: number };
    ac?: Array<number | { ac: number }>;
    [key: string]: any; // full stat block
}

const GITHUB_MIRROR_BASE = "https://raw.githubusercontent.com/5etools-mirror-1/5etools-src/main/data/bestiary";

export async function fetchMonsterData(url: string): Promise<Monster> {
    let source = "";
    let nameIdentifier = "";

    try {
        const urlObj = new URL(url);

        // 1. Check for standard hash format: https://5e.tools/bestiary.html#aarakocra_lox
        if (urlObj.hash && urlObj.hash.includes("_")) {
            const parts = urlObj.hash.substring(1).split("_"); // remove leading #
            source = parts.pop() || "";
            nameIdentifier = parts.join("_");
        }
        // 2. Check for path format: https://5e.tools/bestiary/aarakocra-spelljammer-lox.html
        else if (urlObj.pathname.includes(".html")) {
            const pathPart = urlObj.pathname.split("/").pop() || "";
            const nameWithoutExt = pathPart.replace(".html", "");
            const parts = nameWithoutExt.split("-");
            source = parts.pop() || "";
            nameIdentifier = parts.join("-");
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
        // Name matching is tricky because the URL might have "aarakocra-spelljammer" or "aarakocra_lox"
        // while the JSON name is "Aarakocra (Spelljammer)" or "Aarakocra"
        // To cleanly match, we remove special characters and lowercase everything.
        const sanitize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

        const targetNameSanitized = sanitize(nameIdentifier);

        let foundMonster = monsterList.find((m) =>
            sanitize(m.name) === targetNameSanitized ||
            targetNameSanitized.startsWith(sanitize(m.name)) ||
            sanitize(m.name).startsWith(targetNameSanitized)
        );

        // If exact name matching fails, fallback to any monster in that source that closely resembles it
        if (!foundMonster) {
            foundMonster = monsterList.find(m => sanitize(m.name).includes(targetNameSanitized.substring(0, 5)));
        }

        if (!foundMonster) {
            throw new Error(`Monster matching '${nameIdentifier}' not found in the source book data.`);
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
    } else if (firstAC && typeof firstAC === "object" && typeof firstAC.ac === "number") {
        return firstAC.ac;
    }
    return 10;
}

export function extractHP(monster: Monster): number {
    if (monster.hp && typeof monster.hp.average === "number") {
        return monster.hp.average;
    }
    return 10; // Default HP if none found
}
