import { describe, it, expect } from 'vitest';
import { evaluateRoll, parseDiceFormula, type RollResult } from './diceRoller';

describe('diceRoller.ts', () => {
    describe('parseDiceFormula', () => {
        it('should parse simple 1d20', () => {
            const parsed = parseDiceFormula('1d20');
            expect(parsed).toEqual({
                dice: [{ count: 1, sides: 20 }],
                modifier: 0,
                rawFormula: '1d20',
            });
        });

        it('should parse d20 without count prefix as 1d20', () => {
            const parsed = parseDiceFormula('d20');
            expect(parsed).toEqual({
                dice: [{ count: 1, sides: 20 }],
                modifier: 0,
                rawFormula: 'd20',
            });
        });

        it('should parse positive modifier 1d20+5', () => {
            const parsed = parseDiceFormula('1d20+5');
            expect(parsed).toEqual({
                dice: [{ count: 1, sides: 20 }],
                modifier: 5,
                rawFormula: '1d20+5',
            });
        });

        it('should parse negative modifier 1d20-2', () => {
            const parsed = parseDiceFormula('1d20-2');
            expect(parsed).toEqual({
                dice: [{ count: 1, sides: 20 }],
                modifier: -2,
                rawFormula: '1d20-2',
            });
        });

        it('should parse multiple dice e.g. 2d6+3', () => {
            const parsed = parseDiceFormula('2d6+3');
            expect(parsed).toEqual({
                dice: [{ count: 2, sides: 6 }],
                modifier: 3,
                rawFormula: '2d6+3',
            });
        });

        it('should parse static numbers without dice', () => {
            const parsed = parseDiceFormula('8');
            expect(parsed).toEqual({
                dice: [],
                modifier: 8,
                rawFormula: '8',
            });
        });

        it('should handle formulas with spaces and uppercase letters', () => {
            const parsed = parseDiceFormula(' 3D8 + 4 ');
            expect(parsed).toEqual({
                dice: [{ count: 3, sides: 8 }],
                modifier: 4,
                rawFormula: '3D8 + 4',
            });
        });

        it('should handle multiple dice terms like 1d8+1d4+2', () => {
            const parsed = parseDiceFormula('1d8+1d4+2');
            expect(parsed).toEqual({
                dice: [
                    { count: 1, sides: 8 },
                    { count: 1, sides: 4 },
                ],
                modifier: 2,
                rawFormula: '1d8+1d4+2',
            });
        });
    });

    describe('evaluateRoll', () => {
        it('should roll 1d20+3 and format result as requested', () => {
            // Mock roller to return 14
            const result: RollResult = evaluateRoll('1d20+3', {
                roller: () => 14,
            });

            expect(result.total).toBe(17);
            expect(result.diceRolls).toEqual([{ sides: 20, rolls: [14] }]);
            expect(result.modifier).toBe(3);
            expect(result.isNat1).toBe(false);
            expect(result.isNat20).toBe(false);
            expect(result.variant).toBe('DEFAULT');
            expect(result.formattedText).toBe('Result of the roll: 14 (1d20) + 3 = 17');
        });

        it('should format result with custom label when provided', () => {
            const result = evaluateRoll('1d20+3', {
                label: 'Attack Roll',
                roller: () => 14,
            });

            expect(result.total).toBe(17);
            expect(result.formattedText).toBe('Attack Roll: 14 (1d20) + 3 = 17');
        });

        it('should detect Natural 20 on 1d20 and append "Nat 20! 😎" with SUCCESS variant', () => {
            const result = evaluateRoll('1d20+5', {
                label: 'Melee Attack',
                roller: () => 20,
            });

            expect(result.total).toBe(25);
            expect(result.isNat20).toBe(true);
            expect(result.isNat1).toBe(false);
            expect(result.variant).toBe('SUCCESS');
            expect(result.formattedText).toBe('Melee Attack: 20 (1d20) + 5 = 25\nNat 20! 😎');
        });

        it('should detect Natural 1 on 1d20 and append "Nat 1 :(" with ERROR variant', () => {
            const result = evaluateRoll('1d20+5', {
                label: 'Dexterity Save',
                roller: () => 1,
            });

            expect(result.total).toBe(6);
            expect(result.isNat1).toBe(true);
            expect(result.isNat20).toBe(false);
            expect(result.variant).toBe('ERROR');
            expect(result.formattedText).toBe('Dexterity Save: 1 (1d20) + 5 = 6\nNat 1 :(');
        });

        it('should roll 1d20 without modifier and format cleanly', () => {
            const result = evaluateRoll('1d20', {
                roller: () => 11,
            });

            expect(result.total).toBe(11);
            expect(result.modifier).toBe(0);
            expect(result.formattedText).toBe('Result of the roll: 11 (1d20) = 11');
        });

        it('should handle negative modifiers correctly', () => {
            const result = evaluateRoll('1d20-2', {
                label: 'Wisdom Check',
                roller: () => 10,
            });

            expect(result.total).toBe(8);
            expect(result.modifier).toBe(-2);
            expect(result.formattedText).toBe('Wisdom Check: 10 (1d20) - 2 = 8');
        });

        it('should roll multiple dice e.g. 2d6+3 correctly', () => {
            const rolls = [4, 6];
            let rollIndex = 0;
            const result = evaluateRoll('2d6+3', {
                label: 'Bite Damage',
                roller: () => rolls[rollIndex++],
            });

            expect(result.total).toBe(13);
            expect(result.diceRolls).toEqual([{ sides: 6, rolls: [4, 6] }]);
            expect(result.modifier).toBe(3);
            expect(result.isNat1).toBe(false);
            expect(result.isNat20).toBe(false);
            expect(result.variant).toBe('DEFAULT');
            expect(result.formattedText).toBe('Bite Damage: 4, 6 (2d6) + 3 = 13');
        });

        it('should roll single die damage e.g. 1d6', () => {
            const result = evaluateRoll('1d6', {
                label: 'Recharge',
                roller: () => 5,
            });

            expect(result.total).toBe(5);
            expect(result.formattedText).toBe('Recharge: 5 (1d6) = 5');
        });

        it('should handle static value formulas e.g. 8', () => {
            const result = evaluateRoll('8', {
                label: 'Acid Damage',
            });

            expect(result.total).toBe(8);
            expect(result.diceRolls).toEqual([]);
            expect(result.formattedText).toBe('Acid Damage: 8');
        });

        it('should not mark Nat 20 or Nat 1 if rolling multiple d20s or non-d20s', () => {
            const rolls = [1, 20];
            let i = 0;
            const result = evaluateRoll('2d20', {
                roller: () => rolls[i++],
            });

            expect(result.isNat1).toBe(false);
            expect(result.isNat20).toBe(false);
            expect(result.variant).toBe('DEFAULT');
        });

        it('should handle zero modifier 1d20+0', () => {
            const result = evaluateRoll('1d20+0', {
                roller: () => 15,
            });
            expect(result.total).toBe(15);
            expect(result.modifier).toBe(0);
            expect(result.formattedText).toBe('Result of the roll: 15 (1d20) = 15');
        });

        it('should handle d100 and d4 properly', () => {
            const result = evaluateRoll('1d100', {
                roller: () => 73,
            });
            expect(result.total).toBe(73);
            expect(result.formattedText).toBe('Result of the roll: 73 (1d100) = 73');
            expect(result.isNat20).toBe(false);
            expect(result.isNat1).toBe(false);
        });

        it('should handle multiple dice types with modifier e.g. 2d6+1d4+3', () => {
            const rolls = [3, 5, 2];
            let idx = 0;
            const result = evaluateRoll('2d6+1d4+3', {
                label: 'Greatsword Fire',
                roller: () => rolls[idx++],
            });
            expect(result.total).toBe(13);
            expect(result.formattedText).toBe('Greatsword Fire: 3, 5 (2d6) + 2 (1d4) + 3 = 13');
        });

        it('should handle empty or null string gracefully', () => {
            const result = evaluateRoll('');
            expect(result.total).toBe(0);
            expect(result.formattedText).toBe('Result of the roll: 0');
        });

        it('should work with real random values within expected bounds', () => {
            for (let i = 0; i < 20; i++) {
                const result = evaluateRoll('1d20+4');
                expect(result.total).toBeGreaterThanOrEqual(5);
                expect(result.total).toBeLessThanOrEqual(24);
                expect(['DEFAULT', 'SUCCESS', 'ERROR']).toContain(result.variant);
            }
        });
    });
});
