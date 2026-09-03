import { useState, useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { fetchMonsterData, fetchMonsterByIdentity } from "./api";
import { spawnMonster, spawnMonsterByIdentity } from "./spawning";
import MonsterSearchInput from "./MonsterSearchInput";
import type { MonsterIndexEntry } from "./monsterIndex";
import { formatMonsterEntrySubtitle } from "./monsterIndex";
import { APP_VERSION } from "./version";

export default function HelpPopover() {
    const [spawnUrl, setSpawnUrl] = useState("");
    const [selectedEntry, setSelectedEntry] = useState<MonsterIndexEntry | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        OBR.onReady(async () => {
            const r = await OBR.player.getRole();
            setRole(r);
        });
    }, []);

    const handleSpawn = async () => {
        setLoading(true);
        setError("");
        setSuccess(false);
        const trimUrl = spawnUrl.trim();
        const picked = selectedEntry;
        try {
            const monster = picked
                ? await fetchMonsterByIdentity(picked.n, picked.s)
                : await fetchMonsterData(trimUrl);
            const tokenUrl = monster.tokenUrl || "https://5e.tools/img/token/blank.png";

            // Pre-fetch image dimensions for accurate DPI calculation in OBR
            const img = new Image();
            img.src = tokenUrl;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error("Failed to load token image dimensions."));
                // Timeout after 5s
                setTimeout(() => reject(new Error("Image dimension fetch timed out.")), 5000);
            });

            const actualWidth = img.naturalWidth || 300;
            const actualHeight = img.naturalHeight || 300;

            if (picked) {
                await spawnMonsterByIdentity(picked.n, picked.s, actualWidth, actualHeight);
            } else {
                await spawnMonster(trimUrl, actualWidth, actualHeight);
            }
            setSuccess(true);
            setSpawnUrl(""); // clear input
            setSelectedEntry(null);
        } catch (err: any) {
            setError(err.message || "Failed to spawn token.");
        } finally {
            setLoading(false);
        }
    };

    if (role === null) {
        return (
            <div style={{ padding: "32px", fontFamily: "'Inter', sans-serif", color: "#666", background: "#fdf5e6", minHeight: "100vh", textAlign: "center" }}>
                Loading...
            </div>
        );
    }

    if (role !== "GM") {
        return (
            <div style={{
                padding: "32px",
                fontFamily: "'Inter', sans-serif",
                color: "#333",
                background: "#fdf5e6",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center"
            }}>
                <h2 style={{ color: "#58180D", marginBottom: "16px" }}>Restricted Access</h2>
                <p style={{ fontSize: "16px", fontStyle: "italic" }}>
                    "Move along, this extension is for the Dungeon Master..."
                </p>
                <div style={{ marginTop: "40px", fontSize: "11px", color: "#999" }}>
                    v{APP_VERSION}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            padding: "32px",
            fontFamily: "'Inter', sans-serif",
            color: "#333",
            background: "#fdf5e6",
            minHeight: "100vh",
            lineHeight: "1.6",
            boxSizing: "border-box"
        }}>
            <header style={{ marginBottom: "32px", borderBottom: "3px solid #58180D", paddingBottom: "12px" }}>
                <h2 style={{
                    color: "#58180D",
                    margin: 0,
                    fontSize: "28px",
                    fontWeight: 800,
                    letterSpacing: "-0.5px"
                }}>
                    5e.tools Integration
                </h2>
            </header>

            {/* QUICK SPAWN SECTION */}
            <section style={{
                marginBottom: "32px",
                padding: "20px",
                background: "white",
                borderRadius: "16px",
                boxShadow: "0 8px 24px rgba(88, 24, 13, 0.12)",
                border: "1px solid #e0d0b0"
            }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>Quick Token Spawn</h3>
                <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
                    Search for a monster, or spawn directly from a 5e.tools Bestiary URL.
                </p>

                <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "8px", fontSize: "12px", color: "#666", marginBottom: "16px", borderLeft: "4px solid #58180D" }}>
                    <strong>Supported Links:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px", lineHeight: "1.4" }}>
                        <li>Standard: <code>bestiary.html#monster_source</code></li>
                        <li>Direct: <code>bestiary/monster-source.html</code></li>
                        <li>Shared: <code>bestiary.html?source=BOOK&hash=...</code></li>
                    </ul>
                </div>

                <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#58180D", textTransform: "uppercase" }}>
                        Search monsters
                    </label>
                    <MonsterSearchInput
                        id="quick-spawn-search"
                        placeholder="Type a monster name… (e.g. goblin)"
                        onSelect={(entry) => {
                            setSelectedEntry(entry);
                            setSpawnUrl("");
                            setError("");
                            setSuccess(false);
                        }}
                    />
                    {selectedEntry && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "8px 12px", background: "rgba(88, 24, 13, 0.06)", border: "1px solid #e0d0b0", borderRadius: "8px", fontSize: "13px" }}>
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
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#58180D", textTransform: "uppercase", marginTop: "4px" }}>
                        Or paste a 5e.tools URL
                    </label>
                    <input
                        type="text"
                        placeholder="https://5e.tools/bestiary.html#..."
                        value={spawnUrl}
                        onChange={(e) => {
                            setSpawnUrl(e.target.value);
                            setSelectedEntry(null);
                        }}
                        style={{
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #ccc",
                            fontSize: "14px",
                            fontFamily: "inherit",
                            outline: "none"
                        }}
                    />
                    <button
                        onClick={handleSpawn}
                        disabled={loading || (!spawnUrl && !selectedEntry)}
                        style={{
                            padding: "12px",
                            background: (loading || (!spawnUrl && !selectedEntry)) ? "#ccc" : "#58180D",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: (loading || (!spawnUrl && !selectedEntry)) ? "not-allowed" : "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        {loading ? "Spawning…" : "Spawn Token"}
                    </button>
                </div>

                {error && (
                    <div style={{ marginTop: "12px", color: "#a00", fontSize: "12px", padding: "8px", background: "#fff0f0", borderRadius: "6px", border: "1px solid #fcc" }}>
                        <strong>Error:</strong> {error}
                        <div style={{ marginTop: "4px", color: "#666" }}>
                            Tip: pick the monster from search above, or double-check the URL and retry.
                        </div>
                    </div>
                )}
                {success && (
                    <div style={{ marginTop: "12px", color: "#060", fontSize: "12px", padding: "8px", background: "#f0fff0", borderRadius: "6px", border: "1px solid #cfc" }}>
                        Token spawned!
                    </div>
                )}
            </section>

            <section style={{ marginBottom: "24px" }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>How to Sync Existing Tokens</h3>
                <ol style={{ paddingLeft: "24px", margin: 0, fontSize: "14px" }}>
                    <li style={{ marginBottom: "8px" }}><strong>Right-Click</strong> any character token on the map.</li>
                    <li style={{ marginBottom: "8px" }}>Select <strong>5e Tools</strong> from the context menu.</li>
                    <li>Paste the URL and click <strong>Import Monster</strong> — or search for the monster by name.</li>
                </ol>
            </section>

            <section style={{
                marginBottom: "24px",
                padding: "16px",
                background: "rgba(88, 24, 13, 0.05)",
                borderRadius: "12px",
                border: "1px solid rgba(88, 24, 13, 0.1)"
            }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Stat Bubbles Integration</h3>
                <p style={{ margin: 0, fontSize: "14px" }}>
                    If you use <strong>"Stat Bubbles for D&D"</strong>, stats (HP/AC) will automatically sync to your token.
                    <br /><br />
                    <em>Syncing existing tokens will <strong>not</strong> overwrite your custom token name.</em>
                </p>
            </section>

            <section style={{ marginBottom: "24px" }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Removing a Stat Block</h3>
                <p style={{ margin: 0, fontSize: "14px" }}>
                    Open the 5e Tools view on a token and click <strong>"Remove"</strong> to reset all linked data.
                </p>
            </section>

            <footer style={{
                marginTop: "40px",
                fontSize: "12px",
                borderTop: "1px solid #e0d0b0",
                paddingTop: "16px",
                color: "#999",
                display: "flex",
                justifyContent: "space-between"
            }}>
                <span>Created by ajuszt95</span>
                <span style={{ fontWeight: 600, color: "#58180D" }}>v{APP_VERSION}</span>
            </footer>
        </div>
    );
}
