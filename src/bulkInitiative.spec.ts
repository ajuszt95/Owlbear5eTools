import { describe, it, expect, vi, beforeEach } from 'vitest';
import OBR from '@owlbear-rodeo/sdk';
import { METADATA_KEY, INITIATIVE_METADATA_KEY } from './Background';
import {
    collectMonsterTokens,
    eligibleForRun,
    hasLair,
    mergeCheckedIds,
    readExistingCounts,
    runBulkInitiative,
    type BulkToken,
} from './bulkInitiative';

vi.mock('@owlbear-rodeo/sdk', () => {
    return {
        default: {
            scene: {
                items: {
                    getItems: vi.fn(),
                    updateItems: vi.fn().mockResolvedValue(undefined),
                },
            },
            broadcast: {
                sendMessage: vi.fn().mockResolvedValue(undefined),
                onMessage: vi.fn().mockReturnValue(vi.fn()),
            },
            player: {
                getName: vi.fn().mockResolvedValue('DM'),
                getId: vi.fn().mockResolvedValue('player-1'),
            },
        },
    };
});

const mockedGetItems = OBR.scene.items.getItems as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateItems = OBR.scene.items.updateItems as unknown as ReturnType<typeof vi.fn>;
const mockedSendMessage = OBR.broadcast.sendMessage as unknown as ReturnType<typeof vi.fn>;
const mockedOnMessage = OBR.broadcast.onMessage as unknown as ReturnType<typeof vi.fn>;

function monsterItem(id: string, name: string, monster: Record<string, unknown>, extraMetadata: Record<string, unknown> = {}) {
    return { id, name, metadata: { [METADATA_KEY]: monster, ...extraMetadata } };
}

function goblinToken(id: string, name = 'Goblin'): BulkToken {
    return { id, name, monster: { name: 'Goblin', source: 'MM', dex: 14 } as never };
}

describe('bulkInitiative.ts', () => {
    beforeEach(() => {
        // reset (not clear): answerDicePlus-style implementations must not
        // leak between tests; factory defaults are re-applied below.
        vi.resetAllMocks();
        mockedGetItems.mockImplementation((ids: string[]) =>
            Promise.resolve(ids.map((id) => ({ id, name: id, metadata: {} })))
        );
        mockedUpdateItems.mockResolvedValue(undefined);
        mockedSendMessage.mockResolvedValue(undefined);
        mockedOnMessage.mockReturnValue(vi.fn());
        (OBR.player.getName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('DM');
        (OBR.player.getId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('player-1');
    });

    describe('collectMonsterTokens', () => {
        it('keeps only items carrying monster metadata', () => {
            const items = [
                monsterItem('t1', 'Goblin 1', { name: 'Goblin', dex: 14 }),
                { id: 't2', name: 'Fighter (player)', metadata: {} },
                { id: 't3', name: 'Map', metadata: {} },
                monsterItem('t4', 'Ogre', { name: 'Ogre', _displayName: 'Ogre (buffed)', dex: 8 }),
            ];
            const out = collectMonsterTokens(items as never);
            expect(out.map((t) => t.id)).toEqual(['t1', 't4']);
            expect(out[0].name).toBe('Goblin 1');
            expect(out[1].name).toBe('Ogre');
        });

        it('falls back to the item name when the monster is nameless', () => {
            const out = collectMonsterTokens([monsterItem('t1', 'Weird Token', {})] as never);
            expect(out[0].name).toBe('Weird Token');
        });
    });

    describe('eligibleForRun', () => {
        it('respects unchecks and preserves candidate order', () => {
            const candidates = [goblinToken('a'), goblinToken('b'), goblinToken('c')];
            expect(eligibleForRun(candidates, new Set(['c', 'a'])).map((t) => t.id)).toEqual(['a', 'c']);
            expect(eligibleForRun(candidates, new Set())).toEqual([]);
        });
    });

    describe('mergeCheckedIds', () => {
        it('checks everything on first load', () => {
            expect(mergeCheckedIds(new Set(), new Set(), ['a', 'b'])).toEqual(new Set(['a', 'b']));
        });

        it('preserves unchecks, checks newcomers, drops the vanished', () => {
            // DM unchecked the stray Fighter (f); goblin c is new, a is gone.
            expect(
                mergeCheckedIds(new Set(['g1', 'g2']), new Set(['g1', 'g2', 'f']), ['g1', 'g2', 'f', 'c'])
            ).toEqual(new Set(['g1', 'g2', 'c']));
        });
    });

    describe('hasLair', () => {
        it('flags legendaryGroup presence only', () => {
            expect(hasLair(goblinToken('a'))).toBe(false);
            expect(
                hasLair({ id: 'd', name: 'Dragon', monster: { name: 'X', legendaryGroup: { name: 'Red Dragon', source: 'MM' } } as never })
            ).toBe(true);
        });
    });

    describe('readExistingCounts', () => {
        it('treats non-empty counts as occupied, ""/missing as free, in one call', async () => {
            mockedGetItems.mockResolvedValue([
                { id: 'a', name: 'A', metadata: { [INITIATIVE_METADATA_KEY]: { count: '14', active: false } } },
                { id: 'b', name: 'B', metadata: { [INITIATIVE_METADATA_KEY]: { count: '', active: false } } },
                { id: 'c', name: 'C', metadata: {} },
            ]);
            const map = await readExistingCounts(['a', 'b', 'c']);
            expect(mockedGetItems).toHaveBeenCalledTimes(1);
            expect(mockedGetItems).toHaveBeenCalledWith(['a', 'b', 'c']);
            expect(map.get('a')).toBe('14');
            expect(map.get('b')).toBeUndefined();
            expect(map.get('c')).toBeUndefined();
        });
    });

    describe('runBulkInitiative (basic engine)', () => {
        it('writes string counts with active:false for fresh tokens', async () => {
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a', 'Goblin 1'), goblinToken('b', 'Goblin 2')],
                overwrite: false,
                existing: new Map([['a', undefined], ['b', undefined]]),
                ctx: { engine: 'basic', rollTarget: 'everyone', advantage: 'normal' },
            });
            expect(rows).toHaveLength(2);
            expect(rows.every((r) => r.status === 'written')).toBe(true);
            // Basic rolls are local by definition — no (local) marker noise.
            expect(rows.every((r) => r.local === undefined)).toBe(true);
            expect(mockedUpdateItems).toHaveBeenCalledTimes(2);
            for (const call of mockedUpdateItems.mock.calls) {
                expect(call[0]).toHaveLength(1);
            }
            expect(mockedSendMessage).not.toHaveBeenCalled();
        });

        it('skip mode leaves occupied tokens untouched and marks them skipped', async () => {
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a'), goblinToken('b')],
                overwrite: false,
                existing: new Map([['a', '18'], ['b', undefined]]),
                ctx: { engine: 'basic', rollTarget: 'everyone', advantage: 'normal' },
            });
            expect(rows[0]).toMatchObject({ status: 'skipped', previous: '18' });
            expect(rows[1].status).toBe('written');
            expect(mockedUpdateItems).toHaveBeenCalledTimes(1);
            expect(mockedUpdateItems.mock.calls[0][0]).toEqual(['b']);
        });

        it('overwrite mode rewrites occupied tokens', async () => {
            mockedGetItems.mockResolvedValue([
                { id: 'a', name: 'a', metadata: { [INITIATIVE_METADATA_KEY]: { count: '18', active: false } } },
            ]);
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a')],
                overwrite: true,
                existing: new Map([['a', '18']]),
                ctx: { engine: 'basic', rollTarget: 'everyone', advantage: 'normal' },
            });
            expect(rows[0]).toMatchObject({ status: 'written', previous: '18' });
            expect(mockedUpdateItems).toHaveBeenCalledTimes(1);
        });

        it('marks lair tokens without extra writes', async () => {
            const dragon: BulkToken = {
                id: 'd', name: 'Dragon',
                monster: { name: 'X', dex: 10, legendaryGroup: { name: 'Red Dragon', source: 'MM' } } as never,
            };
            const rows = await runBulkInitiative({
                tokens: [dragon],
                overwrite: false,
                existing: new Map([['d', undefined]]),
                ctx: { engine: 'basic', rollTarget: 'everyone', advantage: 'normal' },
            });
            expect(rows[0].lair).toBe(true);
            expect(mockedUpdateItems).toHaveBeenCalledTimes(1);
        });

        it('collects per-token failures without aborting the run', async () => {
            mockedGetItems.mockImplementation((ids: string[]) => {
                if (ids.includes('gone')) return Promise.resolve([]);
                return Promise.resolve(ids.map((id) => ({ id, name: id, metadata: {} })));
            });
            const rows = await runBulkInitiative({
                tokens: [goblinToken('gone'), goblinToken('b')],
                overwrite: false,
                existing: new Map([['gone', undefined], ['b', undefined]]),
                ctx: { engine: 'basic', rollTarget: 'everyone', advantage: 'normal' },
            });
            expect(rows[0]).toMatchObject({ status: 'failed' });
            expect(rows[0].error).toContain('Token not found');
            expect(rows[1].status).toBe('written');
        });
    });

    describe('rollOneToken / runBulkInitiative (dice-plus engine)', () => {
        function answerDicePlus(totalValue: number) {
            const handlers: Array<(event: unknown) => void> = [];
            mockedOnMessage.mockImplementation((_channel: string, handler: (event: unknown) => void) => {
                handlers.push(handler);
                return vi.fn();
            });
            mockedSendMessage.mockImplementation((channel: string, payload: { rollId?: string }) => {
                if (channel === 'dice-plus/roll-request' && payload?.rollId) {
                    const rid = payload.rollId;
                    for (const h of handlers) {
                        h({ rollId: rid, result: { totalValue } });
                    }
                }
                return Promise.resolve();
            });
        }

        it('announces pending before the request and settles after the write', async () => {
            answerDicePlus(15);
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a', 'Goblin 1')],
                overwrite: false,
                existing: new Map([['a', undefined]]),
                ctx: { engine: 'dice-plus', rollTarget: 'everyone', advantage: 'normal', interRollGapMs: 0 },
            });
            // Goblin DEX 14 -> mod +2: 15 -> tiebreak 15.2
            expect(rows[0]).toMatchObject({ status: 'written', total: 15.2 });

            const channels = mockedSendMessage.mock.calls.map((c) => c[0]);
            expect(channels).toEqual([
                expect.stringContaining('initiative-pending'),
                'dice-plus/roll-request',
                expect.stringContaining('initiative-settled'),
            ]);
            const order = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
            const pendingOrder = order(mockedSendMessage);
            expect(pendingOrder).toBeLessThan(order(mockedUpdateItems));
            expect(order(mockedUpdateItems)).toBeLessThan(
                mockedSendMessage.mock.invocationCallOrder[mockedSendMessage.mock.invocationCallOrder.length - 1]
            );

            const requestPayload = mockedSendMessage.mock.calls[1][1] as Record<string, unknown>;
            expect(requestPayload.diceNotation).toBe('1d20+2 # Initiative Goblin 1');
            expect(requestPayload.rollTarget).toBe('everyone');
        });

        it('falls back to a local roll on Dice+ timeout and still settles', async () => {
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a'), goblinToken('b')],
                overwrite: false,
                existing: new Map([['a', undefined], ['b', undefined]]),
                ctx: { engine: 'dice-plus', rollTarget: 'everyone', advantage: 'normal', dicePlusTimeoutMs: 20, interRollGapMs: 0 },
            });
            expect(rows[0]).toMatchObject({ status: 'written', local: true });
            expect(rows[1].status).toBe('written');
            const channels = mockedSendMessage.mock.calls.map((c) => c[0]);
            expect(channels.filter((c) => String(c).includes('initiative-pending'))).toHaveLength(2);
            expect(channels.filter((c) => String(c).includes('initiative-settled'))).toHaveLength(2);
        });

        it('uses a fresh roll id per token, sequentially', async () => {
            answerDicePlus(10);
            await runBulkInitiative({
                tokens: [goblinToken('a'), goblinToken('b')],
                overwrite: false,
                existing: new Map([['a', undefined], ['b', undefined]]),
                ctx: { engine: 'dice-plus', rollTarget: 'everyone', advantage: 'normal', interRollGapMs: 0 },
            });
            const requests = mockedSendMessage.mock.calls.filter((c) => c[0] === 'dice-plus/roll-request');
            expect(requests).toHaveLength(2);
            expect(requests[0][1].rollId).not.toBe(requests[1][1].rollId);
            expect(String(requests[0][1].rollId).startsWith('init_')).toBe(true);
        });

        it('settles the safety net even when the write throws after a good roll', async () => {
            answerDicePlus(15);
            mockedUpdateItems.mockRejectedValueOnce(new Error('scene locked'));
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a')],
                overwrite: false,
                existing: new Map([['a', undefined]]),
                ctx: { engine: 'dice-plus', rollTarget: 'everyone', advantage: 'normal', interRollGapMs: 0 },
            });
            expect(rows[0]).toMatchObject({ status: 'failed' });
            const channels = mockedSendMessage.mock.calls.map((c) => c[0]);
            expect(channels.filter((c) => String(c).includes('initiative-settled'))).toHaveLength(1);
        });

        it('settles the safety net even when the broadcast throws', async () => {
            mockedSendMessage.mockImplementation((channel: string) => {
                if (channel === 'dice-plus/roll-request') {
                    return Promise.reject(new Error('broadcast down'));
                }
                return Promise.resolve();
            });
            const rows = await runBulkInitiative({
                tokens: [goblinToken('a')],
                overwrite: false,
                existing: new Map([['a', undefined]]),
                ctx: { engine: 'dice-plus', rollTarget: 'everyone', advantage: 'normal', dicePlusTimeoutMs: 20, interRollGapMs: 0 },
            });
            expect(rows[0].status).toBe('failed');
            const channels = mockedSendMessage.mock.calls.map((c) => c[0]);
            expect(channels.filter((c) => String(c).includes('initiative-settled'))).toHaveLength(1);
        });
    });
});
