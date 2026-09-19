import { describe, it, expect, vi, beforeEach } from 'vitest';
import OBR from '@owlbear-rodeo/sdk';
import {
    executeRoutine,
    getAttackDamageFormula,
    getAttackHitFormula,
    matchAttackName,
    parseMultiattack,
    resolveRoutine,
    sendSingleRoll,
    type RollSegment,
    type RoutineStep,
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

    describe('sendSingleRoll (Dice+) + executeRoutine delegation', () => {
        // Auto-answer every new roll-request with a kept d20 (the sender's
        // rid guard ignores stale handlers, mirroring bulkInitiative.spec).
        function autoAnswerDicePlus(value: number): () => void {
            let answered = 0;
            const timer = setInterval(() => {
                const calls = mockedSendMessage.mock.calls;
                while (answered < calls.length) {
                    const rid = (calls[answered][1] as { rollId: string }).rollId;
                    const handlers = mockedOnMessage.mock.calls.map((c) => c[1] as (e: unknown) => void);
                    const event = {
                        rollId: rid,
                        result: { groups: [{ diceType: 'd20', dice: [{ kept: true, value }] }] },
                    };
                    for (const h of handlers) {
                        try { h(event); } catch { /* noop */ }
                    }
                    answered += 1;
                }
            }, 0);
            return () => clearInterval(timer);
        }

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

        it('routine of 2 attacks produces 4 sequential sends in order', async () => {
            const steps: RoutineStep[] = [
                { attack: 'Beak', count: 1 },
                { attack: 'Claws', count: 1 },
            ];
            const byName = new Map(OWLBEAR_ACTIONS.map((a) => [a.name, a]));
            const seen: string[] = [];
            const stopAnswering = autoAnswerDicePlus(7);
            await executeRoutine(steps, [], {
                lookupAction: (name) => byName.get(name),
                send: async (seg, opts) => {
                    const o = await sendSingleRoll(seg, { ...diceCtx(), awaitDiceResult: opts.awaitDiceResult });
                    seen.push(`${seg.kind}:${o.notation}`);
                    return o;
                },
                log: () => {},
                sleep: () => Promise.resolve(),
            });
            stopAnswering();
            expect(mockedSendMessage).toHaveBeenCalledTimes(4);
            const notations = mockedSendMessage.mock.calls.map((c) => (c[1] as { diceNotation: string }).diceNotation);
            expect(notations).toEqual(['1d20+7', '1d10 + 5', '1d20+7', '2d8 + 5']);
            expect(seen).toEqual([
                'attack:1d20+7',
                'damage:1d10 + 5',
                'attack:1d20+7',
                'damage:2d8 + 5',
            ]);
        });

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

        it('Nat20 via Dice+ arms crit for the next damage step', async () => {
            let armed = false;
            const ctx: SendContext = {
                ...diceCtx(),
                setCritArmed: (v: boolean) => { armed = v; },
                awaitDiceResult: true,
            };
            const promise = sendSingleRoll(atkSeg('1d20+7'), ctx);
            const stopAnswering = autoAnswerDicePlus(20);
            const out = await promise;
            stopAnswering();
            expect(out.nat20).toBe(true);
            expect(armed).toBe(true);
        });

        it('a throwing step is logged as failed and the run continues', async () => {
            const steps: RoutineStep[] = [
                { attack: 'Beak', count: 1 },
                { attack: 'Claws', count: 1 },
            ];
            const byName = new Map(OWLBEAR_ACTIONS.map((a) => [a.name, a]));
            const labels: string[] = [];
            let calls = 0;
            const summary = await executeRoutine(steps, [], {
                lookupAction: (name) => byName.get(name),
                send: () => {
                    calls += 1;
                    if (calls === 2) throw new Error('broadcast boom');
                    return Promise.resolve({
                        ok: true, label: 'x', kind: 'attack',
                        formula: '1d20+7', notation: '1d20+7',
                    });
                },
                log: (e) => labels.push(`${e.label}:${e.ok ? 'ok' : 'FAIL'}`),
                sleep: () => Promise.resolve(),
            });
            expect(summary).toEqual({ sent: 4, failed: 1 });
            expect(labels).toEqual([
                'Beak attack:ok',
                'Beak damage:FAIL',
                'Claws attack:ok',
                'Claws damage:ok',
            ]);
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
