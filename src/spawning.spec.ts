import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnMonster } from './spawning';
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
});
