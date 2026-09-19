import OBR, { buildImage, type Item } from "@owlbear-rodeo/sdk";
import { fetchMonsterData, fetchMonsterByIdentity, extractAC, extractHP, getMonsterDimensions, type Monster } from "./api";
import { METADATA_KEY, BUBBLES_METADATA_KEY, BUBBLES_NAME } from "./Background";

export type Formation = "row" | "grid" | "column";

/** Hard cap: perf + accidental 100-token protection. */
export const MAX_SPAWN_COUNT = 12;

export function clampSpawnCount(count: number): number {
    if (!Number.isFinite(count)) {
        return 1;
    }
    return Math.min(MAX_SPAWN_COUNT, Math.max(1, Math.floor(count)));
}

/**
 * Pure formation math: returns top-left corners for `count` tokens, arranged
 * as a block centered on `center`. Tokens are `worldSize` squares with `gap`
 * between them. Grid fills row-major with columns = ceil(sqrt(count)).
 */
export function computeFormationPositions(
    center: { x: number; y: number },
    worldSize: number,
    gap: number,
    count: number,
    formation: Formation
): { x: number; y: number }[] {
    const step = worldSize + gap;
    if (formation === "row") {
        const startX = center.x - (count * worldSize + (count - 1) * gap) / 2;
        const y = center.y - worldSize / 2;
        return Array.from({ length: count }, (_, i) => ({ x: startX + i * step, y }));
    }
    if (formation === "column") {
        const x = center.x - worldSize / 2;
        const startY = center.y - (count * worldSize + (count - 1) * gap) / 2;
        return Array.from({ length: count }, (_, i) => ({ x, y: startY + i * step }));
    }
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const startX = center.x - (cols * worldSize + (cols - 1) * gap) / 2;
    const startY = center.y - (rows * worldSize + (rows - 1) * gap) / 2;
    return Array.from({ length: count }, (_, i) => ({
        x: startX + (i % cols) * step,
        y: startY + Math.floor(i / cols) * step,
    }));
}

/**
 * Pure token builder: sizes via DPI (never .scale()) and writes both monster
 * + Stat Bubbles metadata at once. The monster is deep-cloned per token so
 * siblings never share mutable state.
 */
export function buildMonsterImageItem(
    monster: Monster,
    position: { x: number; y: number },
    itemWidth: number,
    itemHeight: number,
    multiplier: number,
    displayName: string
): Item {
    const hp = extractHP(monster);
    const ac = extractAC(monster);

    // PRECISION CALIBRATION:
    // We set the DPI such that the native units of the item match our target multiplier.
    // nativeUnits = pixels / itemDpi  =>  itemDpi = pixels / targetUnits
    const itemDpi = itemWidth / multiplier;

    return buildImage(
        {
            url: monster.tokenUrl || "https://5e.tools/img/token/blank.png",
            mime: "image/png",
            width: itemWidth,
            height: itemHeight,
        },
        {
            dpi: itemDpi,
            offset: { x: 0, y: 0 }
        }
    )
        .position(position)
        // No .scale() - we rely on native sizing for extension compatibility
        .layer("CHARACTER")
        .name(displayName)
        .metadata({
            [METADATA_KEY]: structuredClone(monster),
            [BUBBLES_METADATA_KEY]: {
                "health": hp,
                "max health": hp,
                "armor class": ac,
                "temporary health": 0,
                "hide": false
            },
            [BUBBLES_NAME]: displayName,
        })
        .build();
}

/**
 * Shared token-spawning core: sizes via DPI (never .scale()), arranges tokens
 * in a formation centered on the viewport, and writes both monster + Stat
 * Bubbles metadata at once.
 *
 * Takes an already-fetched monster so callers that probed the token image
 * (or picked from search) don't re-fetch the same book JSON.
 *
 * Returns the new item ids. All tokens go out in a single `addItems` call;
 * the OBR SDK documents no atomicity, so a throw means the reported state
 * stands - callers surface the error without attempting cleanup.
 */
export async function spawnMonstersFromData(
    monster: Monster,
    itemWidth: number,
    itemHeight: number,
    count: number = 1,
    formation: Formation = "row"
): Promise<string[]> {
    const n = clampSpawnCount(count);
    const { multiplier } = getMonsterDimensions(monster.size);
    const gridDpi = await OBR.scene.grid.getDpi();

    // Get the center of the current screen in world coordinates
    const width = await OBR.viewport.getWidth();
    const height = await OBR.viewport.getHeight();
    const viewCenter = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });

    const worldSize = multiplier * gridDpi;
    const gap = worldSize * 0.1;
    const positions = computeFormationPositions(viewCenter, worldSize, gap, n, formation);

    const baseName = monster._displayName || monster.name;
    const items = positions.map((position, i) =>
        buildMonsterImageItem(
            monster,
            position,
            itemWidth,
            itemHeight,
            multiplier,
            n === 1 ? baseName : `${baseName} ${i + 1}`
        )
    );

    await OBR.scene.items.addItems(items);
    return items.map((item) => item.id);
}

/**
 * Single-spawn equivalent of spawnMonstersFromData (count 1 keeps the bare
 * name - no behavior change).
 */
export async function spawnMonsterFromData(monster: Monster, itemWidth: number, itemHeight: number) {
    await spawnMonstersFromData(monster, itemWidth, itemHeight, 1, "row");
}

/**
 * Spawns new monster tokens in the center of the player's viewport.
 * Automatically configures dimensions and Stat Bubbles metadata.
 */
export async function spawnMonster(url: string, itemWidth: number, itemHeight: number) {
    const monster = await fetchMonsterData(url);
    await spawnMonstersFromData(monster, itemWidth, itemHeight, 1, "row");
}

/**
 * Multi-spawn by URL: quantity + formation wrapper around spawnMonster.
 */
export async function spawnMonsters(
    url: string,
    itemWidth: number,
    itemHeight: number,
    count: number = 1,
    formation: Formation = "row"
): Promise<string[]> {
    const monster = await fetchMonsterData(url);
    return spawnMonstersFromData(monster, itemWidth, itemHeight, count, formation);
}

/**
 * Search-pick equivalent of spawnMonster: spawns by exact
 * {name, source} identity with the same sizing + Bubbles sync.
 */
export async function spawnMonsterByIdentity(name: string, source: string, itemWidth: number, itemHeight: number) {
    const monster = await fetchMonsterByIdentity(name, source);
    await spawnMonsterFromData(monster, itemWidth, itemHeight);
}
