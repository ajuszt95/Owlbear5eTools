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
    const { multiplier } = getMonsterDimensions(monster.size);

    // Get the center of the current screen in world coordinates
    const width = await OBR.viewport.getWidth();
    const height = await OBR.viewport.getHeight();
    const center = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });

    // Constants for internal image resolution
    const BASE_RESOLUTION = 300;

    const imageItem = buildImage(
        {
            url: monster.tokenUrl || "https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/token/blank.png",
            mime: "image/png",
            width: BASE_RESOLUTION,
            height: BASE_RESOLUTION,
        },
        {
            // OBR scale is SceneDPI / ItemDPI. 
            // To make an item X units wide: ItemDPI = SceneDPI / X.
            // But since OBR items are anchored Top-Left by default, 
            // using an offset of Half-Width/Half-Height anchors it at the Center.
            dpi: BASE_RESOLUTION / multiplier,
            offset: { x: BASE_RESOLUTION / 2, y: BASE_RESOLUTION / 2 }
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
