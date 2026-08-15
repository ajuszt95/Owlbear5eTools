import { describe, it, expect } from 'vitest';
import { render5etoolsText, render5etoolsPlainText } from './renderer';

describe('renderer.ts - render5eToolsText', () => {
    describe('basic text segments', () => {
        it('should handle empty string', () => {
            const result = render5etoolsText('');
            expect(result).toEqual([]);
        });

        it('should handle null input', () => {
            const result = render5etoolsText(null as any);
            expect(result).toEqual([]);
        });

        it('should handle whitespace-only string', () => {
            const result = render5etoolsText('   ');
            const textResult = result.map(s => s.content).join('');
            expect(textResult).toBe(' ');
        });

        it('should handle plain text without tags', () => {
            const result = render5etoolsText('This is plain text.');
            expect(result).toEqual([{ type: 'text', content: 'This is plain text.' }]);
        });

        it('should normalize consecutive spaces correctly', () => {
            const result = render5etoolsText('This is  a  test.');
            const text = result.map(s => s.content).join('');
            expect(text).toBe('This is a test.');
        });
    });

    describe('damage/attack tags', () => {
        it('should parse {@damage 8} tag', () => {
            const result = render5etoolsText('Damage: {@damage 8}');
            const segments = result.filter(s => s.type === 'roll');
            expect(segments).toHaveLength(1);
            expect(segments[0].content).toBe('8');
            expect(segments[0].formula).toBe('8');
            expect(segments[0].label).toBe('Roll');
        });

        it('should parse {@damage 2d6+3} tag', () => {
            const result = render5etoolsText('Damage: {@damage 2d6+3}');
            const segments = result.filter(s => s.type === 'roll');
            expect(segments).toHaveLength(1);
            expect(segments[0].content).toBe('2d6+3');
            expect(segments[0].formula).toBe('2d6+3');
            expect(segments[0].label).toBe('Roll');
        });

        it('should parse {@damage 4d6} tag', () => {
            const result = render5etoolsText('Damage: {@damage 4d6}');
            const segments = result.filter(s => s.type === 'roll');
            expect(segments).toHaveLength(1);
            expect(segments[0].content).toBe('4d6');
            expect(segments[0].formula).toBe('4d6');
            expect(segments[0].label).toBe('Roll');
        });

        it('should parse {@atk mw} tag', () => {
            const result = render5etoolsText('Attack: {@atk mw}');
            const textResult = result.map(s => s.content).join('');
            expect(textResult).toContain('Melee Weapon Attack:');
        });

        it('should parse {@atk rw} tag', () => {
            const result = render5etoolsText('Attack: {@atk rw}');
            const textResult = result.map(s => s.content).join('');
            expect(textResult).toContain('Ranged Weapon Attack:');
        });

        it('should parse {@hit +14} tag', () => {
            const result = render5etoolsText('Hit: {@hit +14}');
            const rollResult = result.find(s => s.type === 'roll');
            expect(rollResult).toBeTruthy();
            expect(rollResult?.content).toBe('+14');
            expect(rollResult?.formula).toBe('1d20+14');
            expect(rollResult?.label).toBe('Attack Roll');
        });

        it('should parse {@hit -5} tag (negative hit bonus)', () => {
            const result = render5etoolsText('Hit: {@hit -5}');
            const rollResult = result.find(s => s.type === 'roll');
            expect(rollResult?.content).toBe('-5');
            expect(rollResult?.formula).toBe('1d20-5');
            expect(rollResult?.label).toBe('Attack Roll');
        });

        it('should parse {@hit 0} tag (neutral hit bonus)', () => {
            const result = render5etoolsText('Hit: {@hit 0}');
            const rollResult = result.find(s => s.type === 'roll');
            expect(rollResult?.content).toBe('+0');
            expect(rollResult?.formula).toBe('1d20+0');
        });
    });

    describe('DC and saving throw tags', () => {
        it('should parse {@dc 14} tag', () => {
            const result = render5etoolsText('DC: {@dc 14}');
            const rollResult = result.find(s => s.type === 'roll');
            const textResult = result.map(s => s.content).join('');
            expect(textResult).toContain('DC 14');
            expect(rollResult?.formula).toBe('1d20');
            expect(rollResult?.label).toBe('DC 14 Check');
        });

        it('should parse {@sav str} tag', () => {
            const result = render5etoolsText('Save: {@sav str}');
            const textResult = result.map(s => s.content).join('');
            expect(textResult).toContain('Strength Saving Throw:');
        });

        it('should parse {@sav dex} tag', () => {
            const result = render5etoolsText('Save: {@sav dex}');
            const textResult = result.map(s => s.content).join('');
            expect(textResult).toContain('Dexterity Saving Throw:');
        });
    });

    describe('recharge and other tags', () => {
        it('should parse {@recharge 5} tag', () => {
            const result = render5etoolsText('Recharge: {@recharge 5}');
            const roll = result.find(s => s.type === 'roll');
            expect(roll?.content).toBe('(Recharge 5\u20136)');
            expect(roll?.formula).toBe('1d6');
        });

        it('should parse {@recharge} tag (no value)', () => {
            const result = render5etoolsText('Recharge: {@recharge}');
            const roll = result.find(s => s.type === 'roll');
            expect(roll?.content).toBe('(Recharge 6)');
            expect(roll?.formula).toBe('1d6');
        });

        it('should parse {@actsavefail} and {@actsavesuccess} tags', () => {
            const result = render5etoolsText('{@actsavefail} or {@actsavesuccess}');
            const text = result.map(s => s.content).join(' ');
            expect(text).toContain('Failure:');
            expect(text).toContain('Success:');
        });

        it('should parse {@d20} tag', () => {
            const result = render5etoolsText('Roll {@d20}');
            const roll = result.find(s => s.type === 'roll');
            expect(roll?.formula).toBe('1d20');
        });
    });
});

describe('renderer.ts - render5eToolsPlainText', () => {
    it('should extract plain text from markup', () => {
        const statBlock = 'Damage: {@damage 4d8+2} - {@dc 13} DC';
        const plainText = render5etoolsPlainText(statBlock);
        expect(plainText).toBe('Damage: 4d8+2 - DC 13 DC');
    });

    it('should handle empty string', () => {
        expect(render5etoolsPlainText('')).toBe('');
    });

    it('should handle null input', () => {
        expect(render5etoolsPlainText(null as any)).toBe('');
    });

    it('should handle text with no tags', () => {
        expect(render5etoolsPlainText('This is plain text.')).toBe('This is plain text.');
    });

    it('should handle mixed text and tags', () => {
        const statBlock = 'Attack: {@atk mw}, {@hit +14}, {@damage 4d6}';
        const plainText = render5etoolsPlainText(statBlock);
        expect(plainText).toBe('Attack: Melee Weapon Attack:, +14, 4d6');
    });
});
