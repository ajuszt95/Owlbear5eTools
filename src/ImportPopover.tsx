import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, METADATA_KEY, BUBBLES_METADATA_KEY, BUBBLES_NAME } from "./Background";
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

                // Update context menu item metadata
                item.metadata[METADATA_KEY] = monsterData;

                // Stat Bubbles Extension Integration
                const metadata = item.metadata as any;
                metadata[BUBBLES_METADATA_KEY] = {
                    ...(metadata[BUBBLES_METADATA_KEY] || {}),
                    "health": hp,
                    "max health": hp,
                    "armor class": ac,
                    "temporary health": 0,
                    "hide": false
                };

                // Sync name ONLY for Stat Bubbles metadata
                metadata[BUBBLES_NAME] = monsterData.name;

                item.metadata = metadata;
            });

            await OBR.popover.close(`${EXTENSION_ID}/import-popover`);

        } catch (err: any) {
            setError(err.message || "Failed to import.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            padding: "24px",
            fontFamily: "'Inter', sans-serif",
            color: "#333",
            background: "#fdf5e6",
            minHeight: "100%", // Changed from 100vh
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            boxSizing: "border-box"
        }}>
            <header style={{ marginBottom: "24px", textAlign: "center" }}>
                <h1 style={{
                    color: "#58180D",
                    fontSize: "24px",
                    margin: "0 0 8px 0",
                    fontWeight: 700,
                    letterSpacing: "-0.5px"
                }}>
                    Monster Import
                </h1>
                <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
                    Enter a 5e.tools Bestiary URL to sync stats.
                </p>
            </header>

            <div style={{
                background: "white",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(88, 24, 13, 0.1)",
                border: "1px solid #e0d0b0"
            }}>
                <div style={{ marginBottom: "16px" }}>
                    <label style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#58180D",
                        marginBottom: "6px",
                        textTransform: "uppercase"
                    }}>
                        5e.tools Bestiary URL
                    </label>
                    <input
                        type="text"
                        placeholder="https://5e.tools/bestiary.html#..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "12px",
                            boxSizing: "border-box",
                            border: "1px solid #ccc",
                            borderRadius: "8px",
                            fontSize: "14px",
                            outline: "none",
                            transition: "border-color 0.2s",
                            fontFamily: "inherit"
                        }}
                    />
                </div>

                {error && (
                    <div style={{
                        color: "#a00",
                        fontSize: "13px",
                        marginBottom: "16px",
                        padding: "8px",
                        background: "#fff0f0",
                        borderRadius: "6px",
                        border: "1px solid #fcc"
                    }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <button
                    onClick={handleImport}
                    disabled={loading || !url}
                    style={{
                        width: "100%",
                        padding: "14px",
                        cursor: (loading || !url) ? "not-allowed" : "pointer",
                        background: (loading || !url) ? "#ccc" : "#58180D",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "16px",
                        fontWeight: 600,
                        transition: "all 0.2s ease",
                        boxShadow: (loading || !url) ? "none" : "0 4px 8px rgba(88, 24, 13, 0.2)"
                    }}
                    onMouseOver={(e) => {
                        if (!loading && url) e.currentTarget.style.background = "#7a2212";
                    }}
                    onMouseOut={(e) => {
                        if (!loading && url) e.currentTarget.style.background = "#58180D";
                    }}
                >
                    {loading ? "Importing Data..." : "Import Monster"}
                </button>
            </div>

            <footer style={{ marginTop: "auto", paddingTop: "24px", textAlign: "center", fontSize: "11px", color: "#999" }}>
                <p>Version 1.4.1 | Connected to 5e.tools</p>
            </footer>
        </div>
    );
}
