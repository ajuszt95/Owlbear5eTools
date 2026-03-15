
async function checkMonster() {
    const source = "ftd";
    const name = "Adult Topaz Dragon";
    const url = `https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-${source}.json`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const monster = data.monster.find(m => m.name === name);
        if (!monster) {
            console.log("Monster not found");
            return;
        }
        
        const monsterStr = JSON.stringify(monster);
        const tagsWithContent = [];
        const matches = monsterStr.matchAll(/{@(\w+)(?:\s+([^}]+))?}/g);
        for (const match of matches) {
            tagsWithContent.push(`${match[1]}${match[2] ? ' ' + match[2] : ''}`);
        }
        console.log("--- TAGS WITH CONTENT IN TOPAZ ---");
        console.log(tagsWithContent.join("\n"));
    } catch (e) {
        console.error(e);
    }
}

checkMonster();
