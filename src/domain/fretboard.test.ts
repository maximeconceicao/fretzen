import { describe, it, expect } from 'vitest';
import {
    MAX_FRET,
    TOTAL_POSITIONS,
    positionToMidi,
    allPositions,
    isValidFret,
    type Position,
} from './fretboard';
import { OPEN_STRING_MIDI, STRING_NUMBERS, type StringNumber } from './tuning';
import { midiToNoteLabel } from './notes';

describe('fretboard', () => {
    it('énumère exactement 78 positions (6 cordes × 13 frettes)', () => {
        expect(TOTAL_POSITIONS).toBe(78);
        expect(allPositions()).toHaveLength(78);
    });

    it('ne produit aucune position dupliquée', () => {
        const keys = allPositions().map((p) => `${p.string}:${p.fret}`);
        expect(new Set(keys).size).toBe(78);
    });

    it('les cordes à vide correspondent à leur hauteur MIDI d’accordage', () => {
        for (const string of STRING_NUMBERS) {
            expect(positionToMidi({ string, fret: 0 })).toBe(
                OPEN_STRING_MIDI[string],
            );
        }
    });

    it('les cordes à vide ont les bons noms de notes (E2 A2 D3 G3 B3 E4)', () => {
        const openLabels = STRING_NUMBERS.map((string) =>
            midiToNoteLabel(positionToMidi({ string, fret: 0 })),
        );
        // STRING_NUMBERS va de la corde 1 (aiguë) à la corde 6 (grave)
        expect(openLabels).toEqual(['E4', 'B3', 'G3', 'D3', 'A2', 'E2']);
    });

    it('la 12e frette sonne une octave au-dessus de la corde à vide', () => {
        for (const string of STRING_NUMBERS) {
            const open = positionToMidi({ string, fret: 0 });
            const twelfth = positionToMidi({ string, fret: MAX_FRET });
            expect(twelfth - open).toBe(12);
        }
    });

    it('calcule les bonnes hauteurs pour toutes les cordes et frettes 0 à 12', () => {
        for (const string of STRING_NUMBERS) {
            for (let fret = 0; fret <= MAX_FRET; fret++) {
                expect(positionToMidi({ string, fret })).toBe(
                    OPEN_STRING_MIDI[string] + fret,
                );
            }
        }
    });

    it('identifie les positions partageant une même hauteur absolue', () => {
        // Mi aigu E4 (MIDI 64) : corde 1 à vide == corde 2 frette 5
        const a: Position = { string: 1, fret: 0 };
        const b: Position = { string: 2, fret: 5 };
        expect(positionToMidi(a)).toBe(64);
        expect(positionToMidi(b)).toBe(64);
        expect(positionToMidi(a)).toBe(positionToMidi(b));
    });

    it('valide l’intervalle de frettes', () => {
        expect(isValidFret(0)).toBe(true);
        expect(isValidFret(12)).toBe(true);
        expect(isValidFret(-1)).toBe(false);
        expect(isValidFret(13)).toBe(false);
        expect(isValidFret(1.5)).toBe(false);
    });

    it('rejette les positions hors limites', () => {
        expect(() => positionToMidi({ string: 1, fret: 13 })).toThrow(RangeError);
        expect(() => positionToMidi({ string: 1, fret: -1 })).toThrow(RangeError);
        expect(() =>
            positionToMidi({ string: 7 as StringNumber, fret: 0 }),
        ).toThrow(RangeError);
    });
});
