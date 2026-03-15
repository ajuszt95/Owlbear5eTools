
async function checkMonster() {
    const source = "xmm";
    const name = "Adult Copper Dragon";
    const url = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-${source}.json`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const monster = data.monster.find(m => m.name === name);
        if (!monster) {
            console.log("Monster not found");
            return;
        }
        
        console.log("--- ACTIONS ---");
        monster.action.forEach(a => {
            console.log(`Name: ${a.name}`);
            console.log(`Entries: ${JSON.stringify(a.entries)}`);
        });
    } catch (e) {
        console.error(e);
    }
}

checkMonster();
