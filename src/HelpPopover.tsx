export default function HelpPopover() {
    return (
        <div style={{
            padding: "32px",
            fontFamily: "'Inter', sans-serif",
            color: "#333",
            background: "#fdf5e6",
            minHeight: "100vh",
            lineHeight: "1.6"
        }}>
            <header style={{ marginBottom: "32px", borderBottom: "3px solid #58180D", paddingBottom: "12px" }}>
                <h2 style={{
                    color: "#58180D",
                    margin: 0,
                    fontSize: "28px",
                    fontWeight: 800,
                    letterSpacing: "-0.5px"
                }}>
                    5e Tools Integration
                </h2>
                <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "14px", fontWeight: 500 }}>
                    User Guide & Documentation
                </p>
            </header>

            <section style={{ marginBottom: "24px" }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>How to Import a Monster</h3>
                <ol style={{ paddingLeft: "24px", margin: 0 }}>
                    <li style={{ marginBottom: "8px" }}>Open <strong>5e.tools</strong> and search for a monster in the Bestiary.</li>
                    <li style={{ marginBottom: "8px" }}>Copy the URL of the monster page (e.g., <code>https://5e.tools/bestiary.html#aboleth_mm</code>).</li>
                    <li style={{ marginBottom: "8px" }}>In Owlbear Rodeo, <strong>Right-Click</strong> a character token (IMAGE type on the CHARACTER layer).</li>
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
                <p style={{ margin: 0 }}>
                    If you use the <strong>"Stat Bubbles for D&D"</strong> extension, HP and AC will automatically sync to your token's bubbles upon import.
                    <br /><br />
                    <em>Note: We value your customization! This extension will <strong>not</strong> overwrite the name you've given your token in Owlbear Rodeo.</em>
                </p>
            </section>

            <section style={{ marginBottom: "24px" }}>
                <h3 style={{ color: "#58180D", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Removing a Statblock</h3>
                <p style={{ margin: 0 }}>
                    Need to clear a token? Open the 5e Tools view and click <strong>"Remove Statblock"</strong> at the top right. This resets all metadata and the Owlbear Rodeo name/text attachments.
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
                <span style={{ fontWeight: 600, color: "#58180D" }}>v1.0.12</span>
            </footer>
        </div>
    );
}
