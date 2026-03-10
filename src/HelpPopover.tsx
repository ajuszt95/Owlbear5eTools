import { useState } from "react";
import { spawnMonster } from "./spawning";

export default function HelpPopover() {
    const [spawnUrl, setSpawnUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSpawn = async () => {
        setLoading(true);
        setError("");
        setSuccess(false);
        try {
            await spawnMonster(spawnUrl);
            setSuccess(true);
            setSpawnUrl(""); // clear input
        } catch (err: any) {
            setError(err.message || "Failed to spawn token.");
        } finally {
            setLoading(false);
        }
    };

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
                    DM Toolbox
                </h2>
                <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "14px", fontWeight: 500 }}>
                    5e.tools Integration v1.1.1
                </p>
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
                    Open the 5e Tools view on a token and click <strong>"Remove Statblock"</strong> to reset all linked data.
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
                <span style={{ fontWeight: 600, color: "#58180D" }}>v1.1.0</span>
            </footer>
        </div>
    );
}
