import { describe, it, expect, vi, beforeEach } from 'vitest';
import OBR from '@owlbear-rodeo/sdk';
import { INITIATIVE_METADATA_KEY } from './Background';
import {
    dexModifier,
    sanitizeDicePlusLabel,
    initiativeNotation,
    initiativeTiebreakTotal,
    rollInitiativeBasic,
    writeInitiative,
} from './initiative';

vi.mock('@owlbear-rodeo/sdk', () => {
    const mockGetItems = vi.fn();
    const mockUpdateItems = vi.fn();
    return {
        default: {
            scene: {
                items: {
                    getItems: mockGetItems,
                    updateItems: mockUpdateItems,
                },
            },
        },
    };
});

const mockedGetItems = OBR.scene.items.getItems as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateItems = OBR.scene.items.updateItems as unknown as ReturnType<typeof vi.fn>;

function itemWithMetadata(metadata: Record<string, unknown>) {
    return { id: 'token-1', name: 'Goblin', metadata: { ...metadata } };
}

describe('initiative.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('dexModifier', () => {
        it.each([
            [1, -5],
            [8, -1],
            [10, 0],
            [11, 0],
            [14, 2],
            [20, 5],
            [30, 10],
        ])('DEX %i → %+i', (dex, expected) => {
            expect(dexModifier(dex)).toBe(expected);
        });

        it('returns +0 when DEX is missing', () => {
            expect(dexModifier(undefined)).toBe(0);
        });
    });

    describe('sanitizeDicePlusLabel', () => {
        it('leaves plain names untouched', () => {
            expect(sanitizeDicePlusLabel('Goblin')).toBe('Goblin');
        });

        it('strips forbidden chars + - * / , ( ) #', () => {
            expect(sanitizeDicePlusLabel('Goblin (Boss), #1 +2/-3 *elite*')).toBe('Goblin Boss 1 23 elite');
        });

        it('trims and collapses whitespace', () => {
            expect(sanitizeDicePlusLabel('  Young   Red  Dragon  ')).toBe('Young Red Dragon');
        });

        it('returns empty string for empty input', () => {
            expect(sanitizeDicePlusLabel('')).toBe('');
        });
    });

    describe('initiativeNotation', () => {
        it('builds 1d20+2 with label', () => {
            expect(initiativeNotation(2, 'Goblin')).toBe('1d20+2 # Initiative Goblin');
        });

        it('includes explicit +0 for DEX 10–11 (Dice+ needs the operator to split the label)', () => {
            expect(initiativeNotation(0, 'Goblin')).toBe('1d20+0 # Initiative Goblin');
        });

        it('uses -X for negative mods', () => {
            expect(initiativeNotation(-1, 'Goblin')).toBe('1d20-1 # Initiative Goblin');
        });

        it('sanitizes the monster name', () => {
            expect(initiativeNotation(1, 'Goblin (Boss)')).toBe('1d20+1 # Initiative Goblin Boss');
        });

        it('falls back to bare # Initiative when name sanitizes to empty', () => {
            expect(initiativeNotation(0, '')).toBe('1d20+0 # Initiative');
        });
    });

    describe('initiativeTiebreakTotal', () => {
        it('appends +4 as .4 (15+4 roll → 19.4)', () => {
            expect(initiativeTiebreakTotal(19, 4)).toBe(19.4);
        });

        it('leaves mod +0 as a plain integer', () => {
            expect(initiativeTiebreakTotal(15, 0)).toBe(15);
        });

        it('handles negative mods (9 total, -1 → 8.9)', () => {
            expect(initiativeTiebreakTotal(9, -1)).toBe(8.9);
        });

        it('avoids float artifacts (12 total, +3 → 12.3)', () => {
            expect(initiativeTiebreakTotal(12, 3)).toBe(12.3);
        });
    });

    describe('rollInitiativeBasic', () => {
        it('rolls 1d20+2 deterministically via injected roller', () => {
            const result = rollInitiativeBasic({ dex: 14, name: 'Goblin' }, undefined, () => 13);
            expect(result.total).toBe(15);
            expect(result.modifier).toBe(2);
            expect(result.formattedText).toContain('13 (1d20) + 2 = 15');
        });

        it('defaults missing DEX to plain 1d20', () => {
            const result = rollInitiativeBasic({ name: 'Goblin' }, undefined, () => 11);
            expect(result.total).toBe(11);
            expect(result.formattedText).toBe('Initiative \u2014 Goblin: 11 (1d20) = 11');
        });

        it('rolls 1d20-1 for DEX 8', () => {
            const result = rollInitiativeBasic({ dex: 8, name: 'Goblin' }, undefined, () => 10);
            expect(result.total).toBe(9);
        });

        it('prefers _displayName in the default label', () => {
            const result = rollInitiativeBasic(
                { dex: 10, name: 'Giant Squid', _displayName: 'Giant Squid (CR 9)' },
                undefined,
                () => 7
            );
            expect(result.formattedText.startsWith('Initiative \u2014 Giant Squid (CR 9):')).toBe(true);
        });
    });

    describe('writeInitiative', () => {
        it('writes count as string with active:false when absent', async () => {
            mockedGetItems.mockResolvedValueOnce([itemWithMetadata({})]);
            mockedUpdateItems.mockImplementationOnce(async (_ids: string[], updater: (draft: { metadata: Record<string, unknown> }[]) => void) => {
                const draft = [itemWithMetadata({})];
                updater(draft);
                expect(draft[0].metadata[INITIATIVE_METADATA_KEY]).toEqual({ count: '15', active: false });
            });

            const res = await writeInitiative('token-1', 15, { overwrite: false });
            expect(res).toEqual({ written: true, previous: undefined });
            expect(mockedUpdateItems).toHaveBeenCalledTimes(1);
        });

        it('refuses to overwrite without the flag and leaves the old value intact', async () => {
            mockedGetItems.mockResolvedValueOnce([
                itemWithMetadata({ [INITIATIVE_METADATA_KEY]: { count: '12', active: false } }),
            ]);

            const res = await writeInitiative('token-1', 18, { overwrite: false });
            expect(res).toEqual({ written: false, previous: '12' });
            expect(mockedUpdateItems).not.toHaveBeenCalled();
        });

        it('overwrites with the flag and reports the previous value', async () => {
            mockedGetItems.mockResolvedValueOnce([
                itemWithMetadata({ [INITIATIVE_METADATA_KEY]: { count: '12', active: false } }),
            ]);
            mockedUpdateItems.mockImplementationOnce(async (_ids: string[], updater: (draft: { metadata: Record<string, unknown> }[]) => void) => {
                const draft = [itemWithMetadata({ [INITIATIVE_METADATA_KEY]: { count: '12', active: false } })];
                updater(draft);
                expect(draft[0].metadata[INITIATIVE_METADATA_KEY]).toEqual({ count: '18', active: false });
            });

            const res = await writeInitiative('token-1', 18, { overwrite: true });
            expect(res).toEqual({ written: true, previous: '12' });
            expect(mockedUpdateItems).toHaveBeenCalledTimes(1);
        });

        it('preserves sibling metadata keys', async () => {
            const siblings = {
                'com.ajuszt95.5etools/monster': { name: 'Goblin' },
                'com.owlbear-rodeo-bubbles-extension/metadata': { health: 7 },
            };
            mockedGetItems.mockResolvedValueOnce([itemWithMetadata({ ...siblings })]);
            mockedUpdateItems.mockImplementationOnce(async (_ids: string[], updater: (draft: { metadata: Record<string, unknown> }[]) => void) => {
                const draft = [itemWithMetadata({ ...siblings })];
                updater(draft);
                expect(draft[0].metadata['com.ajuszt95.5etools/monster']).toEqual({ name: 'Goblin' });
                expect(draft[0].metadata['com.owlbear-rodeo-bubbles-extension/metadata']).toEqual({ health: 7 });
                expect(draft[0].metadata[INITIATIVE_METADATA_KEY]).toEqual({ count: '9', active: false });
            });

            await writeInitiative('token-1', 9, { overwrite: false });
        });

        it('throws when the token is not found', async () => {
            mockedGetItems.mockResolvedValueOnce([]);
            await expect(writeInitiative('missing', 10, { overwrite: false })).rejects.toThrow('Token not found.');
        });
    });
});
