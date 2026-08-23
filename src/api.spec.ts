import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    calculateTokenUrl,
    getMonsterDimensions,
    extractAC,
    extractHP,
    fetchMonsterData,
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
});
