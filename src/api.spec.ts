import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    calculateTokenUrl,
    getMonsterDimensions,
    extractAC,
    extractHP,
    fetchMonsterData,
    fetchMonsterByIdentity,
    buildCanonicalSourceUrl,
    getOfficialBestiaryFilename,
    type Monster,
} from './api';

describe('api.ts', () => {
    describe('calculateTokenUrl', () => {
        it('should generate correct token URL for normal case', () => {
            const result = calculateTokenUrl('Abyssal Hyena', 'whereevilives');
            expect(result).toBe(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/whereevilives/Abyssal%20Hyena.webp'
            );
        });

        it('should handle names with spaces', () => {
            const result = calculateTokenUrl('Green Dragon Ape', 'voloards');
            expect(result).toContain('Green%20Dragon%20Ape');
        });

        it('should handle names with special characters', () => {
            const result = calculateTokenUrl("O'Brien", 'mordenkainen');
            expect(result).toContain("O'Brien.webp");
        });

        it('should use correct GitHub image base URL', () => {
            expect(calculateTokenUrl('Test', 'test')).toContain('5etools-mirror-3');
        });
    });

    describe('getOfficialBestiaryFilename', () => {
        it.each([
            ['PSA', 'bestiary-ps-a.json'],
            ['PSD', 'bestiary-ps-d.json'],
            ['PSI', 'bestiary-ps-i.json'],
            ['PSK', 'bestiary-ps-k.json'],
            ['PSX', 'bestiary-ps-x.json'],
            ['PSZ', 'bestiary-ps-z.json'],
        ])('maps %s to the hyphenated mirror filename', (source, filename) => {
            expect(getOfficialBestiaryFilename(source)).toBe(filename);
        });

        it('uses the lowercased source for every other official book', () => {
            expect(getOfficialBestiaryFilename('MM')).toBe('bestiary-mm.json');
            expect(getOfficialBestiaryFilename('XMM')).toBe('bestiary-xmm.json');
            expect(getOfficialBestiaryFilename(' VGM ')).toBe('bestiary-vgm.json');
        });
    });

    describe('getMonsterDimensions', () => {
        it('should return multiplier for Tiny (T) size', () => {
            expect(getMonsterDimensions(['T'])).toEqual({ multiplier: 0.5 });
        });

        it('should return multiplier for Small (S) size', () => {
            expect(getMonsterDimensions(['S'])).toEqual({ multiplier: 0.8 });
        });

        it('should return multiplier for Medium (M) size', () => {
            expect(getMonsterDimensions(['M'])).toEqual({ multiplier: 1 });
        });

        it('should return multiplier for Large (L) size', () => {
            expect(getMonsterDimensions(['L'])).toEqual({ multiplier: 2 });
        });

        it('should return multiplier for Huge (H) size', () => {
            expect(getMonsterDimensions(['H'])).toEqual({ multiplier: 3 });
        });

        it('should return multiplier for Gargantuan (G) size', () => {
            expect(getMonsterDimensions(['G'])).toEqual({ multiplier: 4 });
        });

        it('should default to Medium (M) multiplier for undefined size', () => {
            expect(getMonsterDimensions()).toEqual({ multiplier: 1 });
        });

        it('should default to Medium (M) multiplier for empty array', () => {
            expect(getMonsterDimensions([])).toEqual({ multiplier: 1 });
        });
    });

    describe('extractAC', () => {
        it('should return 10 for undefined ac', () => {
            expect(extractAC({ name: 'Test', source: 'MM', ac: undefined })).toBe(10);
        });

        it('should return 10 for empty ac array', () => {
            expect(extractAC({ name: 'Test', source: 'MM', ac: [] })).toBe(10);
        });

        it('should extract numeric AC value', () => {
            expect(extractAC({ name: 'Skeleton', source: 'MM', ac: [15] })).toBe(15);
        });

        it('should extract nested AC object property', () => {
            expect(extractAC({ name: 'Hippogriff', source: 'MM', ac: [{ ac: 16 }] })).toBe(16);
        });
    });

    describe('extractHP', () => {
        it('should return 10 for undefined hp', () => {
            expect(extractHP({ name: 'Test', source: 'MM', hp: undefined })).toBe(10);
        });

        it('should return average HP when available', () => {
            expect(extractHP({ name: 'Goblin', source: 'MM', hp: { average: 7 } })).toBe(7);
        });
    });

    describe('fetchMonsterData', () => {
        const originalFetch = global.fetch;

        beforeEach(() => {
            global.fetch = vi.fn();
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it('should parse URL and fetch matching monster from GitHub bestiary', async () => {
            const mockMonster: Monster = {
                name: 'Goblin',
                source: 'MM',
                hp: { average: 7 },
                ac: [15],
                size: ['S'],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#goblin_mm');
            expect(result.name).toBe('Goblin');
            expect(result.source).toBe('MM');
            expect(result.tokenUrl).toContain('Goblin.webp');
        });

        it('should parse scaled:CR sub-hash and scale monster', async () => {
            const mockSquid: Monster = {
                name: 'Giant Squid',
                source: 'XMM',
                cr: '6',
                hp: { average: 120, formula: '16d10 + 32' },
                ac: [11],
                str: 21,
                dex: 11,
                con: 15,
                action: [
                    {
                        name: 'Bite',
                        entries: ['{@atk mw} {@hit 8} to hit. {@h}23 (4d8 + 5) piercing damage.']
                    }
                ]
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockSquid] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#giant%20squid_xmm,scaled:9');
            expect(result._isScaledCr).toBe(true);
            expect(result._scaledCr).toBe(9);
            expect(result.cr).toBe('9');
            expect(result._displayName).toBe('Giant Squid (CR 9)');
            expect(result.hp?.average).toBeGreaterThan(120);
        });

        it('should ignore other sub-hashes like scaledspellsummon without crashing', async () => {
            const mockMonster: Monster = {
                name: 'Goblin',
                source: 'MM',
                cr: '1/4',
                hp: { average: 7, formula: '2d6' },
                ac: [15],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#goblin_mm,scaledspellsummon:3');
            expect(result.name).toBe('Goblin');
            expect(result._isScaledCr).toBeUndefined();
        });

        it('should parse query params with scaled hash correctly', async () => {
            const mockMonster: Monster = {
                name: 'Goblin',
                source: 'MM',
                cr: '1/4',
                hp: { average: 7, formula: '2d6' },
                ac: [15],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html?source=MM&hash=goblin_mm,scaled:2');
            expect(result._isScaledCr).toBe(true);
            expect(result._scaledCr).toBe(2);
            expect(result.cr).toBe('2');
        });

        it('should fetch partnered homebrew data for Tome of Beasts 1 (2023)', async () => {
            const rawTokenHref = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/img/ToB1-2023/bestiary/tokens/Swarm of Prismatic Beetles.webp';
            const encodedTokenHref = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew-img/main/img/ToB1-2023/bestiary/tokens/Swarm%20of%20Prismatic%20Beetles.webp';
            const mockMonster: Monster = {
                name: 'Swarm of Prismatic Beetles',
                source: 'ToB1-2023',
                hp: { average: 60 },
                ac: [13],
                size: ['M'],
                tokenHref: { type: 'external', url: rawTokenHref },
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#swarm%20of%20prismatic%20beetles_tob1-2023');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/creature/Kobold%20Press%3B%20Tome%20of%20Beasts%201%20(2023%20Edition).json'
            );
            expect(result.name).toBe('Swarm of Prismatic Beetles');
            expect(result.source).toBe('ToB1-2023');
            expect(result.tokenUrl).toBe(encodedTokenHref);
        });

        it('should not synthesize an official image URL for partnered monsters without a token', async () => {
            const mockMonster: Monster = {
                name: 'Agent (Shadowmaster)',
                source: 'IllriggerRevised',
                hp: { average: 30 },
                ac: [14],
                size: ['M'],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#agent%20(shadowmaster)_illriggerrevised');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/class/MCDM%20Productions%3B%20The%20Illrigger%20Revised.json'
            );
            expect(result.tokenUrl).toBeUndefined();
        });

        it('should keep using the official mirror for WotC sources', async () => {
            const mockMonster: Monster = {
                name: 'Goblin',
                source: 'MM',
                hp: { average: 7 },
                ac: [15],
                size: ['S'],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#goblin_mm');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-mm.json'
            );
            expect(result.tokenUrl).toBe(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/MM/Goblin.webp'
            );
        });

        it('should resolve a Plane Shift _copy entry from the base book', async () => {
            const baseDragon: Monster = {
                name: 'Adult Red Dragon',
                source: 'MM',
                cr: '17',
                hp: { average: 256, formula: '19d12 + 133' },
                ac: [19],
                size: ['H'],
                str: 27,
                dex: 10,
                con: 25,
                int: 16,
                wis: 13,
                cha: 21,
                action: [
                    { name: 'Multiattack', entries: ['The dragon can use its Frightful Presence.'] },
                    { name: 'Bite', entries: ['{@atk mw} {@hit 14} to hit. {@h}19 (2d10 + 8) piercing damage.'] },
                ],
            };
            const copyMonster: Monster = {
                name: 'Adult Amonkhet Dragon',
                source: 'PSA',
                _copy: { name: 'Adult Red Dragon', source: 'MM' },
            };

            vi.mocked(global.fetch)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monster: [copyMonster] }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monster: [baseDragon] }),
                } as Response);

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#adult%20amonkhet%20dragon_psa');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-ps-a.json'
            );
            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/bestiary-mm.json'
            );
            expect(result.name).toBe('Adult Amonkhet Dragon');
            expect(result.hp).toEqual({ average: 256, formula: '19d12 + 133' });
            expect(result.ac).toEqual([19]);
            expect((result.action as any[]).map((entry) => entry.name)).toEqual(['Multiattack', 'Bite']);
            expect(result._copy).toBeUndefined();
            expect(result.tokenUrl).toBe(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main/bestiary/tokens/PSA/Adult%20Amonkhet%20Dragon.webp'
            );
        });

        it('should parse the Plane Shift path URL and resolve its _copy stat block', async () => {
            const baseDragon: Monster = {
                name: 'Adult Red Dragon',
                source: 'MM',
                cr: '17',
                hp: { average: 256, formula: '19d12 + 133' },
                ac: [19],
                size: ['H'],
                action: [{ name: 'Multiattack', entries: ['The dragon attacks.'] }],
            };
            const copyMonster: Monster = {
                name: 'Adult Amonkhet Dragon',
                source: 'PSA',
                _copy: { name: 'Adult Red Dragon', source: 'MM' },
            };

            vi.mocked(global.fetch)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monster: [copyMonster] }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monster: [baseDragon] }),
                } as Response);

            const result = await fetchMonsterData('https://5e.tools/bestiary/adult-amonkhet-dragon-psa.html');

            expect(result.name).toBe('Adult Amonkhet Dragon');
            expect(result.source).toBe('PSA');
            expect(result.hp).toEqual({ average: 256, formula: '19d12 + 133' });
            expect(result.ac).toEqual([19]);
            expect(result.sourceUrl).toBe('https://5e.tools/bestiary/adult-amonkhet-dragon-psa.html');
        });

        it('should apply a monster template when resolving a _copy entry', async () => {
            const baseScout: Monster = {
                name: 'Scout',
                source: 'MM',
                cr: '1/2',
                hp: { average: 16, formula: '3d8 + 3' },
                ac: [13],
                size: ['M'],
                type: { type: 'humanoid', tags: ['any race'] },
                speed: { walk: 30 },
                senses: [],
                languages: ['Common'],
                trait: [{ name: 'Keen Hearing and Sight', entries: ['The scout has advantage.'] }],
                action: [{ name: 'Multiattack', entries: ['The scout makes two attacks.'] }],
            };
            const copyMonster: Monster = {
                name: 'Kharbek',
                source: 'CM',
                _copy: {
                    name: 'Scout',
                    source: 'MM',
                    _templates: [{ name: 'Mountain Dwarf', source: 'PHB' }],
                },
            };
            const template = {
                name: 'Mountain Dwarf',
                source: 'PHB',
                apply: {
                    _root: { size: ['M'], speed: { walk: 25 } },
                    _mod: {
                        _: { mode: 'addSenses', senses: { type: 'darkvision', range: 60 } },
                        resist: { mode: 'appendIfNotExistsArr', items: 'poison' },
                        languages: { mode: 'appendIfNotExistsArr', items: 'Dwarvish' },
                        trait: {
                            mode: 'appendArr',
                            items: { name: 'Dwarven Resilience', entries: ['<$title_short_name$> resists poison.'] },
                        },
                    },
                },
            };

            vi.mocked(global.fetch)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monster: [copyMonster] }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monster: [baseScout] }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ monsterTemplate: [template] }),
                } as Response);

            const result = await fetchMonsterData('https://5e.tools/bestiary.html#kharbek_cm');

            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/template.json'
            );
            expect(result.hp).toEqual({ average: 16, formula: '3d8 + 3' });
            expect(result.speed).toEqual({ walk: 25 });
            expect(result.senses).toEqual(['darkvision 60 ft.']);
            expect(result.resist).toEqual(['poison']);
            expect(result.languages).toEqual(['Common', 'Dwarvish']);
            expect((result.trait as any[]).map((entry) => entry.name)).toEqual([
                'Keen Hearing and Sight',
                'Dwarven Resilience',
            ]);
            expect((result.trait as any[])[1].entries[0]).toBe('Kharbek resists poison.');
        });

        it('should throw if monster not found in list', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [] }),
            });

            await expect(
                fetchMonsterData('https://5e.tools/bestiary.html#nonexistent_mm')
            ).rejects.toThrow('No monsters found in book data for source: mm');
        });
    });

    describe('fetchMonsterByIdentity', () => {
        const originalFetch = global.fetch;

        beforeEach(() => {
            global.fetch = vi.fn();
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it('should return the same monster as fetchMonsterData for the same identity', async () => {
            const mockMonster: Monster = {
                name: 'Goblin',
                source: 'MM',
                hp: { average: 7 },
                ac: [15],
                size: ['S'],
            };

            (global.fetch as any).mockResolvedValue({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const viaUrl = await fetchMonsterData('https://5e.tools/bestiary.html#goblin_mm');
            const viaIdentity = await fetchMonsterByIdentity('Goblin', 'MM');

            expect(viaIdentity.name).toBe(viaUrl.name);
            expect(viaIdentity.source).toBe(viaUrl.source);
            expect(viaIdentity.tokenUrl).toBe(viaUrl.tokenUrl);
            // Search picks synthesize a canonical 5e.tools URL.
            expect(viaIdentity.sourceUrl).toBe(buildCanonicalSourceUrl('Goblin', 'MM'));
            expect(viaUrl.sourceUrl).toBe('https://5e.tools/bestiary.html#goblin_mm');
        });

        it('should synthesize a canonical sourceUrl when none is provided', async () => {
            const mockMonster: Monster = {
                name: 'Ancient Red Dragon',
                source: 'MM',
                hp: { average: 546 },
                ac: [22],
                size: ['G'],
            };

            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ monster: [mockMonster] }),
            });

            const result = await fetchMonsterByIdentity('Ancient Red Dragon', 'MM');
            expect(result.sourceUrl).toBe('https://5e.tools/bestiary.html#ancient%20red%20dragon_mm');
        });
    });
});
