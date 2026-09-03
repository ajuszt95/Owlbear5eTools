import { useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, METADATA_KEY, BUBBLES_METADATA_KEY, BUBBLES_NAME } from "./Background";
import { fetchMonsterData, fetchMonsterByIdentity, extractAC, extractHP } from "./api";
import MonsterSearchInput from "./MonsterSearchInput";
import type { MonsterIndexEntry } from "./monsterIndex";
import { formatMonsterEntrySubtitle } from "./monsterIndex";
import { APP_VERSION } from "./version";

export default function ImportPopover() {
    const [url, setUrl] = useState("");
    const [selectedEntry, setSelectedEntry] = useState<MonsterIndexEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleImport = async () => {
        setLoading(true);
        setError("");
        console.log("Starting import for URL:", url, "selected:", selectedEntry);

        try {
            const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
            const tokenId = urlParams.get("id");

            if (!tokenId) {
                throw new Error("No token selected. Right-click a token and choose 5e Tools to try again.");
            }

            const monsterData = selectedEntry
                ? await fetchMonsterByIdentity(selectedEntry.n, selectedEntry.s)
                : await fetchMonsterData(url);
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
                metadata[BUBBLES_NAME] = monsterData._displayName || monsterData.name;

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
                    Search for a monster, or enter a 5e.tools Bestiary URL to sync stats.
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
                        Search monsters
                    </label>
                    <MonsterSearchInput
                        id="import-search"
                        placeholder="Type a monster name… (e.g. goblin)"
                        onSelect={(entry) => {
                            setSelectedEntry(entry);
                            setUrl("");
                            setError("");
                        }}
                    />
                    {selectedEntry && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "8px", padding: "8px 12px", background: "rgba(88, 24, 13, 0.06)", border: "1px solid #e0d0b0", borderRadius: "8px", fontSize: "13px" }}>
                            <span>
                                <strong style={{ color: "#58180D" }}>{selectedEntry.n}</strong>
                                <span style={{ color: "#666" }}> · {formatMonsterEntrySubtitle(selectedEntry)}</span>
                            </span>
                            <button
                                onClick={() => setSelectedEntry(null)}
                                style={{ padding: "2px 8px", fontSize: "12px", background: "transparent", color: "#58180D", border: "1px solid #58180D", borderRadius: "6px", cursor: "pointer" }}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ marginBottom: "16px" }}>
                    <label style={{
                        display: "block",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#58180D",
                        marginBottom: "6px",
                        textTransform: "uppercase"
                    }}>
                        Or paste a 5e.tools URL
                    </label>
                    <input
                        type="text"
                        placeholder="https://5e.tools/bestiary.html#..."
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            setSelectedEntry(null);
                        }}
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
                        <div style={{ marginTop: "4px", color: "#666" }}>
                            Tip: pick the monster from search, or double-check the URL and retry.
                        </div>
                    </div>
                )}

                <button
                    onClick={handleImport}
                    disabled={loading || (!url && !selectedEntry)}
                    style={{
                        width: "100%",
                        padding: "14px",
                        cursor: (loading || (!url && !selectedEntry)) ? "not-allowed" : "pointer",
                        background: (loading || (!url && !selectedEntry)) ? "#ccc" : "#58180D",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "16px",
                        fontWeight: 600,
                        transition: "all 0.2s ease",
                        boxShadow: (loading || (!url && !selectedEntry)) ? "none" : "0 4px 8px rgba(88, 24, 13, 0.2)"
                    }}
                    onMouseOver={(e) => {
                        if (!loading && (url || selectedEntry)) e.currentTarget.style.background = "#7a2212";
                    }}
                    onMouseOut={(e) => {
                        if (!loading && (url || selectedEntry)) e.currentTarget.style.background = "#58180D";
                    }}
                >
                    {loading ? "Importing Data…" : "Import Monster"}
                </button>
            </div>

            <footer style={{ marginTop: "auto", paddingTop: "24px", textAlign: "center", fontSize: "11px", color: "#999" }}>
                <p>Version {APP_VERSION} | Connected to 5e.tools</p>
            </footer>
        </div>
    );
}
