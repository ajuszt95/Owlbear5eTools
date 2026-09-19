import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnMonster, spawnMonsterByIdentity, spawnMonsterFromData, spawnMonstersFromData, computeFormationPositions, clampSpawnCount } from './spawning';
import { METADATA_KEY, BUBBLES_NAME } from './Background';
import * as api from './api';
import OBR from '@owlbear-rodeo/sdk';

vi.mock('@owlbear-rodeo/sdk', () => {
    const mockAddItems = vi.fn().mockResolvedValue(undefined);
    const mockGetDpi = vi.fn().mockResolvedValue(150);
    const mockGetWidth = vi.fn().mockResolvedValue(1920);
    const mockGetHeight = vi.fn().mockResolvedValue(1080);
    const mockInverseTransformPoint = vi.fn().mockImplementation((pt: { x: number; y: number }) => Promise.resolve(pt));

    const imageBuilder = {
        position: vi.fn().mockReturnThis(),
        layer: vi.fn().mockReturnThis(),
        name: vi.fn().mockReturnThis(),
        metadata: vi.fn().mockReturnThis(),
        build: vi.fn().mockReturnValue({ id: 'mock-item' }),
    };

    return {
        default: {
            scene: {
                grid: { getDpi: mockGetDpi },
                items: { addItems: mockAddItems },
            },
            viewport: {
                getWidth: mockGetWidth,
                getHeight: mockGetHeight,
                inverseTransformPoint: mockInverseTransformPoint,
            },
        },
        buildImage: vi.fn().mockReturnValue(imageBuilder),
    };
});

describe('spawning.ts - spawnMonster', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch monster data and add configured image item to scene', async () => {
        vi.spyOn(api, 'fetchMonsterData').mockResolvedValueOnce({
            name: 'Owlbear',
            source: 'MM',
            hp: { average: 59 },
            ac: [13],
            size: ['L'],
            tokenUrl: 'https://example.com/owlbear.webp',
        });

        await spawnMonster('https://5e.tools/bestiary.html#owlbear_mm', 280, 280);

        expect(api.fetchMonsterData).toHaveBeenCalledWith('https://5e.tools/bestiary.html#owlbear_mm');
        expect(OBR.scene.items.addItems).toHaveBeenCalledWith([{ id: 'mock-item' }]);
    });

    it('should spawn by identity with the same scene call as the URL flow', async () => {
        vi.spyOn(api, 'fetchMonsterByIdentity').mockResolvedValueOnce({
            name: 'Owlbear',
            source: 'MM',
            hp: { average: 59 },
            ac: [13],
            size: ['L'],
            tokenUrl: 'https://example.com/owlbear.webp',
        });

        await spawnMonsterByIdentity('Owlbear', 'MM', 280, 280);

        expect(api.fetchMonsterByIdentity).toHaveBeenCalledWith('Owlbear', 'MM');
        expect(OBR.scene.items.addItems).toHaveBeenCalledWith([{ id: 'mock-item' }]);
    });

    it('spawnMonsterFromData should build the same item without fetching', async () => {
        const fetchSpy = vi.spyOn(api, 'fetchMonsterData');

        await spawnMonsterFromData({
            name: 'Owlbear',
            source: 'MM',
            hp: { average: 59 },
            ac: [13],
            size: ['L'],
            tokenUrl: 'https://example.com/owlbear.webp',
        }, 280, 280);

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(api.fetchMonsterByIdentity).not.toHaveBeenCalled();
        expect(OBR.scene.items.addItems).toHaveBeenCalledWith([{ id: 'mock-item' }]);
    });

    it('spawnMonster should fetch exactly once then delegate', async () => {
        const fetchSpy = vi.spyOn(api, 'fetchMonsterData').mockResolvedValueOnce({
            name: 'Owlbear',
            source: 'MM',
            hp: { average: 59 },
            ac: [13],
            size: ['L'],
            tokenUrl: 'https://example.com/owlbear.webp',
        });

        await spawnMonster('https://5e.tools/bestiary.html#owlbear_mm', 280, 280);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(OBR.scene.items.addItems).toHaveBeenCalledTimes(1);
    });
});

describe('spawning.ts - computeFormationPositions', () => {
    // worldSize 150 (Medium @150dpi), gap 15, centered on origin
    it('N=1 is centered identically for every formation', () => {
        const expected = [{ x: -75, y: -75 }];
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 1, 'row')).toEqual(expected);
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 1, 'grid')).toEqual(expected);
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 1, 'column')).toEqual(expected);
    });

    it('N=4 grid is a centered 2x2', () => {
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 4, 'grid')).toEqual([
            { x: -157.5, y: -157.5 },
            { x: 7.5, y: -157.5 },
            { x: -157.5, y: 7.5 },
            { x: 7.5, y: 7.5 },
        ]);
    });

    it('N=5 grid fills 3+2 row-major', () => {
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 5, 'grid')).toEqual([
            { x: -240, y: -157.5 },
            { x: -75, y: -157.5 },
            { x: 90, y: -157.5 },
            { x: -240, y: 7.5 },
            { x: -75, y: 7.5 },
        ]);
    });

    it('row lays out along one axis, centered', () => {
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 3, 'row')).toEqual([
            { x: -240, y: -75 },
            { x: -75, y: -75 },
            { x: 90, y: -75 },
        ]);
    });

    it('column lays out along one axis, centered', () => {
        expect(computeFormationPositions({ x: 0, y: 0 }, 150, 15, 3, 'column')).toEqual([
            { x: -75, y: -240 },
            { x: -75, y: -75 },
            { x: -75, y: 90 },
        ]);
    });

    it('scales with token size (Tiny 0.5x / Gargantuan 4x)', () => {
        expect(computeFormationPositions({ x: 100, y: 100 }, 75, 7.5, 1, 'grid')).toEqual([{ x: 62.5, y: 62.5 }]);
        expect(computeFormationPositions({ x: 100, y: 100 }, 600, 60, 1, 'grid')).toEqual([{ x: -200, y: -200 }]);
    });

    it('N=6 grid has no overlaps', () => {
        const positions = computeFormationPositions({ x: 500, y: 500 }, 150, 15, 6, 'grid');
        expect(positions).toHaveLength(6);
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dx = positions[i].x - positions[j].x;
                const dy = positions[i].y - positions[j].y;
                expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(150);
            }
        }
    });
});

describe('spawning.ts - clampSpawnCount', () => {
    it('clamps to 1..12', () => {
        expect(clampSpawnCount(0)).toBe(1);
        expect(clampSpawnCount(-3)).toBe(1);
        expect(clampSpawnCount(1)).toBe(1);
        expect(clampSpawnCount(6)).toBe(6);
        expect(clampSpawnCount(12)).toBe(12);
        expect(clampSpawnCount(20)).toBe(12);
        expect(clampSpawnCount(2.7)).toBe(2);
        expect(clampSpawnCount(NaN)).toBe(1);
    });
});

describe('spawning.ts - spawnMonstersFromData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const goblin = {
        name: 'Goblin',
        source: 'MM',
        hp: { average: 7 },
        ac: [15],
        size: ['S'],
        tokenUrl: 'https://example.com/goblin.webp',
    };

    it('N=1 is pixel-identical to the old single-spawn math (Large @150dpi)', async () => {
        await spawnMonstersFromData({
            name: 'Owlbear',
            source: 'MM',
            hp: { average: 59 },
            ac: [13],
            size: ['L'],
            tokenUrl: 'https://example.com/owlbear.webp',
        }, 280, 280, 1, 'row');

        // viewport 1920x1080 identity transform -> center {960,540};
        // Large multiplier 2 -> worldSize 300 -> top-left {810,390}
        const { buildImage } = await import('@owlbear-rodeo/sdk');
        expect(vi.mocked(buildImage).mock.results[0].value.position).toHaveBeenCalledWith({ x: 810, y: 390 });
        expect(vi.mocked(buildImage).mock.results[0].value.name).toHaveBeenCalledWith('Owlbear');
        expect(OBR.scene.items.addItems).toHaveBeenCalledTimes(1);
        expect(vi.mocked(OBR.scene.items.addItems).mock.calls[0][0]).toHaveLength(1);
    });

    it('N=4 grid spawns 4 numbered tokens in a single addItems call', async () => {
        const ids = await spawnMonstersFromData(goblin, 280, 280, 4, 'grid');

        expect(ids).toHaveLength(4);
        expect(OBR.scene.items.addItems).toHaveBeenCalledTimes(1);
        expect(vi.mocked(OBR.scene.items.addItems).mock.calls[0][0]).toHaveLength(4);

        const { buildImage } = await import('@owlbear-rodeo/sdk');
        // NOTE: the mock returns one shared builder, so per-token assertions
        // index mock.calls[i] (the i-th build's call), not mock.results[i].
        const builder = vi.mocked(buildImage).mock.results[0].value;
        expect(vi.mocked(buildImage)).toHaveBeenCalledTimes(4);
        for (let i = 0; i < 4; i++) {
            expect(builder.name.mock.calls[i][0]).toBe(`Goblin ${i + 1}`);
            expect(builder.metadata.mock.calls[i][0][BUBBLES_NAME]).toBe(`Goblin ${i + 1}`);
        }
    });

    it('naming honors _displayName (scaled monsters)', async () => {
        await spawnMonstersFromData({ ...goblin, _displayName: 'Squid (CR 9)' }, 280, 280, 2, 'row');

        const { buildImage } = await import('@owlbear-rodeo/sdk');
        const builder = vi.mocked(buildImage).mock.results[0].value;
        expect(builder.name.mock.calls[0][0]).toBe('Squid (CR 9) 1');
        expect(builder.name.mock.calls[1][0]).toBe('Squid (CR 9) 2');
    });

    it('each token gets an independent monster copy', async () => {
        await spawnMonstersFromData(goblin, 280, 280, 2, 'row');

        const { buildImage } = await import('@owlbear-rodeo/sdk');
        const builder = vi.mocked(buildImage).mock.results[0].value;
        const metaA = builder.metadata.mock.calls[0][0];
        const metaB = builder.metadata.mock.calls[1][0];

        metaA[METADATA_KEY].hp.average = 1;
        expect(metaB[METADATA_KEY].hp.average).toBe(7);
    });

    it('count clamps: 20 -> 12 items, 0 -> 1 item', async () => {
        await spawnMonstersFromData(goblin, 280, 280, 20, 'grid');
        expect(vi.mocked(OBR.scene.items.addItems).mock.calls[0][0]).toHaveLength(12);

        vi.clearAllMocks();
        const ids = await spawnMonstersFromData(goblin, 280, 280, 0, 'grid');
        expect(ids).toHaveLength(1);
        expect(vi.mocked(OBR.scene.items.addItems).mock.calls[0][0]).toHaveLength(1);
    });
});
