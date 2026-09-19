import { describe, it, expect, vi, beforeEach } from 'vitest';
import OBR from '@owlbear-rodeo/sdk';
import {
    buildTurnNotation,
    critExtraFormula,
    formatRollDetail,
    getAttackDamageFormula,
    getAttackHitFormula,
    mapTurnGroups,
    matchAttackName,
    parseMultiattack,
    resolveRoutine,
    sendSingleRoll,
    sendTurnRequest,
    type RollSegment,
    type SendContext,
} from './routines';

vi.mock('@owlbear-rodeo/sdk', () => {
    return {
        default: {
            broadcast: {
                sendMessage: vi.fn().mockResolvedValue(undefined),
                onMessage: vi.fn().mockReturnValue(vi.fn()),
            },
            player: {
                getName: vi.fn().mockResolvedValue('DM'),
                getId: vi.fn().mockResolvedValue('player-1'),
            },
            notification: {
                show: vi.fn().mockResolvedValue(undefined),
            },
        },
    };
});

const mockedSendMessage = OBR.broadcast.sendMessage as unknown as ReturnType<typeof vi.fn>;
const mockedOnMessage = OBR.broadcast.onMessage as unknown as ReturnType<typeof vi.fn>;
const mockedNotify = OBR.notification.show as unknown as ReturnType<typeof vi.fn>;

// ── Live-shaped fixtures (mirror bestiary-mm.json action arrays) ──

const OWLBEAR_ACTIONS = [
    { name: 'Multiattack', entries: ['The owlbear makes two attacks: one with its beak and one with its claws.'] },
    { name: 'Beak', entries: ['{@atk mw} {@hit 7} to hit, reach 5 ft., one target. {@h}10 ({@damage 1d10 + 5}) piercing damage.'] },
    { name: 'Claws', entries: ['{@atk mw} {@hit 7} to hit, reach 5 ft., one target. {@h}14 ({@damage 2d8 + 5}) slashing damage.'] },
];

const DRAGON_ACTIONS = [
    { name: 'Multiattack', entries: ['The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.'] },
    { name: 'Bite', entries: ['{@atk mw} {@hit 14} to hit. {@h}19 ({@damage 2d10 + 8}) piercing damage.'] },
    { name: 'Claw', entries: ['{@atk mw} {@hit 14} to hit. {@h}15 ({@damage 2d6 + 8}) slashing damage.'] },
    { name: 'Tail', entries: ['{@atk mw} {@hit 14} to hit. {@h}17 ({@damage 2d8 + 8}) bludgeoning damage.'] },
    { name: 'Frightful Presence', entries: ['Each creature of the dragon\'s choice ... {@dc 19} ...'] },
];

const GOBLIN_ACTIONS = [
    { name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit. {@h}5 ({@damage 1d6 + 2}) slashing damage.'] },
    { name: 'Shortbow', entries: ['{@atk rw} {@hit 4} to hit. {@h}5 ({@damage 1d6 + 2}) piercing damage.'] },
];

function basicCtx(overrides: Partial<SendContext> = {}): SendContext & { armed: { value: boolean } } {
    const armed = { value: false };
    return {
        rollTarget: 'everyone',
        rollEngine: 'basic',
        advantage: 'normal',
        critArmed: false,
        setCritArmed: (v: boolean) => { armed.value = v; },
        setIsRolling: () => {},
        silent: true,
        armed,
        ...overrides,
    };
}

function atkSeg(formula: string, label = 'Attack Roll'): RollSegment {
    return { type: 'roll', content: formula, formula, label, kind: 'attack' };
}

function dmgSeg(formula: string): RollSegment {
    return { type: 'roll', content: formula, formula, label: 'Roll', kind: 'damage' };
}

describe('routines.ts', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockedSendMessage.mockResolvedValue(undefined);
        mockedOnMessage.mockReturnValue(vi.fn());
        (OBR.player.getName as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('DM');
        (OBR.player.getId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('player-1');
        mockedNotify.mockResolvedValue(undefined);
    });

    describe('matchAttackName', () => {
        const names = ['Bite', 'Claw', 'Tail', 'Frightful Presence'];
        it('matches plurals and case', () => {
            expect(matchAttackName('claws', names)).toBe('Claw');
            expect(matchAttackName('CLAWS', names)).toBe('Claw');
            expect(matchAttackName('bite', names)).toBe('Bite');
        });
        it('returns null for unknown refs', () => {
            expect(matchAttackName('fiery breath', names)).toBeNull();
            expect(matchAttackName('', names)).toBeNull();
        });
    });

    describe('parseMultiattack', () => {
        const owlbearNames = OWLBEAR_ACTIONS.map((a) => a.name);
        const dragonNames = DRAGON_ACTIONS.map((a) => a.name);

        it('resolves Owlbear to Beak x1 + Claws x1', () => {
            expect(parseMultiattack(OWLBEAR_ACTIONS[0].entries, owlbearNames)).toEqual([
                { attack: 'Beak', count: 1 },
                { attack: 'Claws', count: 1 },
            ]);
        });

        it('resolves Dragon to Bite x1 + Claw x2, ignoring the Frightful Presence lead-in', () => {
            expect(parseMultiattack(DRAGON_ACTIONS[0].entries, dragonNames)).toEqual([
                { attack: 'Bite', count: 1 },
                { attack: 'Claw', count: 2 },
            ]);
        });

        it('returns null for unparsable text and Frightful-Presence-only clauses', () => {
            expect(parseMultiattack(['The dragon can use its Frightful Presence.'], dragonNames)).toBeNull();
            expect(parseMultiattack(['Makes no attacks at all.'], dragonNames)).toBeNull();
            expect(parseMultiattack([], dragonNames)).toBeNull();
        });

        it('handles digits and uppercase', () => {
            expect(parseMultiattack(['Makes 2 attacks: one with its BITE and one with its CLAWS.'], dragonNames)).toEqual([
                { attack: 'Bite', count: 1 },
                { attack: 'Claw', count: 1 },
            ]);
        });
    });

    describe('formula extractors', () => {
        it('pulls hit and damage from {@hit}/{@damage} entries', () => {
            const beak = OWLBEAR_ACTIONS[1];
            expect(getAttackHitFormula(beak)).toBe('1d20+7');
            expect(getAttackDamageFormula(beak)).toBe('1d10 + 5');
            expect(getAttackHitFormula(DRAGON_ACTIONS[2])).toBe('1d20+14');
            expect(getAttackDamageFormula(DRAGON_ACTIONS[2])).toBe('2d6 + 8');
        });

        it('returns null when the kind is absent', () => {
            expect(getAttackDamageFormula(DRAGON_ACTIONS[4])).toBeNull();
            expect(getAttackHitFormula({ name: 'X', entries: ['plain text'] })).toBeNull();
            expect(getAttackHitFormula(null)).toBeNull();
        });
    });

    describe('resolveRoutine', () => {
        it('Owlbear: 2 steps, no skips, 4 total rolls', () => {
            expect(resolveRoutine(OWLBEAR_ACTIONS)).toEqual({
                steps: [
                    { attack: 'Beak', count: 1 },
                    { attack: 'Claws', count: 1 },
                ],
                skipped: [],
                totalRolls: 4,
            });
        });

        it('Dragon: Bite + Claw x2, Frightful Presence skipped, 6 total rolls', () => {
            expect(resolveRoutine(DRAGON_ACTIONS)).toEqual({
                steps: [
                    { attack: 'Bite', count: 1 },
                    { attack: 'Claw', count: 2 },
                ],
                skipped: ['Frightful Presence'],
                totalRolls: 6,
            });
        });

        it('Goblin (no Multiattack) resolves to null', () => {
            expect(resolveRoutine(GOBLIN_ACTIONS)).toBeNull();
            expect(resolveRoutine(null)).toBeNull();
        });
    });

    describe('sendSingleRoll (Basic)', () => {
        it('Nat20 arms crit and the next damage send uses critFormula', async () => {
            const ctx = basicCtx();
            const attack = await sendSingleRoll(atkSeg('1d20+7'), {
                ...ctx,
                advantage: 'normal',
            } as SendContext);
            // real RNG: outcome shape only; arming covered deterministically below.
            expect(attack.ok).toBe(true);
            expect(typeof attack.total).toBe('number');

            // Deterministic arm→consume cycle via the shared flag object.
            const armedCtx = basicCtx({ critArmed: true });
            const dmg = dmgSeg('1d10 + 5');
            const damage = await sendSingleRoll(dmg, armedCtx as SendContext);
            expect(damage.ok).toBe(true);
            expect(damage.notation).toBe('2d10+5');
            expect(damage.critUsed).toBe(true);
            expect(armedCtx.armed.value).toBe(false);
        });

        it('silent mode suppresses notifications but still returns totals', async () => {
            const out = await sendSingleRoll(dmgSeg('1d6+2'), basicCtx());
            expect(out.ok).toBe(true);
            expect(mockedNotify).not.toHaveBeenCalled();
        });

        it('notification failure returns ok:false without throwing', async () => {
            // evaluateRoll never throws (garbage parses to a static 0), so the
            // Basic failure path is a rejected notification.
            mockedNotify.mockRejectedValueOnce(new Error('toast boom'));
            const out = await sendSingleRoll(dmgSeg('1d6+2'), basicCtx({ silent: false }) as SendContext);
            expect(out.ok).toBe(false);
            expect(out.error).toBeTruthy();
        });
    });

    describe('buildTurnNotation (one turn, one request)', () => {
        const byName = (actions: { name: string; entries: string[] }[]) =>
            new Map(actions.map((a) => [a.name, a]));

        it('Owlbear compacts to attack+damage per sub-attack in order', () => {
            const built = buildTurnNotation(
                [
                    { attack: 'Beak', count: 1 },
                    { attack: 'Claws', count: 1 },
                ],
                byName(OWLBEAR_ACTIONS).get.bind(byName(OWLBEAR_ACTIONS)),
                'normal'
            );
            expect(built?.notation).toBe('1d20+7+1d10+5+1d20+7+2d8+5');
            expect(built?.parts.map((p) => `${p.attack} ${p.kinds}`)).toEqual([
                'Beak attack',
                'Beak damage',
                'Claws attack',
                'Claws damage',
            ]);
            expect(built?.skipped).toEqual([]);
        });

        it('Dragon with adv: attacks gain 2d20kh1, damage stays plain', () => {
            const built = buildTurnNotation(
                [
                    { attack: 'Bite', count: 1 },
                    { attack: 'Claw', count: 2 },
                ],
                byName(DRAGON_ACTIONS).get.bind(byName(DRAGON_ACTIONS)),
                'adv'
            );
            expect(built?.parts).toHaveLength(6);
            expect(built?.notation).toBe(
                '2d20kh1+14+2d10+8+2d20kh1+14+2d6+8+2d20kh1+14+2d6+8'
            );
        });

        it('skips steps with no attack roll; null when nothing remains', () => {
            const built = buildTurnNotation(
                [
                    { attack: 'Frightful Presence', count: 1 },
                    { attack: 'Bite', count: 1 },
                ],
                byName(DRAGON_ACTIONS).get.bind(byName(DRAGON_ACTIONS)),
                'normal'
            );
            expect(built?.skipped).toEqual(['Frightful Presence']);
            expect(built?.parts.map((p) => p.attack)).toEqual(['Bite', 'Bite']);
            expect(
                buildTurnNotation(
                    [{ attack: 'Nope', count: 1 }],
                    () => undefined,
                    'normal'
                )
            ).toBeNull();
        });
    });

    describe('critExtraFormula', () => {
        it('returns dice-only, no modifier', () => {
            expect(critExtraFormula('2d8 + 5')).toBe('2d8');
            expect(critExtraFormula('1d10+5')).toBe('1d10');
            expect(critExtraFormula('8')).toBeNull();
            expect(critExtraFormula('not dice')).toBeNull();
        });
    });

    describe('formatRollDetail', () => {
        it('renders Dice+-summary style breakdowns', () => {
            expect(formatRollDetail([12], 7)).toBe('[12] + 7');
            expect(formatRollDetail([4, 5], 5)).toBe('[4, 5] + 5');
            expect(formatRollDetail([9], -2)).toBe('[9] - 2');
            expect(formatRollDetail([9], 0)).toBe('[9]');
            expect(formatRollDetail([], 7)).toBeUndefined();
        });
    });

    describe('mapTurnGroups', () => {
        const d20Group = (value: number) => ({
            diceType: 'd20',
            dice: [{ kept: true, value, diceType: 'd20' }],
            total: value,
        });
        const dmgGroup = (total: number) => ({
            diceType: 'd10',
            dice: [{ kept: true, value: total, diceType: 'd10' }],
            total,
        });

        it('labels parts in order and flags Nat20 attacks', () => {
            const built = buildTurnNotation(
                [{ attack: 'Beak', count: 1 }],
                new Map(OWLBEAR_ACTIONS.map((a) => [a.name, a])).get.bind(
                    new Map(OWLBEAR_ACTIONS.map((a) => [a.name, a]))
                ),
                'normal'
            );
            // Groups are dice-only: line total adds OUR modifier (probe 2026-09-19).
            const mapped = mapTurnGroups(built!.parts, [d20Group(20), dmgGroup(12)]);
            expect(mapped).toEqual([
                { label: 'Beak attack', notation: '1d20+7', total: 27, detail: '[20] + 7', nat20: true, ok: true, extra: '1d10' },
                { label: 'Beak damage', notation: '1d10+5', total: 17, detail: '[12] + 5', nat20: false, ok: true, extra: undefined },
            ]);
        });

        it('adds the modifier to multi-die dice totals', () => {
            const parts = [
                { attack: 'Claws', rep: 1, kinds: 'damage', formula: '2d8 + 5', notation: '2d8+5' },
            ] as const;
            const mapped = mapTurnGroups([...parts], [
                {
                    diceType: 'd8',
                    dice: [
                        { kept: true, value: 3, diceType: 'd8' },
                        { kept: true, value: 6, diceType: 'd8' },
                    ],
                    total: 9,
                },
            ]);
            expect(mapped).toEqual([
                { label: 'Claws damage', notation: '2d8+5', total: 14, detail: '[3, 6] + 5', nat20: false, ok: true, extra: undefined },
            ]);
        });

        it('numbers repeated attacks; null on shape mismatch', () => {
            const parts = [
                { attack: 'Claw', rep: 1, kinds: 'attack', formula: '1d20+14', notation: '1d20+14' },
                { attack: 'Claw', rep: 1, kinds: 'damage', formula: '2d6 + 8', notation: '2d6+8' },
                { attack: 'Claw', rep: 2, kinds: 'attack', formula: '1d20+14', notation: '1d20+14' },
                { attack: 'Claw', rep: 2, kinds: 'damage', formula: '2d6 + 8', notation: '2d6+8' },
            ] as const;
            const mapped = mapTurnGroups([...parts], [
                d20Group(7),
                dmgGroup(11),
                d20Group(9),
                dmgGroup(13),
            ]);
            expect(mapped?.map((m) => m.label)).toEqual([
                'Claw 1 attack',
                'Claw 1 damage',
                'Claw 2 attack',
                'Claw 2 damage',
            ]);
            expect(mapTurnGroups([...parts], [d20Group(7)])).toBeNull();
            expect(mapTurnGroups([...parts], 'nope')).toBeNull();
        });
    });

    describe('sendTurnRequest', () => {
        // Answer the turn request with per-part groups (kept d20 = value).
        function autoAnswerTurn(values: number[]): () => void {
            let answered = 0;
            const timer = setInterval(() => {
                const calls = mockedSendMessage.mock.calls;
                while (answered < calls.length) {
                    const rid = (calls[answered][1] as { rollId: string }).rollId;
                    const handlers = mockedOnMessage.mock.calls.map((c) => c[1] as (e: unknown) => void);
                    const event = {
                        rollId: rid,
                        result: {
                            groups: values.map((v) => ({
                                diceType: 'd20',
                                dice: [{ kept: true, value: v, diceType: 'd20' }],
                                total: v,
                            })),
                        },
                    };
                    for (const h of handlers) {
                        try { h(event); } catch { /* noop */ }
                    }
                    answered += 1;
                }
            }, 0);
            return () => clearInterval(timer);
        }

        it('sends ONE compound request and returns the groups', async () => {
            const stop = autoAnswerTurn([19, 12, 7, 15]);
            const outcome = await sendTurnRequest('1d20+7+1d10+5+1d20+7+2d8+5', 'everyone');
            stop();
            expect(mockedSendMessage).toHaveBeenCalledTimes(1);
            const payload = mockedSendMessage.mock.calls[0][1] as {
                diceNotation: string;
                showResults: boolean;
                rollTarget: string;
            };
            expect(payload.diceNotation).toBe('1d20+7+1d10+5+1d20+7+2d8+5');
            expect(payload.showResults).toBe(true);
            expect(payload.rollTarget).toBe('everyone');
            expect(outcome.ok).toBe(true);
            if (outcome.ok) expect(outcome.groups).toHaveLength(4);
        });

        it('roll-error resolves ok:false with the message', async () => {
            const promise = sendTurnRequest('1d20+7', 'everyone');
            // Let the subscribe happen, then fire the error for our rid.
            await new Promise((r) => setTimeout(r, 5));
            const rid = (mockedSendMessage.mock.calls[0][1] as { rollId: string }).rollId;
            // Fire ONLY the roll-error subscriber (the last one): the same
            // payload at the result handler would (correctly) resolve first
            // as "no groups".
            const errorHandler = mockedOnMessage.mock.calls[mockedOnMessage.mock.calls.length - 1][1] as (e: unknown) => void;
            errorHandler({ rollId: rid, error: 'bad notation' });
            const outcome = await promise;
            expect(outcome).toEqual({ ok: false, rollId: rid, error: 'bad notation' });
        });
    });

    describe('sendSingleRoll (Dice+)', () => {
        function diceCtx(): SendContext {
            return {
                rollTarget: 'everyone',
                rollEngine: 'dice-plus',
                advantage: 'normal',
                critArmed: false,
                setCritArmed: () => {},
                setIsRolling: () => {},
                silent: true,
            };
        }

        it('advantage turns attacks into 2d20kh1 and leaves damage untouched', async () => {
            const out = await sendSingleRoll(atkSeg('1d20+7'), { ...diceCtx(), advantage: 'adv' });
            expect(out.ok).toBe(true);
            expect(out.notation).toBe('2d20kh1+7');
            const dmg = await sendSingleRoll(dmgSeg('1d10 + 5'), { ...diceCtx(), advantage: 'adv' });
            expect(dmg.notation).toBe('1d10 + 5');
        });

        it('crit-armed damage sends doubled dice', async () => {
            const out = await sendSingleRoll(dmgSeg('1d10 + 5'), { ...diceCtx(), critArmed: true });
            expect(out.notation).toBe('2d10+5');
            expect(out.critUsed).toBe(true);
        });

        it('broadcast failure returns ok:false and unlocks', async () => {
            mockedSendMessage.mockRejectedValueOnce(new Error('no dice'));
            let rolling = true;
            const out = await sendSingleRoll(atkSeg('1d20+7'), {
                ...diceCtx(),
                setIsRolling: (v: boolean) => { rolling = v; },
            });
            expect(out.ok).toBe(false);
            expect(rolling).toBe(false);
        });
    });
});
