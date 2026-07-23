const { generateCode, generateUniqueBatch } = require('../utils/codeGenerator');
const { CODE_CHARSET } = require('../config/constants');

describe('generateCode', () => {
  test('generates a code of the specified length', () => {
    const code = generateCode(10);
    expect(code).toHaveLength(10);
  });

  test('uses only characters from CODE_CHARSET', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateCode(10);
      for (const char of code) {
        expect(CODE_CHARSET).toContain(char);
      }
    }
  });

  test('prepends prefix correctly', () => {
    const code = generateCode(10, 'IND');
    expect(code.startsWith('IND')).toBe(true);
    expect(code).toHaveLength(10);
  });

  test('does not contain O or I (confusing characters)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode(10);
      expect(code).not.toMatch(/[OI01]/);
    }
  });

  test('produces different codes on each call', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateCode(10)));
    expect(codes.size).toBe(100);
  });

  test('throws if prefix >= length', () => {
    expect(() => generateCode(5, 'TOOLONG')).toThrow();
  });
});

describe('generateUniqueBatch', () => {
  test('generates the requested count of unique codes', () => {
    const codes = generateUniqueBatch(100, 10, '', new Set());
    expect(codes).toHaveLength(100);
    expect(new Set(codes).size).toBe(100);
  });

  test('does not include codes from existingCodes set', () => {
    const batch1 = generateUniqueBatch(50, 10, '', new Set());
    const existing = new Set(batch1);
    const batch2 = generateUniqueBatch(50, 10, '', existing);
    const overlap = batch2.filter((c) => existing.has(c));
    expect(overlap).toHaveLength(0);
  });

  test('can generate 1,000 codes without duplicates', () => {
    const codes = generateUniqueBatch(1000, 10, '', new Set());
    expect(new Set(codes).size).toBe(1000);
  });

  test('respects prefix for all generated codes', () => {
    const codes = generateUniqueBatch(50, 12, 'IND', new Set());
    codes.forEach((c) => {
      expect(c.startsWith('IND')).toBe(true);
      expect(c).toHaveLength(12);
    });
  });
});
