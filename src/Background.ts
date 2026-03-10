import OBR from "@owlbear-rodeo/sdk";

export const EXTENSION_ID = "com.ajuszt95.5etools";
export const METADATA_KEY = `${EXTENSION_ID}/monster`;
export const BUBBLES_METADATA_KEY = "com.owlbear-rodeo-bubbles-extension/metadata";

// Stat Bubbles Metadata IDs
export const BUBBLES_HEALTH = "health";
export const BUBBLES_MAX_HEALTH = "max health";
export const BUBBLES_TEMP_HEALTH = "temporary health";
export const BUBBLES_ARMOR_CLASS = "armor class";
export const BUBBLES_HIDE = "hide";
export const BUBBLES_NAME = "com.owlbear-rodeo-bubbles-extension/name";

export function initBackground() {
    console.log("Initializing background script...");
    OBR.onReady(async () => {
        const role = await OBR.player.getRole();
        console.log("Current player role:", role);

        if (role !== "GM") {
            console.log("Not a GM. Skipping menu registration.");
            return;
        }

        console.log("OBR Ready, registering context menu...");
        OBR.contextMenu.create({
            id: `${EXTENSION_ID}/context-menu`,
            icons: [
                {
                    icon: `${import.meta.env.BASE_URL}icon.svg`,
                    label: "5e Tools",
                    filter: {
                        every: [
                            { key: "layer", operator: "==", value: "CHARACTER" },
                            { key: "type", operator: "==", value: "IMAGE" },
                        ],
                    },
                },
            ],
            onClick(context) {
                const tokenId = context.items[0].id;
                const hasMonster = context.items[0].metadata[METADATA_KEY];

                OBR.popover.open({
                    id: hasMonster ? `${EXTENSION_ID}/view-popover` : `${EXTENSION_ID}/import-popover`,
                    url: hasMonster
                        ? `${import.meta.env.BASE_URL}#/view?id=${tokenId}`
                        : `${import.meta.env.BASE_URL}#/import?id=${tokenId}`,
                    height: hasMonster ? 600 : 300,
                    width: 350,
                });
            },
        });
    });
}
