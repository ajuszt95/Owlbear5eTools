import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { METADATA_KEY, BUBBLES_METADATA_KEY, EXTENSION_ID } from "./Background";
import { render5etoolsText } from "./utils/renderer";

// Helper to render 5e.tools entries safely
const renderEntries = (entries: any[]) => {
    if (!entries || !Array.isArray(entries)) return null;
    return entries.map((e, i) => {
        if (typeof e === 'string') {
            return <p key={i} style={{ margin: "4px 0", lineHeight: "1.4" }}>{render5etoolsText(e)}</p>;
        }
        if (e.name && e.entries) {
            return (
                <div key={i} style={{ marginBottom: "8px" }}>
                    <strong>{render5etoolsText(e.name)}. </strong>
                    <span style={{ display: "inline" }}>{renderEntries(e.entries)}</span>
                </div>
            );
        }
        if (e.type === 'list') {
            return <ul key={i} style={{ margin: "4px 0", paddingLeft: "18px" }}>{e.items.map((it: any, j: number) => <li key={j} style={{ marginBottom: "2px" }}>{renderEntries([it])}</li>)}</ul>;
        }
        return null;
    });
};

const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

const AbilityTable = ({ monster }: { monster: any }) => {
    const abilities = ["str", "dex", "con", "int", "wis", "cha"];
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", textAlign: "center", borderTop: "1px solid #58180D", borderBottom: "1px solid #58180D", padding: "8px 0", margin: "8px 0" }}>
            {abilities.map(ab => (
                <div key={ab}>
                    <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px", color: "#58180D" }}>{ab}</div>
                    <div style={{ fontSize: "14px" }}>{monster[ab] || 10} ({getModifier(monster[ab] || 10)})</div>
                </div>
            ))}
        </div>
    );
};

const MetadataLine = ({ label, value }: { label: string, value: any }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    return (
        <p style={{ margin: "2px 0", fontSize: "13px" }}>
            <strong style={{ color: "#58180D" }}>{label}</strong> {value}
        </p>
    );
};

export default function ViewPopover() {
    const [monster, setMonster] = useState<any>(null);
    const [tokenId, setTokenId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const initView = async () => {
            OBR.onReady(async () => {
                try {
                    const hashParts = window.location.hash.split("?");
                    const query = hashParts.length > 1 ? hashParts[1] : "";
                    const urlParams = new URLSearchParams(query);
                    const tid = urlParams.get("id");

                    if (!tid) {
                        setError("No token ID provided.");
                        return;
                    }
                    setTokenId(tid);

                    const items = await OBR.scene.items.getItems([tid]);
                    if (items.length === 0) {
                        setError("Token not found.");
                        return;
                    }

                    const monsterMetadata = items[0].metadata[METADATA_KEY];
                    if (!monsterMetadata) {
                        setError("No data found. Try re-importing.");
                        return;
                    }

                    setMonster(monsterMetadata);
                } catch (err: any) {
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
                delete item.metadata[METADATA_KEY];
                delete item.metadata[BUBBLES_METADATA_KEY];
                delete item.metadata["com.owlbear-rodeo-bubbles-extension/name"];
                item.name = "Token";
            });
            await OBR.popover.close(`${EXTENSION_ID}/view-popover`);
        } catch (err: any) {
            setError(`Failed to remove: ${err.message}`);
        }
    };

    if (error) {
        return <div style={{ padding: "16px", color: "#800", background: "#fee", border: "1px solid #fcc", borderRadius: "8px" }}>
            <strong>Error:</strong> {error}
        </div>;
    }

    if (!monster) {
        return <div style={{ padding: "24px", textAlign: "center", color: "#666" }}>Loading (v1.2.3)...</div>;
    }

    // Helper expansions
    const sizeMap: any = { "T": "Tiny", "S": "Small", "M": "Medium", "L": "Large", "H": "Huge", "G": "Gargantuan" };
    const displaySize = sizeMap[monster.size?.[0]] || monster.size?.[0] || "Medium";
    const typeText = typeof monster.type === 'string' ? monster.type : (monster.type?.type || "creature");
    const alignText = monster.alignment ? (Array.isArray(monster.alignment) ? monster.alignment.join(", ") : monster.alignment.toString()) : "unaligned";

    const acText = Array.isArray(monster.ac) 
        ? monster.ac.map((a: any) => typeof a === 'object' ? `${a.ac}${a.from ? ` (${a.from.join(", ")})` : ""}` : a).join(", ")
        : (monster.ac || "10");

    const hpText = `${monster.hp?.average || "??"} ${monster.hp?.formula ? `(${monster.hp.formula})` : ""}`;
    
    const speedText = typeof monster.speed === 'string' ? monster.speed : Object.entries(monster.speed || {}).map(([k, v]) => `${k} ${typeof v === 'object' ? (v as any).number : v}ft.`).join(", ");

    const saves = monster.save ? Object.entries(monster.save).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(", ") : null;
    const skills = monster.skill ? Object.entries(monster.skill).map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`).join(", ") : null;
    const senses = monster.senses ? (Array.isArray(monster.senses) ? monster.senses.join(", ") : monster.senses) : null;
    const passivePerception = monster.passive || (skills?.toLowerCase().includes("perception") ? monster.skill.perception + 10 : 10);

    const crText = typeof monster.cr === 'string' ? monster.cr : (monster.cr?.cr || monster.cr);

    return (
        <div style={{ padding: "20px", fontFamily: "'Inter', sans-serif", color: "#333", background: "#fdf5e6", minHeight: "100vh", lineHeight: "1.5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #58180D", marginBottom: "8px", paddingBottom: "4px" }}>
                <h2 style={{ color: "#58180D", margin: 0, fontSize: "22px" }}>
                    {monster.sourceUrl ? (
                        <a href={monster.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{monster.name}</a>
                    ) : (
                        monster.name
                    )}
                </h2>
                <button onClick={handleRemove} style={{ padding: "4px 8px", fontSize: "11px", background: "#800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>Remove</button>
            </div>

            <div style={{ fontStyle: "italic", fontSize: "14px", marginBottom: "8px" }}>
                {displaySize} {typeText}, {alignText}
            </div>

            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />

            <MetadataLine label="Armor Class" value={`${acText}`} />
            <MetadataLine label="Hit Points" value={hpText} />
            <MetadataLine label="Speed" value={speedText} />

            <AbilityTable monster={monster} />

            <div style={{ marginBottom: "8px" }}>
                <MetadataLine label="Saving Throws" value={saves} />
                <MetadataLine label="Skills" value={skills} />
                <MetadataLine label="Senses" value={`${senses ? senses + ", " : ""}passive Perception ${passivePerception}`} />
                <MetadataLine label="Languages" value={Array.isArray(monster.languages) ? monster.languages.join(", ") : monster.languages} />
                <MetadataLine label="Challenge" value={`${crText} (${monster.cr?.xp || "??"} XP)`} />
            </div>

            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />

            {monster.trait && <div style={{ marginBottom: "12px" }}>{renderEntries(monster.trait)}</div>}

            {monster.action && (
                <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", fontSize: "18px", margin: "16px 0 8px" }}>Actions</h3>
                    {renderEntries(monster.action)}
                </div>
            )}

            {monster.legendary && (
                <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", fontSize: "18px", margin: "16px 0 8px" }}>Legendary Actions</h3>
                    {monster.legendaryGroup?.name && (
                        <p style={{ fontStyle: "italic", fontSize: "13px", marginBottom: "8px" }}>
                            The {monster.name} can take 3 legendary actions...
                        </p>
                    )}
                    {renderEntries(monster.legendary)}
                </div>
            )}

            {monster.lairActions && (
                <div style={{ marginBottom: "12px" }}>
                    <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", fontSize: "18px", margin: "16px 0 8px" }}>Lair Actions</h3>
                    {renderEntries(monster.lairActions)}
                </div>
            )}
        </div>
    );
}
