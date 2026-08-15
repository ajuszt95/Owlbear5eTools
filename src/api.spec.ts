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
