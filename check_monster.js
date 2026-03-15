
async function checkMonster() {
    const source = "xmm";
    const name = "Adult Bronze Dragon";
    const url = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-${source}.json`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const monster = data.monster.find(m => m.name === name);
        if (!monster) {
            console.log("Monster not found");
            return;
        }
        
        const uniqueTags = new Set();
        data.monster.forEach(m => {
            if (!m.action) return;
            m.action.forEach(a => {
                const entriesStr = JSON.stringify(a.entries);
                const matches = entriesStr.matchAll(/{@(\w+)/g);
                for (const match of matches) {
                    uniqueTags.add(match[1]);
                }
            });
        });

        console.log("--- UNIQUE TAGS FOUND ---");
        console.log(Array.from(uniqueTags).sort().join(", "));
    } catch (e) {
        console.error(e);
    }
}

checkMonster();
