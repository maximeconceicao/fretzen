import { describe, it, expect } from 'vitest';
import {
    NOTE_NAMES,
    midiToNoteName,
    midiToOctave,
    midiToNoteLabel,
    midiToPitchClass,
} from './notes';

describe('notes', () => {
    it('contient les 12 notes en notation internationale, C en premier', () => {
        expect(NOTE_NAMES).toEqual([
            'C',
            'C#',
            'D',
            'D#',
            'E',
            'F',
            'F#',
            'G',
            'G#',
            'A',
            'A#',
            'B',
        ]);
    });

    it('convertit les repères MIDI en noms de notes', () => {
        expect(midiToNoteName(60)).toBe('C'); // C4
        expect(midiToNoteName(69)).toBe('A'); // A4 (La 440)
        expect(midiToNoteName(40)).toBe('E'); // E2
        expect(midiToNoteName(59)).toBe('B'); // B3
    });

    it('calcule les octaves selon la convention MIDI (C4 = 60)', () => {
        expect(midiToOctave(60)).toBe(4);
        expect(midiToOctave(40)).toBe(2); // E2
        expect(midiToOctave(64)).toBe(4); // E4
        expect(midiToOctave(69)).toBe(4); // A4
    });

    it('produit un libellé complet avec octave', () => {
        expect(midiToNoteLabel(40)).toBe('E2');
        expect(midiToNoteLabel(64)).toBe('E4');
        expect(midiToNoteLabel(60)).toBe('C4');
        expect(midiToNoteLabel(45)).toBe('A2');
    });

    it('calcule une classe de hauteur dans [0, 11]', () => {
        for (let midi = 0; midi <= 127; midi++) {
            const pc = midiToPitchClass(midi);
            expect(pc).toBeGreaterThanOrEqual(0);
            expect(pc).toBeLessThanOrEqual(11);
        }
        expect(midiToPitchClass(60)).toBe(0); // C
    });
});
