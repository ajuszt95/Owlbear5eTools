import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import OBR from '@owlbear-rodeo/sdk';
import { EXTENSION_ID, INITIATIVE_METADATA_KEY, initBackground, initInitiativeSafetyNet } from './Background';

vi.mock('@owlbear-rodeo/sdk', () => ({
    default: {
        onReady: vi.fn(),
        player: { getRole: vi.fn() },
        contextMenu: { create: vi.fn() },
            broadcast: {
                onMessage: vi.fn(() => vi.fn()),
                sendMessage: vi.fn(async () => {}),
            },
        scene: {
            items: {
                getItems: vi.fn(async () => []),
                updateItems: vi.fn(async () => {}),
            },
        },
        notification: { show: vi.fn(async () => {}) },
    },
}));

const onMessageMock = OBR.broadcast.onMessage as unknown as Mock;
const getItemsMock = OBR.scene.items.getItems as unknown as Mock;
const updateItemsMock = OBR.scene.items.updateItems as unknown as Mock;
const notifyMock = OBR.notification.show as unknown as Mock;

function handlerFor(channel: string): (event: unknown) => void {
    const call = onMessageMock.mock.calls.find(([c]) => c === channel) as
        | [string, (event: unknown) => void]
        | undefined;
    if (!call) throw new Error(`No handler registered for ${channel}`);
    return call[1];
}

function token(metadata: Record<string, unknown>) {
    return { id: 'token-1', name: 'Goblin', metadata: { ...metadata } };
}

describe('initInitiativeSafetyNet', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        getItemsMock.mockResolvedValue([]);
        initInitiativeSafetyNet();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('completes an orphaned roll: writes tiebreak total when the popover closed', async () => {
        getItemsMock.mockResolvedValue([token({})]);
        let written: Record<string, unknown> = {};
        updateItemsMock.mockImplementation(async (_ids: string[], updater: (draft: { metadata: Record<string, unknown> }[]) => void) => {
            const draft = [token({})];
            updater(draft);
            written = draft[0].metadata;
        });

        handlerFor(`${EXTENSION_ID}/initiative-pending`)({ rollId: 'init_abc', tokenId: 'token-1', mod: 2 });
        handlerFor(`${EXTENSION_ID}/roll-result`)({ rollId: 'init_abc', result: { totalValue: 15 } });
        // Popover is gone: no settled message ever arrives.
        await vi.advanceTimersByTimeAsync(4_000);

        expect(getItemsMock).toHaveBeenCalledWith(['token-1']);
        expect(updateItemsMock).toHaveBeenCalledTimes(1);
        expect(written[INITIATIVE_METADATA_KEY]).toEqual({ count: '15.2', active: false });
        expect(notifyMock).toHaveBeenCalledWith(expect.stringContaining('15.2'), 'DEFAULT');
    });

    it('stands down when the popover settled the roll itself', async () => {
        getItemsMock.mockResolvedValue([token({})]);

        handlerFor(`${EXTENSION_ID}/initiative-pending`)({ rollId: 'init_abc', tokenId: 'token-1', mod: 2 });
        handlerFor(`${EXTENSION_ID}/roll-result`)({ rollId: 'init_abc', result: { totalValue: 15 } });
        handlerFor(`${EXTENSION_ID}/initiative-settled`)({ rollId: 'init_abc' });
        await vi.advanceTimersByTimeAsync(10_000);

        expect(getItemsMock).not.toHaveBeenCalled();
        expect(updateItemsMock).not.toHaveBeenCalled();
    });

    it('never overwrites an existing initiative: notifies instead', async () => {
        getItemsMock.mockResolvedValue([
            token({ [INITIATIVE_METADATA_KEY]: { count: '12', active: false } }),
        ]);

        handlerFor(`${EXTENSION_ID}/initiative-pending`)({ rollId: 'init_abc', tokenId: 'token-1', mod: 2 });
        handlerFor(`${EXTENSION_ID}/roll-result`)({ rollId: 'init_abc', result: { totalValue: 15 } });
        await vi.advanceTimersByTimeAsync(4_000);

        expect(updateItemsMock).not.toHaveBeenCalled();
        expect(notifyMock).toHaveBeenCalledWith(
            expect.stringContaining('already has initiative 12'),
            'DEFAULT'
        );
    });

    it('stands down while the popover shows the overwrite confirm', async () => {
        getItemsMock.mockResolvedValue([
            token({ [INITIATIVE_METADATA_KEY]: { count: '12', active: false } }),
        ]);

        handlerFor(`${EXTENSION_ID}/initiative-pending`)({ rollId: 'init_abc', tokenId: 'token-1', mod: 2 });
        handlerFor(`${EXTENSION_ID}/roll-result`)({ rollId: 'init_abc', result: { totalValue: 15 } });
        handlerFor(`${EXTENSION_ID}/initiative-awaiting-confirm`)({ rollId: 'init_abc' });
        await vi.advanceTimersByTimeAsync(10_000);

        expect(updateItemsMock).not.toHaveBeenCalled();
        expect(notifyMock).not.toHaveBeenCalled();
    });

    it('ignores ordinary (non-initiative) dice rolls on the shared channel', async () => {
        handlerFor(`${EXTENSION_ID}/roll-result`)({ rollId: 'roll_xyz', result: { totalValue: 18 } });
        await vi.advanceTimersByTimeAsync(10_000);

        expect(getItemsMock).not.toHaveBeenCalled();
        expect(updateItemsMock).not.toHaveBeenCalled();
    });

    it('treats an already-matching count as handled (no duplicate write)', async () => {
        getItemsMock.mockResolvedValue([
            token({ [INITIATIVE_METADATA_KEY]: { count: '15.2', active: false } }),
        ]);

        handlerFor(`${EXTENSION_ID}/initiative-pending`)({ rollId: 'init_abc', tokenId: 'token-1', mod: 2 });
        handlerFor(`${EXTENSION_ID}/roll-result`)({ rollId: 'init_abc', result: { totalValue: 15 } });
        await vi.advanceTimersByTimeAsync(4_000);

        expect(updateItemsMock).not.toHaveBeenCalled();
        expect(notifyMock).not.toHaveBeenCalled();
    });
});

describe('initBackground duplicate-init guard', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('registers context menu + safety net only once across double init (StrictMode)', async () => {
        (OBR.onReady as unknown as Mock).mockImplementation((cb: () => Promise<void>) => {
            void cb();
        });
        (OBR.player.getRole as unknown as Mock).mockResolvedValue('GM');

        initBackground();
        initBackground();
        await new Promise((r) => setTimeout(r, 10));

        expect(OBR.contextMenu.create).toHaveBeenCalledTimes(1);
        // Safety net registers exactly 5 broadcast listeners, once.
        expect(onMessageMock).toHaveBeenCalledTimes(5);
    });
});
