export default function HelpPopover() {
    return (
        <div style={{ padding: "16px", fontFamily: "sans-serif", color: "#333", background: "#fdf5e6", minHeight: "100vh" }}>
            <h2 style={{ color: "#58180D", borderBottom: "2px solid #58180D", margin: "0 0 12px 0", paddingBottom: "4px" }}>5e Tools Integration Help</h2>

            <section style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#58180D", fontSize: "16px" }}>How to Import a Monster</h3>
                <ol style={{ paddingLeft: "20px" }}>
                    <li>Open <strong>5e.tools</strong> and search for a monster in the Bestiary.</li>
                    <li>Copy the URL of the monster page (e.g., <code>https://5e.tools/bestiary.html#aboleth_mm</code>).</li>
                    <li>In Owlbear Rodeo, <strong>Right-Click</strong> a character token (IMAGE type on the CHARACTER layer).</li>
                    <li>Select <strong>5e Tools</strong> from the context menu.</li>
                    <li>Paste the URL and click <strong>Import Monster</strong>.</li>
                </ol>
            </section>

            <section style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#58180D", fontSize: "16px" }}>Stat Bubbles Integration</h3>
                <p>If you have the <strong>"Stat Bubbles for D&D"</strong> extension installed, HP and AC will automatically sync to your token's bubbles upon import!</p>
            </section>

            <section style={{ marginBottom: "16px" }}>
                <h3 style={{ color: "#58180D", fontSize: "16px" }}>Removing a Statblock</h3>
                <p>If you need to clear a token, open the 5e Tools view and click <strong>"Remove Statblock"</strong>. This will wipe all monster data and reset the token.</p>
            </section>

            <div style={{ marginTop: "20px", fontSize: "12px", borderTop: "1px solid #ccc", paddingTop: "8px", opacity: 0.8 }}>
                <p>Version: 1.0.11 | Created by ajuszt95</p>
            </div>
        </div>
    );
}
