import { describe, it, expect } from 'vitest';
import { mulberry32, randomInt, shuffle } from './rng';

describe('rng', () => {
    it('produit des valeurs dans [0, 1)', () => {
        const rng = mulberry32(12345);
        for (let i = 0; i < 1000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('est déterministe : même seed → même séquence', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const seqA = Array.from({ length: 10 }, () => a());
        const seqB = Array.from({ length: 10 }, () => b());
        expect(seqA).toEqual(seqB);
    });

    it('produit des séquences différentes pour des seeds différentes', () => {
        const a = mulberry32(1);
        const b = mulberry32(2);
        const seqA = Array.from({ length: 10 }, () => a());
        const seqB = Array.from({ length: 10 }, () => b());
        expect(seqA).not.toEqual(seqB);
    });

    it('randomInt reste dans les bornes inclusives', () => {
        const rng = mulberry32(7);
        for (let i = 0; i < 1000; i++) {
            const v = randomInt(rng, 15, 20);
            expect(v).toBeGreaterThanOrEqual(15);
            expect(v).toBeLessThanOrEqual(20);
            expect(Number.isInteger(v)).toBe(true);
        }
    });

    it('shuffle conserve les éléments sans muter la source', () => {
        const source = [1, 2, 3, 4, 5, 6, 7, 8];
        const rng = mulberry32(99);
        const result = shuffle(rng, source);
        expect(result).toHaveLength(source.length);
        expect([...result].sort((x, y) => x - y)).toEqual(source);
        expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('shuffle est déterministe pour une seed donnée', () => {
        const source = [1, 2, 3, 4, 5, 6, 7, 8];
        expect(shuffle(mulberry32(5), source)).toEqual(
            shuffle(mulberry32(5), source),
        );
    });
});
