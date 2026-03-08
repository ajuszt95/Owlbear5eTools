import OBR from "@owlbear-rodeo/sdk";

export const EXTENSION_ID = "com.ajuszt95.5etools";
export const METADATA_KEY = `${EXTENSION_ID}/monster`;

export function initBackground() {
    console.log("Initializing background script...");
    OBR.onReady(() => {
        console.log("OBR Ready, registering context menu...");
        OBR.contextMenu.create({
            id: `${EXTENSION_ID}/context-menu`,
            icons: [
                {
                    icon: `${import.meta.env.BASE_URL}icon.svg`,
                    label: "5e Tools",
                    filter: {
                        every: [{ key: "type", value: "IMAGE" }]
                    },
                },
            ],
            onClick: async (context) => {
                const item = context.items[0];
                if (!item) return;

                const hasMonsterData = !!item.metadata[METADATA_KEY];

                if (hasMonsterData) {
                    OBR.popover.open({
                        id: `${EXTENSION_ID}/view-popover`,
                        url: `${import.meta.env.BASE_URL}#/view?id=${item.id}`,
                        height: 600,
                        width: 400,
                    });
                } else {
                    OBR.popover.open({
                        id: `${EXTENSION_ID}/import-popover`,
                        url: `${import.meta.env.BASE_URL}#/import?id=${item.id}`,
                        height: 250,
                        width: 400,
                    });
                }
            },
        });
    });
}
