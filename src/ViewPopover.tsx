import { useEffect, useState, useRef } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { METADATA_KEY, BUBBLES_METADATA_KEY, EXTENSION_ID, INITIATIVE_METADATA_KEY } from "./Background";
import { render5etoolsText, render5etoolsPlainText } from "./utils/renderer";
import { evaluateRoll } from "./utils/diceRoller";
import { dexModifier, initiativeNotation, initiativeTiebreakTotal, rollInitiativeBasic, writeInitiative } from "./initiative";
import { APP_VERSION } from "./version";

// ────────────────────────────────────────────────────────────────────────────
// Constants & lookup tables
// ────────────────────────────────────────────────────────────────────────────

const SIZE_MAP: Record<string, string> = {
    T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
};

const ALIGNMENT_MAP: Record<string, string> = {
    L: "Lawful", C: "Chaotic", NX: "Any Non-Lawful", NY: "Any Non-Good",
    N: "Neutral", G: "Good", E: "Evil",
    U: "Unaligned", A: "Any alignment",
};

/** CR → XP lookup per 5e rules */
const CR_XP: Record<string, string> = {
    "0": "0", "1/8": "25", "1/4": "50", "1/2": "100",
    "1": "200", "2": "450", "3": "700", "4": "1,100", "5": "1,800",
    "6": "2,300", "7": "2,900", "8": "3,900", "9": "5,000", "10": "5,900",
    "11": "7,200", "12": "8,400", "13": "10,000", "14": "11,500", "15": "13,000",
    "16": "15,000", "17": "18,000", "18": "20,000", "19": "22,000", "20": "25,000",
    "21": "33,000", "22": "41,000", "23": "50,000", "24": "62,000", "25": "75,000",
    "26": "90,000", "27": "105,000", "28": "120,000", "29": "135,000", "30": "155,000",
};

function getProficiencyBonus(cr: string): string {
    const n = cr === "1/8" ? 0.125 : cr === "1/4" ? 0.25 : cr === "1/2" ? 0.5 : parseFloat(cr);
    if (isNaN(n)) return "+2";
    if (n < 5) return "+2";
    if (n < 9) return "+3";
    if (n < 13) return "+4";
    if (n < 17) return "+5";
    if (n < 21) return "+6";
    if (n < 25) return "+7";
    if (n < 29) return "+8";
    return "+9";
}

// ────────────────────────────────────────────────────────────────────────────
// Data Formatters
// ────────────────────────────────────────────────────────────────────────────

function formatAlignment(alignment: any): string {
    if (!alignment) return "";
    const codes: string[] = Array.isArray(alignment) ? alignment : [alignment];
    const decoded = codes.map((a: any) => {
        if (typeof a === "string") {
            // "A" alone = Any alignment
            if (a === "A") return "Any alignment";
            // "U" = Unaligned
            if (a === "U") return "Unaligned";
            // "NX" = any non-lawful, "NY" = any non-good
            if (a === "NX") return "Any Non-Lawful alignment";
            if (a === "NY") return "Any Non-Good alignment";
            return ALIGNMENT_MAP[a] || a;
        }
        // Alignment object (e.g. {alignment: ["N","G"], chance: 50})
        if (typeof a === "object" && a.alignment) {
            return formatAlignment(a.alignment);
        }
        return "";
    });
    // Combine: e.g. ["Lawful", "Evil"] → "Lawful Evil"
    return decoded.filter(Boolean).join(" ");
}

function formatType(type: any): string {
    if (!type) return "";
    if (typeof type === "string") return type;
    const base: string = type.type || "";
    const tags: string[] = type.tags || [];
    if (tags.length === 0) return base;
    return `${base} (${tags.join(", ")})`;
}

function formatSpeed(speed: any): string {
    if (!speed) return "";
    if (typeof speed === "string") return speed;
    const parts: string[] = [];
    for (const [k, v] of Object.entries(speed)) {
        // Skip metadata keys
        if (k === "canHover") continue;
        if (v === false) continue;
        
        let display = "";
        if (typeof v === "number") {
            display = `${v} ft.`;
        } else if (typeof v === "object") {
            const obj = v as any;
            const num = obj.number ?? 0;
            const cond = obj.condition ? ` ${render5etoolsPlainText(obj.condition)}` : "";
            display = `${num} ft.${cond}`;
        } else {
            display = `${v}`;
        }
        
        if (k === "walk") {
            parts.unshift(display); // walk first, unlabeled
        } else {
            parts.push(`${k} ${display}`);
        }
    }
    return parts.join(", ");
}

function formatAC(ac: any[]): string {
    if (!ac || ac.length === 0) return "10";
    return ac.map((a: any) => {
        if (typeof a === "number") return `${a}`;
        if (typeof a === "object") {
            const base = a.ac ?? "";
            const condition = a.condition ? ` ${render5etoolsPlainText(a.condition)}` : "";
            if (a.from && a.from.length > 0) {
                const fromText = a.from.map((f: string) => render5etoolsPlainText(f)).join(", ");
                return `${base} (${fromText})${condition}`;
            }
            return `${base}${condition}`;
        }
        return `${a}`;
    }).join(", ");
}

/**
 * Formats damage immunity/resistance/vulnerability arrays.
 * Entries can be strings or objects like:
 * { immune: ["bludgeoning","piercing","slashing"], note: "from nonmagical attacks", cond: true }
 */
function formatDamageList(list: any[]): string {
    if (!list || list.length === 0) return "";
    return list.map((item: any) => {
        if (typeof item === "string") return item;
        if (typeof item === "object") {
            // Could have: immune/resist/vulnerable key + note
            const damageTypes: string[] = item.immune || item.resist || item.vulnerable || [];
            const note: string = item.note ? ` (${render5etoolsPlainText(item.note)})` : "";
            return damageTypes.join(", ") + note;
        }
        return String(item);
    }).join("; ");
}

function formatConditionImmune(list: any[]): string {
    if (!list || list.length === 0) return "";
    return list.map((item: any) => {
        if (typeof item === "string") return item;
        // Can be objects with condition + note
        if (typeof item === "object") {
            const conds = item.conditionImmune || [];
            const note = item.note ? ` (${render5etoolsPlainText(item.note)})` : "";
            return conds.join(", ") + note;
        }
        return String(item);
    }).join("; ");
}

function formatCR(cr: any): { crText: string; lairText: string; xp: string } {
    if (!cr) return { crText: "—", lairText: "", xp: "" };
    if (typeof cr === "string") {
        return { crText: cr, lairText: "", xp: CR_XP[cr] ? `${CR_XP[cr]} XP` : "" };
    }
    if (typeof cr === "object") {
        const base = cr.cr || "—";
        const lair = cr.lair ? ` (${cr.lair} in lair)` : "";
        const xp = cr.xp ? `${cr.xp.toLocaleString()} XP` : (CR_XP[base] ? `${CR_XP[base]} XP` : "");
        return { crText: base, lairText: lair, xp };
    }
    return { crText: String(cr), lairText: "", xp: "" };
}

// ────────────────────────────────────────────────────────────────────────────
// Entry Renderer
// ────────────────────────────────────────────────────────────────────────────

const RollButton = ({ segment, active, rollTarget, rollEngine, isRolling, setIsRolling }: {
    segment: any;
    active: boolean;
    rollTarget: string;
    rollEngine: 'dice-plus' | 'basic';
    isRolling: boolean;
    setIsRolling: (v: boolean) => void;
}) => {
    // Per-button debounce — prevents accidental double-clicks on the same button.
    const lastRollTime = useRef(0);

    const handleRoll = async () => {
        console.log("[RollButton] Clicked! Active:", active, "Engine:", rollEngine, "Rolling:", isRolling);
        if (!active) return;
        if (rollEngine === 'dice-plus' && isRolling) return;

        // 500 ms per-button cooldown.
        const now = Date.now();
        if (now - lastRollTime.current < 500) return;
        lastRollTime.current = now;

        if (rollEngine === 'basic') {
            try {
                const result = evaluateRoll(segment.formula, { label: segment.label });
                await OBR.notification.show(result.formattedText, result.variant);
                console.log("[RollButton] Basic roll executed:", result);
            } catch (err) {
                console.error("[RollButton] ERROR during basic roll:", err);
                await OBR.notification.show(`Failed to roll ${segment.formula}`, "ERROR");
            }
            return;
        }

        // Dice+ mode
        setIsRolling(true);
        // Safety — auto-unlock after 10 s in case Dice+ never responds.
        const safetyTimer = setTimeout(() => setIsRolling(false), 10_000);

        try {
            const player = await OBR.player.getName();
            const playerId = await OBR.player.getId();
            const ts = Date.now();
            const rid = "roll_" + ts + "_" + Math.random().toString(36).substring(7);

            const payload = {
                rollId: rid,
                playerId: playerId,
                playerName: player,
                rollTarget: rollTarget,
                diceNotation: segment.formula,
                showResults: true,
                timestamp: ts,
                source: EXTENSION_ID,
            };

            await OBR.broadcast.sendMessage("dice-plus/roll-request", payload, { destination: 'ALL' });
            console.log("[RollButton] Roll request sent to Dice+:", rid, segment.formula);
        } catch (err) {
            console.error("[RollButton] ERROR during Dice+ roll:", err);
            clearTimeout(safetyTimer);
            setIsRolling(false);
        }
    };

    if (!active) return <span>{segment.content}</span>;

    const isButtonBlocked = rollEngine === 'dice-plus' && isRolling;

    return (
        <span
            onClick={handleRoll}
            title={isButtonBlocked ? "Roll in progress…" : `Click to roll ${segment.formula}`}
            style={{
                color: "#58180D",
                textDecoration: "underline dotted",
                cursor: isButtonBlocked ? "not-allowed" : "pointer",
                opacity: isButtonBlocked ? 0.5 : 1,
                fontWeight: "bold",
                padding: "0 2px",
                borderRadius: "3px",
                transition: "background 0.2s, opacity 0.2s",
            }}
            onMouseOver={(e) => { if (!isButtonBlocked) e.currentTarget.style.background = "rgba(88, 24, 13, 0.1)"; }}
            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
        >
            {segment.content}
        </span>
    );
};

const renderMarkup = (text: string, active: boolean, rollTarget: string, rollEngine: 'dice-plus' | 'basic', isRolling: boolean, setIsRolling: (v: boolean) => void) => {
    const segments = render5etoolsText(text);
    return segments.map((s, i) => (
        <span key={i}>
            {s.type === 'text' ? s.content : <RollButton segment={s} active={active} rollTarget={rollTarget} rollEngine={rollEngine} isRolling={isRolling} setIsRolling={setIsRolling} />}
        </span>
    ));
};

const renderEntries = (entries: any[], activeDice: boolean, rollTarget: string, rollEngine: 'dice-plus' | 'basic', isRolling: boolean, setIsRolling: (v: boolean) => void, depth = 0): React.ReactNode => {
    if (!entries || !Array.isArray(entries)) return null;
    return entries.map((e, i) => {
        if (e == null) return null;

        // Plain string
        if (typeof e === "string") {
            return (
                <p key={i} style={{ margin: "4px 0", lineHeight: "1.4" }}>
                    {renderMarkup(e, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </p>
            );
        }

        if (typeof e !== "object") return null;

        const type = e.type;

        // Named entry with entries[] (most common for traits/actions)
        if (type === "entries" || (!type && e.name && e.entries)) {
            return (
                <div key={i} style={{ marginBottom: "6px" }}>
                    <strong>{renderMarkup(e.name, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}. </strong>
                    {renderEntries(e.entries, activeDice, rollTarget, rollEngine, isRolling, setIsRolling, depth)}
                </div>
            );
        }

        // Named item with a single "entry" string (used in list-hang-notitle)
        if (type === "item") {
            if (e.name && e.entry) {
                return (
                    <div key={i} style={{ marginBottom: "6px" }}>
                        <em><strong>{renderMarkup(e.name, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}.</strong></em>{" "}
                        {renderMarkup(e.entry, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                    </div>
                );
            }
            if (e.name && e.entries) {
                return (
                    <div key={i} style={{ marginBottom: "6px" }}>
                        <em><strong>{renderMarkup(e.name, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}.</strong></em>{" "}
                        {renderEntries(e.entries, activeDice, rollTarget, rollEngine, isRolling, setIsRolling, depth)}
                    </div>
                );
            }
            if (e.entry) return <p key={i} style={{ margin: "4px 0" }}>{renderMarkup(e.entry, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}</p>;
        }

        // List
        if (type === "list") {
            const items: any[] = e.items || [];
            const isHangNotitle = e.style?.includes("hang-notitle");
            return (
                <ul key={i} style={{ margin: "4px 0", paddingLeft: isHangNotitle ? "0" : "18px", listStyle: isHangNotitle ? "none" : "disc" }}>
                    {items.map((it: any, j: number) => (
                        <li key={j} style={{ marginBottom: "3px" }}>
                            {renderEntries([it], activeDice, rollTarget, rollEngine, isRolling, setIsRolling, depth + 1)}
                        </li>
                    ))}
                </ul>
            );
        }

        // Inset / sidebar variant — render as a callout box
        if (type === "inset" || type === "insetReadaloud" || type === "variant") {
            return (
                <div key={i} style={{
                    border: "1px solid #58180D",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    margin: "8px 0",
                    background: "#f5ebe0",
                    fontSize: "12px",
                }}>
                    {e.name && (
                        <div style={{ fontWeight: "bold", color: "#58180D", marginBottom: "4px" }}>
                            {renderMarkup(e.name, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                        </div>
                    )}
                    {e.entries && renderEntries(e.entries, activeDice, rollTarget, rollEngine, isRolling, setIsRolling, depth + 1)}
                </div>
            );
        }

        // Table
        if (type === "table") {
            const caption: string = e.caption || "";
            const colLabels: string[] = e.colLabels || [];
            const rows: any[][] = e.rows || [];
            return (
                <div key={i} style={{ margin: "8px 0", overflowX: "auto" }}>
                    {caption && <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{renderMarkup(caption, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}</div>}
                    <table style={{ borderCollapse: "collapse", fontSize: "12px", width: "100%" }}>
                        {colLabels.length > 0 && (
                            <thead>
                                <tr>
                                    {colLabels.map((col: string, j: number) => (
                                        <th key={j} style={{ border: "1px solid #ccc", padding: "3px 6px", background: "#e8d5b7", textAlign: "left" }}>
                                             {renderMarkup(col, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {rows.map((row: any[], j: number) => (
                                <tr key={j}>
                                    {row.map((cell: any, k: number) => (
                                        <td key={k} style={{ border: "1px solid #ccc", padding: "3px 6px" }}>
                                            {typeof cell === "string"
                                                ? renderMarkup(cell, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)
                                                : typeof cell === "object" && cell?.type === "cell"
                                                    ? renderMarkup(cell.entry || cell.exact || "", activeDice, rollTarget, rollEngine, isRolling, setIsRolling)
                                                    : String(cell ?? "")}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Fallback — try to render entries/entry if present
        if (e.entries) return renderEntries(e.entries, activeDice, rollTarget, rollEngine, isRolling, setIsRolling, depth);
        if (e.entry) return <p key={i} style={{ margin: "4px 0" }}>{renderMarkup(e.entry, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}</p>;

        return null;
    });
};

// ────────────────────────────────────────────────────────────────────────────
// Spellcasting Renderer
// ────────────────────────────────────────────────────────────────────────────

const renderSpellcasting = (spellcasting: any[], activeDice: boolean, rollTarget: string, rollEngine: 'dice-plus' | 'basic', isRolling: boolean, setIsRolling: (v: boolean) => void) => {
    if (!spellcasting || !Array.isArray(spellcasting)) return null;
    return spellcasting.map((s, i) => (
        <div key={i} style={{ marginBottom: "12px", fontSize: "13px" }}>
            <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", fontSize: "18px", margin: "16px 0 8px" }}>
                {s.name || "Spellcasting"}
            </h3>
            {s.headerEntries && <div style={{ marginBottom: "8px" }}>{renderEntries(s.headerEntries, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}</div>}

            {/* At will */}
            {s.will && (
                <p style={{ margin: "4px 0" }}>
                    <strong>At will: </strong>
                    {s.will.map((sp: any, j: number) => (
                        <span key={j}>
                            {j > 0 && ", "}
                            {renderMarkup(typeof sp === "string" ? sp : (sp.entry || sp.name || ""), activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                        </span>
                    ))}
                </p>
            )}

            {/* Daily (e.g. "1e", "2", "3e") */}
            {s.daily && Object.entries(s.daily).map(([k, v]: [string, any]) => {
                const count = k.replace("e", "");
                const each = k.includes("e") ? " each" : "";
                const label = `${count}/day${each}`;
                return (
                    <p key={k} style={{ margin: "4px 0" }}>
                        <strong>{label}: </strong>
                        {(v as any[]).map((sp: any, j: number) => (
                            <span key={j}>
                                {j > 0 && ", "}
                                {renderMarkup(typeof sp === "string" ? sp : (sp.entry || sp.name || ""), activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                            </span>
                        ))}
                    </p>
                );
            })}

            {/* Spell slot casting by level */}
            {s.spells && Object.entries(s.spells).map(([level, data]: [string, any]) => (
                <p key={level} style={{ margin: "4px 0" }}>
                    <strong>
                        {level === "0"
                            ? "Cantrips (at will)"
                            : `${getOrdinal(parseInt(level))} level (${data.slots ?? 0} slot${data.slots !== 1 ? "s" : ""})`}:{" "}
                    </strong>
                    {(data.spells || []).map((sp: any, j: number) => (
                        <span key={j}>
                            {j > 0 && ", "}
                            {renderMarkup(typeof sp === "string" ? sp : (sp.entry || sp.name || ""), activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                        </span>
                    ))}
                </p>
            ))}

            {s.footerEntries && <div style={{ marginTop: "8px" }}>{renderEntries(s.footerEntries, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}</div>}
        </div>
    ));
};

function getOrdinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

const AbilityTable = ({ monster, active, rollTarget, rollEngine, isRolling, setIsRolling }: {
    monster: any;
    active: boolean;
    rollTarget: string;
    rollEngine: 'dice-plus' | 'basic';
    isRolling: boolean;
    setIsRolling: (v: boolean) => void;
}) => {
    const abilities = ["str", "dex", "con", "int", "wis", "cha"];
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", textAlign: "center", borderTop: "1px solid #58180D", borderBottom: "1px solid #58180D", padding: "8px 0", margin: "8px 0" }}>
            {abilities.map(ab => (
                <div key={ab}>
                    <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px", color: "#58180D" }}>{ab}</div>
                    <div style={{ fontSize: "14px" }}>
                        {monster[ab] ?? 10} (
                        <RollButton 
                            segment={{ type: 'roll', content: getModifier(monster[ab] ?? 10), formula: `1d20${getModifier(monster[ab] ?? 10)}`, label: `${ab.toUpperCase()} Check` }} 
                            active={active} 
                            rollTarget={rollTarget}
                            rollEngine={rollEngine}
                            isRolling={isRolling}
                            setIsRolling={setIsRolling}
                        />)
                    </div>
                </div>
            ))}
        </div>
    );
};

const MetadataLine = ({ label, value }: { label: string; value: any }) => {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
    return (
        <p style={{ margin: "2px 0", fontSize: "13px" }}>
            <strong style={{ color: "#58180D" }}>{label}</strong> {value}
        </p>
    );
};

const SectionHeader = ({ title }: { title: string }) => (
    <h3 style={{ color: "#58180D", borderBottom: "1px solid #58180D", fontSize: "18px", margin: "16px 0 8px" }}>
        {title}
    </h3>
);

// ────────────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────────────

export default function ViewPopover() {
    const [monster, setMonster] = useState<any>(null);
    const [tokenId, setTokenId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const [isDiceReady, setIsDiceReady] = useState(false);
    const [forceDice, setForceDice] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [isInitiativeRolling, setIsInitiativeRolling] = useState(false);
    const [rollEngine, setRollEngine] = useState<'dice-plus' | 'basic'>(() => {
        return (localStorage.getItem("5etools-roll-engine") as 'dice-plus' | 'basic') || "dice-plus";
    });
    const [rollTarget, setRollTarget] = useState(() => {
        const savedEngine = localStorage.getItem("5etools-roll-engine") || "dice-plus";
        if (savedEngine === "basic") return "self";
        return localStorage.getItem("5etools-roll-target") || "everyone";
    });

    useEffect(() => {
        let pingInterval: any;
        let unstop: (() => void) | undefined;

        const initView = async () => {
            OBR.onReady(async () => {
                try {
                    const hashParts = window.location.hash.split("?");
                    const query = hashParts.length > 1 ? hashParts[1] : "";
                    const urlParams = new URLSearchParams(query);
                    const tid = urlParams.get("id");

                    if (!tid) { setError("No token ID provided."); return; }
                    setTokenId(tid);

                    const items = await OBR.scene.items.getItems([tid]);
                    if (items.length === 0) { setError("Token not found."); return; }

                    const monsterMetadata = items[0].metadata[METADATA_KEY];
                    if (!monsterMetadata) { setError("No data found. Try re-importing."); return; }

                    setMonster(monsterMetadata);

                    // --- Dice handshake ---
                    const requestId = Math.random().toString(36).substring(7);
                    console.log(`[DiceHandshake] Initializing...`);
                    
                    const handshakeChannels = ["dice-plus/isReady"];
                    const unstopFns: (() => void)[] = [];

                    handshakeChannels.forEach(ch => {
                        unstopFns.push(OBR.broadcast.onMessage(ch, (data: any) => {
                            const payload = data?.data || data;
                            if (payload && payload.ready === true && payload.requestId === requestId) {
                                console.log(`[DiceHandshake] Dice+ confirmed READY!`);
                                setIsDiceReady(true);
                                if (pingInterval) {
                                    clearInterval(pingInterval);
                                    pingInterval = null;
                                }
                            }
                        }));
                    });

                    // Clear rolling state on result OR error so the next roll is never blocked.
                    const resultUnstop = OBR.broadcast.onMessage(`${EXTENSION_ID}/roll-result`, (data: any) => {
                        console.log("[DiceResult] Received result:", JSON.stringify(data));
                        setIsRolling(false);
                    });
                    const errorUnstop = OBR.broadcast.onMessage(`${EXTENSION_ID}/roll-error`, (data: any) => {
                        console.log("[DiceError] Received error:", JSON.stringify(data));
                        setIsRolling(false);
                    });

                    unstop = () => {
                        unstopFns.forEach(fn => fn());
                        resultUnstop();
                        errorUnstop();
                    };

                    const doPing = () => {
                        const pingPayload = { requestId, timestamp: Date.now(), source: EXTENSION_ID, request: true };
                        handshakeChannels.forEach(ch => OBR.broadcast.sendMessage(ch, pingPayload, { destination: 'ALL' }));
                    };
                    doPing();
                    pingInterval = setInterval(doPing, 1000);

                } catch (err: any) {
                    setError(`Failed to load: ${err.message}`);
                }
            });
        };
        initView();

        return () => {
            if (unstop) unstop();
            if (pingInterval) clearInterval(pingInterval);
        };
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
                delete item.metadata[INITIATIVE_METADATA_KEY];
                item.name = "Token";
            });
            await OBR.popover.close(`${EXTENSION_ID}/view-popover`);
        } catch (err: any) {
            setError(`Failed to remove: ${err.message}`);
        }
    };

    const handleRollInitiative = async () => {
        if (!tokenId || !monster || isInitiativeRolling) return;
        if (rollEngine === 'dice-plus' && isRolling) return;

        const monsterName = monster._displayName || monster.name || "creature";
        const mod = dexModifier(monster.dex);

        // ── Basic engine: local roll, then write ──────────────────────────────
        if (rollEngine === 'basic') {
            setIsInitiativeRolling(true);
            try {
                const result = rollInitiativeBasic(monster);
                const finalTotal = initiativeTiebreakTotal(result.total, mod);
                const shownText = finalTotal === result.total
                    ? result.formattedText
                    : `${result.formattedText} (tiebreak ${finalTotal})`;
                const first = await writeInitiative(tokenId, finalTotal, { overwrite: false });
                if (!first.written) {
                    const ok = window.confirm(`Token already has initiative ${first.previous}. Overwrite with ${finalTotal}?`);
                    if (!ok) {
                        await OBR.notification.show(shownText, result.variant);
                        return;
                    }
                    await writeInitiative(tokenId, finalTotal, { overwrite: true });
                }
                await OBR.notification.show(shownText, result.variant);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                await OBR.notification.show(`Failed to roll initiative: ${msg}`, "ERROR");
            } finally {
                setIsInitiativeRolling(false);
            }
            return;
        }

        // ── Dice+ engine: broadcast, await matched rollId, 10 s local fallback ──
        setIsInitiativeRolling(true);
        setIsRolling(true);
        // Hoisted for the finally block (stands the safety net down on every exit).
        let rid = "";
        try {
            const notation = initiativeNotation(mod, monsterName);
            const player = await OBR.player.getName();
            const playerId = await OBR.player.getId();
            const ts = Date.now();
            rid = "init_" + ts + "_" + Math.random().toString(36).substring(7);

            // Let the background safety net complete this roll if the popover
            // closes mid-roll (its own await would die with this JS context).
            try {
                await OBR.broadcast.sendMessage(
                    `${EXTENSION_ID}/initiative-pending`,
                    { rollId: rid, tokenId, mod },
                    { destination: 'ALL' }
                );
            } catch { /* safety net is best-effort */ }

            // Listen BEFORE broadcast to avoid missing a fast response.
            const totalPromise = new Promise<number | null>((resolve) => {
                const state = { settled: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
                const unsub = OBR.broadcast.onMessage(`${EXTENSION_ID}/roll-result`, (event: unknown) => {
                    const wrapper = event as { data?: unknown } | undefined;
                    const payload = (wrapper?.data ?? event) as {
                        rollId?: unknown;
                        result?: { totalValue?: unknown };
                        totalValue?: unknown;
                        total?: unknown;
                    } | undefined;
                    if (payload?.rollId === rid) {
                        const totalVal = payload?.result?.totalValue ?? payload?.totalValue ?? payload?.total;
                        if (typeof totalVal === "number") {
                            if (state.settled) return;
                            state.settled = true;
                            if (state.timer) clearTimeout(state.timer);
                            try { unsub(); } catch { /* noop */ }
                            resolve(totalVal);
                        }
                    }
                });
                state.timer = setTimeout(() => {
                    if (state.settled) return;
                    state.settled = true;
                    try { unsub(); } catch { /* noop */ }
                    resolve(null);
                }, 10_000);
            });

            const payload = {
                rollId: rid,
                playerId: playerId,
                playerName: player,
                rollTarget: rollTarget,
                diceNotation: notation,
                showResults: true,
                timestamp: ts,
                source: EXTENSION_ID,
            };
            await OBR.broadcast.sendMessage("dice-plus/roll-request", payload, { destination: 'ALL' });

            const dicePlusTotal = await totalPromise;
            let finalTotal: number;
            let isFallback = false;
            let fallbackResult: ReturnType<typeof rollInitiativeBasic> | null = null;
            if (dicePlusTotal !== null) {
                finalTotal = initiativeTiebreakTotal(dicePlusTotal, mod);
            } else {
                fallbackResult = rollInitiativeBasic(monster);
                finalTotal = initiativeTiebreakTotal(fallbackResult.total, mod);
                isFallback = true;
            }

            const first = await writeInitiative(tokenId, finalTotal, { overwrite: false });
            if (!first.written) {
                const confirmText = isFallback
                    ? `Token already has initiative ${first.previous}. Overwrite with ${finalTotal}? (local fallback)`
                    : `Token already has initiative ${first.previous}. Overwrite with ${finalTotal}?`;
                // Tell the background safety net a human is deciding, so it stands down.
                try {
                    await OBR.broadcast.sendMessage(
                        `${EXTENSION_ID}/initiative-awaiting-confirm`,
                        { rollId: rid },
                        { destination: 'ALL' }
                    );
                } catch { /* safety net is best-effort */ }
                const ok = window.confirm(confirmText);
                if (!ok) {
                    if (isFallback && fallbackResult) {
                        const base = finalTotal === fallbackResult.total
                            ? fallbackResult.formattedText
                            : `${fallbackResult.formattedText} (tiebreak ${finalTotal})`;
                        await OBR.notification.show(`${base} (local fallback)`, fallbackResult.variant);
                    }
                    return;
                }
                await writeInitiative(tokenId, finalTotal, { overwrite: true });
            }

            if (isFallback && fallbackResult) {
                const base = finalTotal === fallbackResult.total
                    ? fallbackResult.formattedText
                    : `${fallbackResult.formattedText} (tiebreak ${finalTotal})`;
                await OBR.notification.show(`${base} (local fallback)`, fallbackResult.variant);
            }
            // On Dice+ success the Dice+ extension already displays the roll.
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            await OBR.notification.show(`Failed to roll initiative: ${msg}`, "ERROR");
        } finally {
            setIsRolling(false);
            setIsInitiativeRolling(false);
            // This roll is resolved (written, cancelled, or failed) — stand the
            // background safety net down. Best-effort: may not send during teardown.
            if (rid) {
                try {
                    await OBR.broadcast.sendMessage(
                        `${EXTENSION_ID}/initiative-settled`,
                        { rollId: rid },
                        { destination: 'ALL' }
                    );
                } catch { /* safety net is best-effort */ }
            }
        }
    };

    const handleRollTargetChange = (newTarget: string) => {
        setRollTarget(newTarget);
        localStorage.setItem("5etools-roll-target", newTarget);
    };

    const handleRollEngineChange = (newEngine: 'dice-plus' | 'basic') => {
        setRollEngine(newEngine);
        localStorage.setItem("5etools-roll-engine", newEngine);
        if (newEngine === 'basic') {
            setRollTarget('self');
            localStorage.setItem("5etools-roll-target", "self");
        }
    };

    if (error) {
        return (
            <div style={{ padding: "16px", color: "#800", background: "#fee", border: "1px solid #fcc", borderRadius: "8px" }}>
                <strong>Error:</strong> {error}
            </div>
        );
    }

    if (!monster) {
        return (
            <div>Loading (v{APP_VERSION})...</div>
        );
    }

    const activeDice = rollEngine === 'basic' || isDiceReady || forceDice;

    // ── Derived display values ──────────────────────────────────────────────

    const displaySize = SIZE_MAP[monster.size?.[0]] || monster.size?.[0] || "Medium";
    const typeText = formatType(monster.type);
    const alignText = formatAlignment(monster.alignment);

    const acText = formatAC(monster.ac || []);
    const hpText = `${monster.hp?.average ?? "??"} ${monster.hp?.formula ? `(${monster.hp.formula})` : ""}`.trim();
    const speedText = formatSpeed(monster.speed);

    const saves = monster.save ? (
        <span>
            {Object.entries(monster.save).map(([k, v], i) => (
                <span key={k}>
                    {i > 0 && ", "}
                    {k.toUpperCase()}{" "}
                    <RollButton 
                        segment={{ type: 'roll', content: String(v), formula: `1d20${v}`, label: `${k.toUpperCase()} Save` }} 
                        active={activeDice} 
                        rollTarget={rollTarget}
                        rollEngine={rollEngine}
                        isRolling={isRolling}
                        setIsRolling={setIsRolling}
                    />
                </span>
            ))}
        </span>
    ) : null;

    const skills = monster.skill ? (
        <span>
            {Object.entries(monster.skill).map(([k, v], i) => (
                <span key={k}>
                    {i > 0 && ", "}
                    {k.charAt(0).toUpperCase() + k.slice(1)}{" "}
                    <RollButton 
                        segment={{ type: 'roll', content: String(v), formula: `1d20${v}`, label: `${k} Check` }} 
                        active={activeDice} 
                        rollTarget={rollTarget}
                        rollEngine={rollEngine}
                        isRolling={isRolling}
                        setIsRolling={setIsRolling}
                    />
                </span>
            ))}
        </span>
    ) : null;
    const senses = monster.senses
        ? (Array.isArray(monster.senses) ? monster.senses.join(", ") : monster.senses)
        : null;
    const passivePerception = monster.passive ?? 10;

    const vulnerable = formatDamageList(monster.vulnerable || []);
    const resistant = formatDamageList(monster.resist || []);
    const immune = formatDamageList(monster.immune || []);
    const condImmune = formatConditionImmune(monster.conditionImmune || []);

    const languages = Array.isArray(monster.languages) ? monster.languages.join(", ") : monster.languages;

    const { crText, lairText, xp } = formatCR(monster.cr);
    const crDisplay = `${crText}${lairText}${xp ? ` (${xp})` : ""}`;
    const profBonus = crText && crText !== "—" ? getProficiencyBonus(crText) : null;

    const legendaryName = monster.name || "creature";
    const legendaryPreamble = monster.legendary
        ? `The ${legendaryName} can take 3 legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${legendaryName} regains spent legendary actions at the start of its turn.`
        : null;

    const initMod = dexModifier(monster.dex);
    const initFormulaLabel = initMod === 0 ? "1d20" : `1d20${initMod > 0 ? `+${initMod}` : initMod}`;
    const isInitiativeBlocked = isInitiativeRolling || (rollEngine === 'dice-plus' && isRolling);

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: "20px", fontFamily: "'Inter', sans-serif", color: "#333", background: "#fdf5e6", minHeight: "100vh", lineHeight: "1.5" }}>

            {/* Name + Remove */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #58180D", marginBottom: "8px", paddingBottom: "4px" }}>
                <h2 style={{ color: "#58180D", margin: 0, fontSize: "22px" }}>
                    {monster.sourceUrl ? (
                        <a href={monster.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline dotted", fontWeight: "bold" }}>
                            {monster._displayName || monster.name}
                        </a>
                    ) : (monster._displayName || monster.name)}
                </h2>
                <button onClick={handleRemove} style={{ padding: "4px 8px", fontSize: "11px", background: "#800", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                    Remove
                </button>
            </div>

            {/* Type line */}
            <div style={{ fontStyle: "italic", fontSize: "14px", marginBottom: "8px" }}>
                {displaySize} {typeText}{alignText ? `, ${alignText}` : ""}
            </div>

            {/* Roll initiative — writes to the official Initiative Tracker metadata */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <button
                    onClick={handleRollInitiative}
                    disabled={isInitiativeBlocked}
                    title={`Roll ${initFormulaLabel} for initiative via ${rollEngine === 'basic' ? 'Basic roller' : 'Dice+'}`}
                    style={{
                        padding: "4px 12px",
                        cursor: isInitiativeBlocked ? "not-allowed" : "pointer",
                        background: isInitiativeBlocked ? "#ccc" : "#58180D",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        opacity: isInitiativeBlocked ? 0.7 : 1,
                        whiteSpace: "nowrap",
                    }}
                >
                    {isInitiativeRolling ? "Rolling initiative…" : "Roll initiative"}
                </button>
                <span style={{ fontStyle: "italic", fontSize: "11px", color: "#999" }}>
                    Keep open while the die rolls.
                </span>
            </div>

            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />

            {/* Core stats */}
            <MetadataLine label="Armor Class" value={acText} />
            <MetadataLine label="Hit Points" value={hpText} />
            <MetadataLine label="Speed" value={speedText} />

            <AbilityTable monster={monster} active={activeDice} rollTarget={rollTarget} rollEngine={rollEngine} isRolling={isRolling} setIsRolling={setIsRolling} />

            {/* Secondary stats */}
            <div style={{ marginBottom: "8px" }}>
                <MetadataLine label="Saving Throws" value={saves} />
                <MetadataLine label="Skills" value={skills} />
                <MetadataLine label="Damage Vulnerabilities" value={vulnerable} />
                <MetadataLine label="Damage Resistances" value={resistant} />
                <MetadataLine label="Damage Immunities" value={immune} />
                <MetadataLine label="Condition Immunities" value={condImmune} />
                <MetadataLine label="Senses" value={`${senses ? senses + ", " : ""}passive Perception ${passivePerception}`} />
                <MetadataLine label="Languages" value={languages || "—"} />
                <MetadataLine label="Challenge" value={crDisplay} />
                <MetadataLine label="Roll Target" value={rollTarget} />
                {profBonus && <MetadataLine label="Proficiency Bonus" value={profBonus} />}
            </div>

            <hr style={{ border: "1px solid #58180D", margin: "8px 0" }} />

            {/* Traits */}
            {monster.trait && (
                <div style={{ marginBottom: "12px" }}>
                    {renderEntries(monster.trait, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </div>
            )}

            {/* Spellcasting (within traits) */}
            {monster.spellcasting && renderSpellcasting(monster.spellcasting, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}

            {/* Actions */}
            {monster.action && (
                <div style={{ marginBottom: "12px" }}>
                    <SectionHeader title="Actions" />
                    {renderEntries(monster.action, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </div>
            )}

            {/* Bonus Actions */}
            {monster.bonus && (
                <div style={{ marginBottom: "12px" }}>
                    <SectionHeader title="Bonus Actions" />
                    {renderEntries(monster.bonus, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </div>
            )}

            {/* Reactions */}
            {monster.reaction && (
                <div style={{ marginBottom: "12px" }}>
                    <SectionHeader title="Reactions" />
                    {renderEntries(monster.reaction, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </div>
            )}

            {/* Legendary Actions */}
            {monster.legendary && (
                <div style={{ marginBottom: "12px" }}>
                    <SectionHeader title="Legendary Actions" />
                    {legendaryPreamble && (
                        <p style={{ fontStyle: "italic", fontSize: "13px", marginBottom: "8px", lineHeight: "1.4" }}>
                            {legendaryPreamble}
                        </p>
                    )}
                    {renderEntries(monster.legendary, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </div>
            )}

            {/* Mythic Actions */}
            {monster.mythic && (
                <div style={{ marginBottom: "12px" }}>
                    <SectionHeader title="Mythic Actions" />
                    {monster.mythicHeader && (
                        <p style={{ fontStyle: "italic", fontSize: "13px", marginBottom: "8px" }}>
                            {renderEntries(monster.mythicHeader, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                        </p>
                    )}
                    {renderEntries(monster.mythic, activeDice, rollTarget, rollEngine, isRolling, setIsRolling)}
                </div>
            )}

            {/* Lair Actions note — data lives in separate file, link to 5e.tools */}
            {monster.legendaryGroup && (
                <div style={{ marginTop: "16px", fontSize: "12px", color: "#666", borderTop: "1px solid #ccc", paddingTop: "8px" }}>
                    {monster.sourceUrl && (
                        <span>
                            Lair Actions & Regional Effects:{" "}
                            <a href={monster.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#58180D" }}>
                                View on 5e.tools
                            </a>
                        </span>
                    )}
                </div>
            )}

            {/* Roll Target Toggle */}
            <div style={{
                marginTop: "16px",
                padding: "8px 12px",
                background: "rgba(88, 24, 13, 0.05)",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #e0d0b0",
                opacity: rollEngine === 'basic' ? 0.5 : 1,
                transition: "opacity 0.2s",
            }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#58180D" }}>Roll to:</span>
                <div
                    style={{
                        display: "flex",
                        background: "#ddd",
                        borderRadius: "15px",
                        padding: "2px",
                        width: "120px",
                        position: "relative",
                        cursor: rollEngine === 'basic' ? "not-allowed" : "pointer",
                        pointerEvents: rollEngine === 'basic' ? "none" : "auto",
                    }}
                    title={rollEngine === 'basic' ? "Roll target is locked to Self in Basic mode" : "Click to toggle roll target"}
                    onClick={() => {
                        if (rollEngine !== 'basic') {
                            handleRollTargetChange(rollTarget === 'everyone' ? 'self' : 'everyone');
                        }
                    }}
                >
                    <div style={{
                        position: "absolute",
                        left: rollTarget === 'everyone' ? "2px" : "62px",
                        top: "2px",
                        bottom: "2px",
                        width: "56px",
                        background: "#58180D",
                        borderRadius: "13px",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    }} />
                    <span style={{ flex: 1, textAlign: "center", fontSize: "10px", zIndex: 1, color: rollTarget === 'everyone' ? "white" : "#666", lineHeight: "18px", transition: "color 0.2s" }}>Everyone</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: "10px", zIndex: 1, color: rollTarget === 'self' ? "white" : "#666", lineHeight: "18px", transition: "color 0.2s" }}>Self</span>
                </div>
            </div>

            {/* Roll Engine Toggle */}
            <div style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(88, 24, 13, 0.05)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e0d0b0" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#58180D" }}>Roll Engine:</span>
                <div
                    style={{ display: "flex", background: "#ddd", borderRadius: "15px", padding: "2px", width: "120px", position: "relative", cursor: "pointer" }}
                    onClick={() => handleRollEngineChange(rollEngine === 'dice-plus' ? 'basic' : 'dice-plus')}
                    title="Toggle between Dice+ extension and local Basic roller"
                >
                    <div style={{
                        position: "absolute",
                        left: rollEngine === 'dice-plus' ? "2px" : "62px",
                        top: "2px",
                        bottom: "2px",
                        width: "56px",
                        background: "#58180D",
                        borderRadius: "13px",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    }} />
                    <span style={{ flex: 1, textAlign: "center", fontSize: "10px", zIndex: 1, color: rollEngine === 'dice-plus' ? "white" : "#666", lineHeight: "18px", transition: "color 0.2s" }}>Dice+</span>
                    <span style={{ flex: 1, textAlign: "center", fontSize: "10px", zIndex: 1, color: rollEngine === 'basic' ? "white" : "#666", lineHeight: "18px", transition: "color 0.2s" }}>Basic</span>
                </div>
            </div>

            {/* Footer / Debug */}
            <div style={{ marginTop: "24px", paddingTop: "8px", borderTop: "1px solid #ccc", fontSize: "10px", color: "#999", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>v{APP_VERSION}</span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {rollEngine === 'dice-plus' && !activeDice && (
                        <button 
                            onClick={() => setForceDice(true)}
                            style={{ background: "none", border: "none", color: "#58180D", textDecoration: "underline", cursor: "pointer", fontSize: "10px", padding: 0 }}
                        >
                            Force Enable
                        </button>
                    )}
                    <span style={{ color: activeDice ? "#080" : "#800" }}>
                        Dice Engine: {rollEngine === 'basic' ? "BASIC" : (activeDice ? "READY" : "OFFLINE")}
                    </span>
                </div>
            </div>
        </div>
    );
}

