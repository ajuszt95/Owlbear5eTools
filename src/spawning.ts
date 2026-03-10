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
    const gridDpi = await OBR.scene.grid.getDpi();

    // Get the center of the current screen in world coordinates
    const width = await OBR.viewport.getWidth();
    const height = await OBR.viewport.getHeight();
    const viewCenter = await OBR.viewport.inverseTransformPoint({ x: width / 2, y: height / 2 });

    // Constants for internal image resolution
    const BASE_RESOLUTION = 300;

    // Calculate top-left based on world size to ensure it's centered
    const worldSize = multiplier * gridDpi;
    const topLeft = {
        x: viewCenter.x - worldSize / 2,
        y: viewCenter.y - worldSize / 2
    };

    const imageItem = buildImage(
        {
            url: monster.tokenUrl || "https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/token/blank.png",
            mime: "image/png",
            width: BASE_RESOLUTION,
            height: BASE_RESOLUTION,
        },
        {
            // dpi = pixels per grid unit. 
            // Setting it to the same as BASE_RESOLUTION makes the base size 1x1.
            dpi: BASE_RESOLUTION,
            offset: { x: 0, y: 0 }
        }
    )
        .position(topLeft)
        .scale({ x: multiplier, y: multiplier })
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
