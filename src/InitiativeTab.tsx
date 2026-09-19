import { useState, useEffect, useRef } from "react";
import OBR from "@owlbear-rodeo/sdk";
import {
    collectMonsterTokens,
    eligibleForRun,
    hasLair,
    readExistingCounts,
    runBulkInitiative,
    type BulkRow,
    type BulkToken,
} from "./bulkInitiative";
import type { Advantage } from "./utils/diceRoller";

/** The OBR SDK sometimes rejects with plain objects — serialize those too. */
function describeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        const json = JSON.stringify(err);
        return json === undefined ? String(err) : json;
    } catch {
        return String(err);
    }
}

function readRollContext(): { engine: "dice-plus" | "basic"; rollTarget: string; advantage: Advantage } {
    const engine = localStorage.getItem("5etools-roll-engine") === "basic" ? "basic" : "dice-plus";
    const rollTarget = localStorage.getItem("5etools-roll-target") || "everyone";
    const adv = localStorage.getItem("5etools-roll-adv");
    const advantage: Advantage = adv === "adv" || adv === "dis" ? adv : "normal";
    return { engine, rollTarget, advantage };
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

const pillTrack: React.CSSProperties = {
    display: "flex",
    background: "#ddd",
    borderRadius: "15px",
    padding: "2px",
};

function pillButton(active: boolean, disabled = false): React.CSSProperties {
    return {
        border: "none",
        borderRadius: "13px",
        padding: "3px 8px",
        background: active ? "#58180D" : "transparent",
        color: active ? "white" : "#666",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "10px",
        opacity: disabled && !active ? 0.6 : 1,
    };
}

/**
 * Encounter Initiative tab: candidate preview checklist + bulk runner.
 * Always mounted (parent hides via display:none) so a mid-run tab switch
 * never kills the await loop.
 */
export default function InitiativeTab({ active }: { active: boolean }) {
    const [candidates, setCandidates] = useState<BulkToken[]>([]);
    const [counts, setCounts] = useState<Map<string, string | undefined>>(new Map());
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [overwrite, setOverwrite] = useState(false);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [rows, setRows] = useState<BulkRow[]>([]);
    const [error, setError] = useState("");
    const [loaded, setLoaded] = useState(false);

    const refresh = async () => {
        setError("");
        try {
            const items = await OBR.scene.items.getItems();
            const found = collectMonsterTokens(items);
            setCandidates(found);
            setCounts(await readExistingCounts(found.map((t) => t.id)));
            setChecked(new Set(found.map((t) => t.id)));
            setRows([]);
            setProgress(null);
            setLoaded(true);
        } catch (err: unknown) {
            setError(`Failed to read scene tokens: ${describeError(err)}`);
        }
    };

    // Refresh on every tab open (same action as the Refresh button): the
    // scene normally changed while the tab was hidden (tokens spawned after
    // opening). The one exception is a run in flight — reopening mid-run
    // must preserve progress, never reset it.
    const runningRef = useRef(false);
    runningRef.current = running;
    useEffect(() => {
        if (active && !runningRef.current) {
            void refresh();
        }
    }, [active]);

    const toggleCheck = (id: string) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const rowById = new Map(rows.map((r) => [r.id, r]));
    const checkedCount = candidates.filter((c) => checked.has(c.id)).length;

    const run = async () => {
        if (running || checkedCount === 0) return;
        const tokens = eligibleForRun(candidates, checked);
        const ctx = readRollContext();
        setError("");
        setRows([]);
        setProgress({ done: 0, total: tokens.length });
        try {
            const existing = await readExistingCounts(tokens.map((t) => t.id));
            setCounts(existing);
            if (overwrite) {
                const occupied = tokens.filter((t) => existing.get(t.id) !== undefined).length;
                if (occupied > 0) {
                    const ok = window.confirm(`${occupied} tokens already have initiative. Overwrite all?`);
                    if (!ok) {
                        setProgress(null);
                        return;
                    }
                }
            }
            setRunning(true);
            const result = await runBulkInitiative({
                tokens,
                overwrite,
                existing,
                ctx,
                onProgress: (done, total) => setProgress({ done, total }),
            });
            setRows(result);
            const written = result.filter((r) => r.status === "written").length;
            const skipped = result.filter((r) => r.status === "skipped").length;
            const failed = result.filter((r) => r.status === "failed").length;
            let summary = `Initiative rolled for ${written} token${written === 1 ? "" : "s"}.`;
            if (skipped > 0) summary += ` ${skipped} skipped.`;
            if (failed > 0) summary += ` ${failed} failed.`;
            await OBR.notification.show(summary, failed > 0 ? "ERROR" : "DEFAULT");
            setCounts(await readExistingCounts(tokens.map((t) => t.id)));
        } catch (err: unknown) {
            setError(`Bulk roll failed: ${describeError(err)}`);
        } finally {
            setRunning(false);
            setProgress(null);
        }
    };

    const ctx = readRollContext();

    return (
        <section style={{
            marginBottom: "32px",
            padding: "20px",
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 8px 24px rgba(88, 24, 13, 0.12)",
            border: "1px solid #e0d0b0"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, margin: 0 }}>Encounter Initiative</h3>
                <button
                    onClick={refresh}
                    disabled={running}
                    style={{ padding: "4px 10px", fontSize: "12px", background: "transparent", color: "#58180D", border: "1px solid #58180D", borderRadius: "6px", cursor: running ? "not-allowed" : "pointer" }}
                >
                    Refresh
                </button>
            </div>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
                Roll initiative for every monster token at once. Uncheck tokens to exclude them.
            </p>

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
                <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#58180D", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Scope
                    </label>
                    <div style={pillTrack} title="Selection read unavailable in this SDK — All only">
                        <button disabled style={pillButton(true)}>All monster tokens</button>
                        <button disabled style={pillButton(false, true)}>Selected tokens</button>
                    </div>
                </div>
                <div>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#58180D", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                        Existing values
                    </label>
                    <div style={pillTrack}>
                        <button onClick={() => setOverwrite(false)} disabled={running} style={pillButton(!overwrite, running)}>Skip existing</button>
                        <button onClick={() => setOverwrite(true)} disabled={running} style={pillButton(overwrite, running)}>Overwrite all</button>
                    </div>
                </div>
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>
                Engine: <strong>{ctx.engine === "dice-plus" ? "Dice+" : "Basic"}</strong>
                {" · "}Advantage: <strong>{capitalize(ctx.advantage)}</strong>
                {" · "}Target: <strong>{capitalize(ctx.rollTarget)}</strong>
                <span style={{ fontStyle: "italic" }}> — roll settings live in any stat block view.</span>
            </div>

            {!loaded && (
                <div style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>Reading scene tokens…</div>
            )}
            {loaded && candidates.length === 0 && (
                <div style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>No monster tokens on scene.</div>
            )}
            {candidates.length > 0 && (
                <ul style={{ listStyle: "none", margin: "0 0 12px 0", padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                    {candidates.map((c) => {
                        const current = counts.get(c.id);
                        const occupied = current !== undefined;
                        const outcome = rowById.get(c.id);
                        return (
                            <li
                                key={c.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 12px",
                                    background: "rgba(88, 24, 13, 0.06)",
                                    border: occupied ? "1px dashed #58180D" : "1px solid #e0d0b0",
                                    borderRadius: "8px",
                                    fontSize: "13px",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked.has(c.id)}
                                    disabled={running}
                                    onChange={() => toggleCheck(c.id)}
                                    aria-label={`Include ${c.name}`}
                                />
                                <span style={{ flex: 1 }}>
                                    <strong style={{ color: "#58180D" }}>{c.name}</strong>
                                    {hasLair(c) && <span style={{ color: "#666" }}> (lair)</span>}
                                    <span style={{ color: "#666" }}>
                                        {" · "}
                                        {outcome?.status === "written" && outcome.total !== undefined
                                            ? `rolled ${outcome.total}${outcome.local ? " (local)" : ""}`
                                            : outcome?.status === "skipped"
                                                ? `skipped (${outcome.previous})`
                                                : outcome?.status === "failed"
                                                    ? `failed: ${outcome.error}`
                                                    : occupied
                                                        ? `has ${current} — will skip`
                                                        : "no value yet"}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {progress && (
                <div style={{ fontSize: "12px", color: "#58180D", marginBottom: "8px" }}>
                    Rolling {progress.done}/{progress.total}…
                </div>
            )}
            <button
                onClick={run}
                disabled={running || checkedCount === 0}
                title={running ? "Rolling..." : undefined}
                style={{
                    width: "100%",
                    padding: "12px",
                    background: (running || checkedCount === 0) ? "#ccc" : "#58180D",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 600,
                    cursor: (running || checkedCount === 0) ? "not-allowed" : "pointer",
                    transition: "all 0.2s"
                }}
            >
                {running ? "Rolling…" : checkedCount === 0 ? "Nothing selected" : `Roll initiative (${checkedCount})`}
            </button>

            {error && (
                <div style={{ marginTop: "12px", color: "#a00", fontSize: "12px", padding: "8px", background: "#fff0f0", borderRadius: "6px", border: "1px solid #fcc" }}>
                    <strong>Error:</strong> {error}
                </div>
            )}
        </section>
    );
}
