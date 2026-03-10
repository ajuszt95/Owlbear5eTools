import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, METADATA_KEY, BUBBLES_METADATA_KEY } from "./Background";
import { fetchMonsterData, extractAC, extractHP } from "./api";

export default function ImportPopover() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleImport = async () => {
        setLoading(true);
        setError("");
        console.log("Starting import for URL:", url);

        try {
            const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
            const tokenId = urlParams.get("id");

            if (!tokenId) {
                throw new Error("No token selected.");
            }

            const monsterData = await fetchMonsterData(url);
            const hp = extractHP(monsterData);
            const ac = extractAC(monsterData);

            console.log("Fetched monster data:", monsterData.name, "HP:", hp, "AC:", ac);

            await OBR.scene.items.updateItems([tokenId], (items) => {
                const item = items[0];
                if (!item) return;

                item.name = monsterData.name;

                // Owlbear Rodeo standard text attachment for Token stats
                const imgItem = item as any;
                if (!imgItem.text) {
                    imgItem.text = { plainText: "", richText: [], type: "PLAIN", style: { padding: 4, backgroundAlpha: 0.5 } as any };
                }
                imgItem.text.plainText = `${monsterData.name}\nHP: ${hp} | AC: ${ac}`;

                item.metadata[METADATA_KEY] = monsterData;

                // Stat Bubbles Extension Integration
                const metadata = item.metadata as any;
                metadata[BUBBLES_METADATA_KEY] = {
                    ...(metadata[BUBBLES_METADATA_KEY] || {}),
                    "health": hp,
                    "max health": hp, // Initial current HP as max HP
                    "armor class": ac,
                    "temporary health": 0,
                    "hide": false
                };

                // Set name for Stat Bubbles as well
                metadata["com.owlbear-rodeo-bubbles-extension/name"] = monsterData.name;

                item.metadata = metadata;
            });

            // Close the popover automatically after successful import
            await OBR.popover.close(`${EXTENSION_ID}/import-popover`);

        } catch (err: any) {
            setError(err.message || "Failed to import.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: "16px", fontFamily: "sans-serif" }}>
            <h3>Import 5e.tools Monster</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                    type="text"
                    placeholder="https://5e.tools/bestiary/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                />
                {error && <div style={{ color: "red", fontSize: "14px" }}>{error}</div>}
                <button
                    onClick={handleImport}
                    disabled={loading || !url}
                    style={{ padding: "8px 16px", cursor: "pointer", background: "#4CAF50", color: "white", border: "none", borderRadius: "4px" }}
                >
                    {loading ? "Importing..." : "Import"}
                </button>
            </div>
        </div>
    );
}
