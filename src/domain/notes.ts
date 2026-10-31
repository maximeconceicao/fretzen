/**
 * Conversions autour des numéros MIDI.
 *
 * Convention MIDI : C4 = 60. Le nom d'une note est déterminé par `midi % 12`
 * et son octave par `floor(midi / 12) - 1`.
 */

/** Noms des 12 notes en notation internationale, index 0 = C. */
export const NOTE_NAMES = [
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
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** Classe de hauteur (0 = C, 11 = B). */
export function midiToPitchClass(midi: number): number {
    return ((midi % 12) + 12) % 12;
}

/** Nom de note sans octave (ex. 40 -> "E"). */
export function midiToNoteName(midi: number): NoteName {
    return NOTE_NAMES[midiToPitchClass(midi)];
}

/** Octave dans la convention MIDI (ex. 60 -> 4, 40 -> 2). */
export function midiToOctave(midi: number): number {
    return Math.floor(midi / 12) - 1;
}

/** Libellé complet avec octave (ex. 40 -> "E2", 64 -> "E4"). */
export function midiToNoteLabel(midi: number): string {
    return `${midiToNoteName(midi)}${midiToOctave(midi)}`;
}
