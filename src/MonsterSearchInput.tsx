import { useEffect, useMemo, useRef, useState } from "react";
import { loadMonsterIndex, searchMonsters, formatMonsterEntrySubtitle, type MonsterIndexEntry } from "./monsterIndex";

interface MonsterSearchInputProps {
    onSelect: (entry: MonsterIndexEntry) => void;
    placeholder?: string;
    id?: string;
}

/**
 * Reusable monster search + picker. Loads the prebuilt index once and
 * offers prefix-first autocomplete. On missing/corrupt index it renders
 * only a muted fallback note so the URL-paste flow stays usable.
 */
export default function MonsterSearchInput({ onSelect, placeholder, id }: MonsterSearchInputProps) {
    const [query, setQuery] = useState("");
    const [entries, setEntries] = useState<MonsterIndexEntry[] | null>(null);
    const [indexUnavailable, setIndexUnavailable] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;
        loadMonsterIndex()
            .then((loaded) => {
                if (!cancelled) setEntries(loaded);
            })
            .catch(() => {
                if (!cancelled) setIndexUnavailable(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const results = useMemo(() => {
        if (!entries) return [];
        return searchMonsters(entries, query);
    }, [entries, query]);

    const pick = (entry: MonsterIndexEntry) => {
        onSelect(entry);
        setQuery("");
        setIsOpen(false);
        setHighlight(0);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false);
            return;
        }
        if (!isOpen || results.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + results.length) % results.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const chosen = results[highlight] ?? results[0];
            if (chosen) pick(chosen);
        }
    };

    const showDropdown = isOpen && query.trim().length >= 2 && results.length > 0;

    return (
        <div style={{ position: "relative" }}>
            <input
                id={id}
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls={id ? `${id}-listbox` : undefined}
                aria-autocomplete="list"
                placeholder={placeholder ?? "Search monsters by name…"}
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlight(0);
                    setIsOpen(true);
                }}
                onFocus={() => {
                    if (query.trim().length >= 2) setIsOpen(true);
                }}
                onBlur={() => {
                    // Delay so a dropdown mousedown can select before we close.
                    setTimeout(() => setIsOpen(false), 150);
                }}
                onKeyDown={handleKeyDown}
                disabled={indexUnavailable || entries === null}
                style={{
                    width: "100%",
                    padding: "12px",
                    boxSizing: "border-box",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    outline: "none",
                    background: indexUnavailable ? "#f5f5f5" : "white",
                }}
            />
            {indexUnavailable && (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#999", fontStyle: "italic" }}>
                    Monster search unavailable — paste a 5e.tools URL below.
                </div>
            )}
            {!indexUnavailable && entries === null && (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#999", fontStyle: "italic" }}>
                    Loading monster list…
                </div>
            )}
            {showDropdown && (
                <div
                    id={id ? `${id}-listbox` : undefined}
                    role="listbox"
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        background: "white",
                        border: "1px solid #e0d0b0",
                        borderRadius: "8px",
                        maxHeight: "220px",
                        overflowY: "auto",
                        zIndex: 10,
                        boxShadow: "0 8px 24px rgba(88, 24, 13, 0.15)",
                    }}
                >
                    {results.map((entry, i) => {
                        const active = i === highlight;
                        return (
                            <div
                                key={`${entry.n}|${entry.s}|${i}`}
                                role="option"
                                aria-selected={active}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(entry);
                                }}
                                onMouseEnter={() => setHighlight(i)}
                                title={`${entry.n} (${entry.s})`}
                                style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    background: active ? "rgba(88, 24, 13, 0.1)" : "white",
                                    borderBottom: i < results.length - 1 ? "1px solid #f0e6d2" : "none",
                                }}
                            >
                                <div style={{ fontSize: "14px", fontWeight: 700, color: "#58180D" }}>{entry.n}</div>
                                <div style={{ fontSize: "12px", color: "#666" }}>
                                    {formatMonsterEntrySubtitle(entry)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
