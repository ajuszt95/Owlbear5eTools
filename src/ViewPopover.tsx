import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { METADATA_KEY, BUBBLES_METADATA_KEY, EXTENSION_ID } from "./Background";

// Helper to render 5e.tools entries safely
const renderEntries = (entries: any[]) => {
    if (!entries || !Array.isArray(entries)) return null;
    return entries.map((e, i) => {
        if (typeof e === 'string') {
            // Simplify 5e.tools notation like {@dice 1d6} -> 1d6
            const text = e.replace(/{@\w+ ([^}]+)}/g, "$1");
            return <p key={i} style={{ margin: "4px 0" }}>{text}</p>;
        }
        if (e.name && e.entries) {
            return (
                <div key={i} style={{ marginBottom: "8px" }}>
                    <strong>{e.name}. </strong>
                    {renderEntries(e.entries)}
                </div>
            );
        }
        if (e.type === 'list') {
            return <ul key={i} style={{ margin: "4px 0", paddingLeft: "20px" }}>{e.items.map((it: any, j: number) => <li key={j}>{renderEntries([it])}</li>)}</ul>;
        }
        return null;
    });
};

export default function ViewPopover() {
    const [monster, setMonster] = useState<any>(null);
    const [tokenId, setTokenId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const initView = async () => {
            console.log("ViewPopover: Initializing...");
            OBR.onReady(async () => {
                try {
                    console.log("ViewPopover: OBR Ready");
                    const hashParts = window.location.hash.split("?");
                    const query = hashParts.length > 1 ? hashParts[1] : "";
                    const urlParams = new URLSearchParams(query);
                    const tid = urlParams.get("id");

                    console.log("ViewPopover: Hash:", window.location.hash);
                    console.log("ViewPopover: Token ID from hash:", tid);

                    if (!tid) {
                        setError("No token ID provided in the URL.");
                        return;
                    }
                    setTokenId(tid);

                    const items = await OBR.scene.items.getItems([tid]);
                    console.log("ViewPopover: Fetched items from scene:", items.length);

                    if (items.length === 0) {
                        setError(`Token not found in the current scene. (ID: ${tid})`);
                        return;
                    }

                    const monsterMetadata = items[0].metadata[METADATA_KEY];
                    console.log("ViewPopover: Monster metadata present:", !!monsterMetadata);

                    if (!monsterMetadata) {
                        console.log("ViewPopover: Full metadata keys:", Object.keys(items[0].metadata));
                        setError("No monster data found on this token. Try re-importing.");
                        return;
                    }

                    setMonster(monsterMetadata);
                } catch (err: any) {
                    console.error("ViewPopover: Error during initialization:", err);
                    setError(`Failed to load: ${err.message}`);
                }
            });
        };
        initView();
    }, []);

    const handleRemove = async () => {
        if (!tokenId) return;
        try {
            await OBR.scene.items.updateItems([tokenId], (items) => {
                const item = items[0];
                if (!item) return;

                // Clear monster metadata
                delete item.metadata[METADATA_KEY];

                // Clear Stat Bubbles metadata
                delete item.metadata[BUBBLES_METADATA_KEY];
                delete item.metadata["com.owlbear-rodeo-bubbles-extension/name"];

                // Reset name
                item.name = "Token";
            });
            console.log("Statblock removed from token:", tokenId);
            await OBR.popover.close(`${EXTENSION_ID}/view-popover`);
        } catch (err: any) {
            console.error("Failed to remove statblock:", err);
            setError(`Failed to remove: ${err.message}`);
        }
    };

    if (error) {
        return <div style={{ padding: "16px", fontFamily: "sans-serif", color: "#721c24", background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "4px" }}>
            <strong>Error:</strong> {error}
        </div>;
    }

    if (!monster) {
        return <div style={{ padding: "16px", fontFamily: "sans-serif" }}>Loading monster data (v1.1.3)...</div>;
    }

    let speedText = "30ft.";
    try {
        if (monster.speed && typeof monster.speed === 'object') {
            speedText = Object.entries(monster.speed)
                .map(([k, v]) => `${k} ${(v as any)?.number || v}ft.`)
                .join(", ");
        } else if (typeof monster.speed === 'string') {
            speedText = monster.speed;
        }
    } catch (e) {
        console.warn("Error parsing speed:", e);
    }

    let acText = "10";
    try {
        if (Array.isArray(monster.ac)) {
            acText = monster.ac.map((a: any) => (typeof a === 'object' ? (a.ac || a.xml || "??") : a)).join(", ");
        } else if (monster.ac) {
            acText = monster.ac.toString();
        }
    } catch (e) {
        console.warn("Error parsing AC:", e);
    }

    let alignText = "";
    try {
        if (Array.isArray(monster.alignment)) {
            alignText = monster.alignment.join(", ");
        } else if (monster.alignment) {
            alignText = monster.alignment.toString();
        }
    } catch (e) {
        console.warn("Error parsing alignment:", e);
    }

    const monsterType = typeof monster.type === 'object' ? (monster.type.type || JSON.stringify(monster.type)) : monster.type;

    return (
        <div style={{ padding: "16px", fontFamily: "sans-serif", color: "#333", background: "#fdf5e6", minHeight: "100vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #58180D", marginBottom: "4px", paddingBottom: "4px" }}>
                <h2 style={{ color: "#58180D", margin: 0 }}>{monster.name || "Unknown Monster"}</h2>
                <button
                    onClick={handleRemove}
                    style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        cursor: "pointer",
                        background: "#800",
                        color: "white",
                        border: "none",
                        borderRadius: "4px"
                    }}
                >
                    Remove Statblock
                </button>
            </div>
            <div style={{ fontStyle: "italic", marginBottom: "8px" }}>
                {monster.size || "?"} {monsterType || "Unknown Type"}{alignText ? `, ${alignText}` : ""}
            </div>
            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />
            <p style={{ margin: "4px 0" }}><strong>Armor Class</strong>: {acText}</p>
            <p style={{ margin: "4px 0" }}><strong>Hit Points</strong>: {monster.hp?.average || monster.hp || "??"} {monster.hp?.formula ? `(${monster.hp.formula})` : ""}</p>
            <p style={{ margin: "4px 0" }}><strong>Speed</strong>: {speedText}</p>
            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />

            {monster.trait && (
                <div style={{ marginBottom: "16px" }}>
                    {renderEntries(monster.trait)}
                </div>
            )}

            {monster.action && (
                <div style={{ marginBottom: "16px" }}>
                    <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", marginBottom: "8px" }}>Actions</h3>
                    {renderEntries(monster.action)}
                </div>
            )}

            {monster.legendary && (
                <div style={{ marginBottom: "16px" }}>
                    <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", marginBottom: "8px" }}>Legendary Actions</h3>
                    {renderEntries(monster.legendary)}
                </div>
            )}
        </div>
    );
}
