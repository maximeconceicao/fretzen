import { describe, it, expect } from 'vitest';
import { generateBoard } from './board-generator';
import { positionToMidi, isValidFret, TOTAL_POSITIONS } from './fretboard';

describe('board-generator', () => {
    it('génère entre 15 et 20 feuilles par défaut', () => {
        for (let seed = 0; seed < 50; seed++) {
            const board = generateBoard(seed);
            expect(board.length).toBeGreaterThanOrEqual(15);
            expect(board.length).toBeLessThanOrEqual(20);
        }
    });

    it('produit des positions toutes distinctes', () => {
        for (let seed = 0; seed < 50; seed++) {
            const board = generateBoard(seed);
            const keys = board.map((o) => `${o.position.string}:${o.position.fret}`);
            expect(new Set(keys).size).toBe(board.length);
        }
    });

    it('associe à chaque feuille la bonne hauteur et une frette valide', () => {
        for (let seed = 0; seed < 50; seed++) {
            for (const leaf of generateBoard(seed)) {
                expect(isValidFret(leaf.position.fret)).toBe(true);
                expect(leaf.midi).toBe(positionToMidi(leaf.position));
            }
        }
    });

    it('autorise des doublons de note (plusieurs feuilles de même hauteur/classe)', () => {
        // Sur de nombreuses seeds, au moins un plateau présente des doublons de note.
        let seenDuplicate = false;
        for (let seed = 0; seed < 50 && !seenDuplicate; seed++) {
            const classes = generateBoard(seed).map((o) => o.midi % 12);
            if (new Set(classes).size < classes.length) {
                seenDuplicate = true;
            }
        }
        expect(seenDuplicate).toBe(true);
    });

    it('attribue des identifiants uniques', () => {
        const ids = generateBoard(123).map((o) => o.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('est déterministe : même seed → plateau identique', () => {
        expect(generateBoard(777)).toEqual(generateBoard(777));
    });

    it('produit des plateaux différents pour des seeds différentes', () => {
        expect(generateBoard(1)).not.toEqual(generateBoard(2));
    });

    it('rejette des bornes incohérentes', () => {
        expect(() => generateBoard(1, { minLeaves: 20, maxLeaves: 15 })).toThrow(
            RangeError,
        );
        expect(() => generateBoard(1, { minLeaves: 0, maxLeaves: 0 })).toThrow(
            RangeError,
        );
    });

    it('respecte des bornes personnalisées', () => {
        for (let seed = 0; seed < 20; seed++) {
            const board = generateBoard(seed, { minLeaves: 5, maxLeaves: 8 });
            expect(board.length).toBeGreaterThanOrEqual(5);
            expect(board.length).toBeLessThanOrEqual(8);
        }
    });

    it('ne dépasse jamais le nombre total de positions', () => {
        const board = generateBoard(1, { minLeaves: 200, maxLeaves: 200 });
        expect(board.length).toBe(TOTAL_POSITIONS);
    });
});
