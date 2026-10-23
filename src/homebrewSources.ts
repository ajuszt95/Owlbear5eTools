/**
 * Partnered (non-WotC) 5e.tools sources that ship monster data in the
 * community homebrew repository rather than in the WotC-only mirror.
 *
 * 5e.tools' build places partnered books under
 * `TheGiddyLimit/homebrew`, and their tokens under
 * `TheGiddyLimit/homebrew-img`. This map lets `fetchMonsterByIdentity`
 * route a URL import to the correct file.
 *
 * Keys are the lowercase 5e.tools source ids used in bestiary URLs (the
 * last `_`-segment). Values are repo-relative paths in
 * `TheGiddyLimit/homebrew`.
 *
 * To refresh this list, fetch the repo's `_generated/index-meta.json` and
 * `_generated/index-props.json`, keep entries where `meta.p === 1` (partnered)
 * and `props.monster` contains the file, then use each file's monster
 * `source` value (lowercased) as the key.
 */
export const PARTNERED_HOMEBREW_SOURCES: Readonly<Record<string, string>> = {
    "dodksearchsmugglerssecrets": "adventure/Ghostfire Gaming; Dungeons of Drakkenheim In Search of the Smuggler's Secrets.json",
    "northlandssagas": "adventure/Kobold Press; Northlands Sagas.json",
    "maladyofminarrh": "adventure/Road to Ithaka Press; The Malady of Minarrh.json",
    "oneshotwondersholidaypack": "adventure/Roll & Play Press; One Shot Wonders - Holiday Adventure Pack.json",
    "pugilist2024": "class/Benjamin Huffman; The Pugilist - 2024.json",
    "illriggerrevised": "class/MCDM Productions; The Illrigger Revised.json",
    "crookedmoon24": "collection/Avantris; Crooked Moon.json",
    "cthulhutorchlight": "collection/Chaosium Inc.; Cthulhu by Torchlight.json",
    "dndbeyonddrops": "collection/D&D Beyond; D&D Beyond Drops.json",
    "taldoreicampaignsettingreborn": "collection/Darrington Press; Tal'Dorei Campaign Setting Reborn.json",
    "tlotrr": "collection/Free League; The Lord of the Rings Roleplaying.json",
    "dungeonsdrakkenheim": "collection/Ghostfire Gaming; Dungeons of Drakkenheim.json",
    "grimhollowcg24": "collection/Ghostfire Gaming; Grim Hollow - Campaign Guide - 2024.json",
    "grimhollowlairsetharis": "collection/Ghostfire Gaming; Grim Hollow - Lairs of Etharis.json",
    "grimhollowpg24": "collection/Ghostfire Gaming; Grim Hollow - Player's Guide - 2024.json",
    "monstersofdrakkenheim": "collection/Ghostfire Gaming; Monsters of Drakkenheim.json",
    "boundbyblood": "collection/Ghostfire Gaming; Vampire - The Masquerade - Bound by Blood.json",
    "24griffonssaddlebag1": "collection/Griffin Macaulay; The Griffon's Saddlebag, Book 1 - 2024.json",
    "griffonssaddlebag2": "collection/Griffin Macaulay; The Griffon's Saddlebag, Book 2.json",
    "humblewoodcampaignsetting": "collection/Hit Point Press; Humblewood Campaign Setting.json",
    "humblewoodtales": "collection/Hit Point Press; Humblewood Tales.json",
    "fgofd24": "collection/Hit Point Press; The Field Guide to Floral Dragons.json",
    "exploringeberron24": "collection/Keith Baker; Exploring Eberron - 2024.json",
    "foequickstone": "collection/Keith Baker; Frontiers of Eberron Quickstone.json",
    "bookofebontides": "collection/Kobold Press; Book of Ebon Tides.json",
    "northlandsworldbook": "collection/Kobold Press; Northlands Worldbook.json",
    "talesfromtheshadows": "collection/Kobold Press; Tales from the Shadows.json",
    "helianasguidetomonsterhunting": "collection/Loot Tavern; Heliana's Guide To Monster Hunting.json",
    "valdaplayerpack2": "collection/Mage Hand Press; Valda's Spire of Secrets - Player Pack 2.json",
    "whereevillives": "collection/MCDM Productions; Where Evil Lives.json",
    "tob1-2023": "creature/Kobold Press; Tome of Beasts 1 (2023 Edition).json",
    "fleemortals": "creature/MCDM Productions; Flee, Mortals!.json",
};

const HOMEBREW_RAW_BASE = "https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master";

/**
 * Returns the raw GitHub URL for a partnered source's book data, or
 * `undefined` when the source is not partnered (i.e. lives in the
 * official WotC mirror).
 */
export function getPartneredHomebrewUrl(source: string): string | undefined {
    const path = PARTNERED_HOMEBREW_SOURCES[source.trim().toLowerCase()];
    if (!path) return undefined;
    return `${HOMEBREW_RAW_BASE}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
