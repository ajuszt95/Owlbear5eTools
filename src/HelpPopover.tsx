import { useState, useEffect } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { fetchMonsterData } from "./api";
import { spawnMonster } from "./spawning";

export default function HelpPopover() {
    const [spawnUrl, setSpawnUrl] = useState("");
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
        try {
            const monster = await fetchMonsterData(trimUrl);
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

            await spawnMonster(trimUrl, actualWidth, actualHeight);
            setSuccess(true);
            setSpawnUrl(""); // clear input
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
                    v1.6.1
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
                    Spawn a new token directly from a 5e.tools Bestiary URL.
                </p>

                <div style={{ background: "#f8f9fa", padding: "12px", borderRadius: "8px", fontSize: "12px", color: "#666", marginBottom: "16px", borderLeft: "4px solid #58180D" }}>
                    <strong>Supported Links:</strong>
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: "18px", lineHeight: "1.4" }}>
                        <li>Standard: <code>bestiary.html#monster_source</code></li>
                        <li>Direct: <code>bestiary/monster-source.html</code></li>
                    </ul>
                </div>

                <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                    <input
                        type="text"
                        placeholder="https://5e.tools/bestiary.html#..."
                        value={spawnUrl}
                        onChange={(e) => setSpawnUrl(e.target.value)}
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
                        disabled={loading || !spawnUrl}
                        style={{
                            padding: "12px",
                            background: (loading || !spawnUrl) ? "#ccc" : "#58180D",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontWeight: 600,
                            cursor: (loading || !spawnUrl) ? "not-allowed" : "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        {loading ? "Spawning..." : "Spawn Token"}
                    </button>
                </div>

                {error && (
                    <div style={{ marginTop: "12px", color: "#a00", fontSize: "12px", padding: "8px", background: "#fff0f0", borderRadius: "6px", border: "1px solid #fcc" }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}
                {success && (
                    <div style={{ marginTop: "12px", color: "#060", fontSize: "12px", padding: "8px", background: "#f0fff0", borderRadius: "6px", border: "1px solid #cfc" }}>
                        Token spawned successfully at your view center!
                    </div>
                )}
            </section>

            <section style={{ marginBottom: "24px" }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>How to Sync Existing Tokens</h3>
                <ol style={{ paddingLeft: "24px", margin: 0, fontSize: "14px" }}>
                    <li style={{ marginBottom: "8px" }}><strong>Right-Click</strong> any character token on the map.</li>
                    <li style={{ marginBottom: "8px" }}>Select <strong>5e Tools</strong> from the context menu.</li>
                    <li>Paste the URL and click <strong>Import Monster</strong>.</li>
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
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Removing a Statblock</h3>
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
                <span style={{ fontWeight: 600, color: "#58180D" }}>v1.6.1</span>
            </footer>
        </div>
    );
}
