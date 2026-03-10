import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import { fetchMonsterData, extractAC, extractHP, getMonsterDimensions } from "./api";
import { METADATA_KEY, BUBBLES_METADATA_KEY, BUBBLES_NAME } from "./Background";

/**
 * Spawns a new monster token in the center of the player's viewport.
 * Automatically configures dimensions and Stat Bubbles metadata.
 */
export async function spawnMonster(url: string) {
    const monster = await fetchMonsterData(url);
    const hp = extractHP(monster);
    const ac = extractAC(monster);
    const dims = getMonsterDimensions(monster.size);

    // Get the center of the current screen in world coordinates
    const width = await OBR.viewport.getWidth();
    const height = await OBR.viewport.getHeight();
    const center = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });

    // buildImage properties:
    // 1. Image source property { url, mime }
    // 2. Grid property { width, height }
    const imageItem = buildImage(
        {
            url: monster.tokenUrl || "https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/token/blank.png",
            mime: "image/png",
            width: dims.width,
            height: dims.height,
        },
        {
            dpi: 150,
            offset: { x: 0, y: 0 }
        }
    )
        .position(center)
        .layer("CHARACTER")
        .name(monster.name)
        .metadata({
            [METADATA_KEY]: monster,
            [BUBBLES_METADATA_KEY]: {
                "health": hp,
                "max health": hp,
                "armor class": ac,
                "temporary health": 0,
                "hide": false
            },
            [BUBBLES_NAME]: monster.name
        })
        .build();

    await OBR.scene.items.addItems([imageItem]);
}
