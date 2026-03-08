import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { METADATA_KEY } from "./Background";

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

    useEffect(() => {
        const fetchMonsterData = async () => {
            if (await OBR.isReady) {
                const urlParams = new URLSearchParams(window.location.hash.split("?")[1]);
                const tokenId = urlParams.get("id");
                if (tokenId) {
                    const items = await OBR.scene.items.getItems([tokenId]);
                    if (items.length > 0) {
                        setMonster(items[0].metadata[METADATA_KEY]);
                    }
                }
            }
        };
        fetchMonsterData();
    }, []);

    if (!monster) {
        return <div style={{ padding: "16px", fontFamily: "sans-serif" }}>Loading or no monster data found...</div>;
    }

    const speedText = monster.speed
        ? Object.entries(monster.speed).map(([k, v]) => `${k} ${(v as any).number || v}ft.`).join(", ")
        : "30ft.";

    let acText = "10";
    if (monster.ac && monster.ac.length > 0) {
        acText = monster.ac.map((a: any) => a.ac || a).join(", ");
    }

    let alignText = monster.alignment && Array.isArray(monster.alignment) ? monster.alignment.join("") : (monster.alignment || "");

    return (
        <div style={{ padding: "16px", fontFamily: "sans-serif", color: "#333", background: "#fdf5e6", minHeight: "100vh" }}>
            <h2 style={{ color: "#58180D", borderBottom: "2px solid #58180D", margin: "0 0 4px 0", paddingBottom: "4px" }}>{monster.name}</h2>
            <div style={{ fontStyle: "italic", marginBottom: "8px" }}>
                {monster.size?.charAt(0) || ""} {monster.type?.type || monster.type}{alignText ? `, ${alignText}` : ""}
            </div>
            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />
            <p style={{ margin: "4px 0" }}><strong>Armor Class</strong>: {acText}</p>
            <p style={{ margin: "4px 0" }}><strong>Hit Points</strong>: {monster.hp?.average || 10} {monster.hp?.formula ? `(${monster.hp.formula})` : ""}</p>
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
