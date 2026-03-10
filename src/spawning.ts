import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { fetchMonsterData, extractAC, extractHP, getMonsterDimensions } from "./api";
import { METADATA_KEY, BUBBLES_METADATA_KEY } from "./Background";

/**
 * Spawns a new monster token in the center of the player's viewport.
 * Automatically configures dimensions and Stat Bubbles metadata.
 */
export async function spawnMonster(url: string, itemWidth: number, itemHeight: number) {
    const monster = await fetchMonsterData(url);
    const hp = extractHP(monster);
    const ac = extractAC(monster);
    const { multiplier } = getMonsterDimensions(monster.size);
    const gridDpi = await OBR.scene.grid.getDpi();

    // Get the center of the current screen in world coordinates
    const width = await OBR.viewport.getWidth();
    const height = await OBR.viewport.getHeight();
    const viewCenter = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });

    // Calculate top-left based on world size to ensure it's centered
    const worldSize = multiplier * gridDpi;
    const topLeft = {
        x: viewCenter.x - worldSize / 2,
        y: viewCenter.y - worldSize / 2
    };

    // PRECISION CALIBRATION:
    // We set the DPI such that the native units of the item match our target multiplier.
    // nativeUnits = pixels / itemDpi  =>  itemDpi = pixels / targetUnits
    const itemDpi = itemWidth / multiplier;

    const imageItem = buildImage(
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
        .position(topLeft)
        // No .scale() - we rely on native sizing for extension compatibility
        .layer("CHARACTER")
        .name(monster.name)
        .metadata({
            [METADATA_KEY]: monster,
            [BUBBLES_METADATA_KEY]: {
                version: "1.0.0",
                stats: {
                    hp: {
                        value: hp,
                        max: hp,
                    },
                    ac: {
                        value: ac,
                    },
                },
            },
            // Direct Stat Bubbles support
            "com.owlbear-rodeo-bubbles-extension/name": monster.name,
        })
        .build();

    await OBR.scene.items.addItems([imageItem]);
}
