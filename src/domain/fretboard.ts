/**
 * Modèle du manche : conversion position (corde, frette) -> hauteur MIDI,
 * et énumération des 78 positions jouables.
 */

import { OPEN_STRING_MIDI, STRING_NUMBERS, type StringNumber } from './tuning';

/** Frette la plus haute prise en compte (0 = corde à vide). */
export const MAX_FRET = 12;

/** Nombre total de positions : 6 cordes × 13 frettes (0 à 12) = 78. */
export const TOTAL_POSITIONS = STRING_NUMBERS.length * (MAX_FRET + 1);

/** Une position précise sur le manche. */
export interface Position {
    /** Numéro de corde (1 = aigu, 6 = grave). */
    readonly string: StringNumber;
    /** Numéro de frette (0 = corde à vide, jusqu'à MAX_FRET). */
    readonly fret: number;
}

/** Vrai si la frette est dans l'intervalle jouable [0, MAX_FRET]. */
export function isValidFret(fret: number): boolean {
    return Number.isInteger(fret) && fret >= 0 && fret <= MAX_FRET;
}

/**
 * Hauteur MIDI d'une position.
 * @throws si la corde ou la frette est hors limites.
 */
export function positionToMidi(position: Position): number {
    const open = OPEN_STRING_MIDI[position.string];
    if (open === undefined) {
        throw new RangeError(`Corde invalide : ${position.string}`);
    }
    if (!isValidFret(position.fret)) {
        throw new RangeError(`Frette invalide : ${position.fret}`);
    }
    return open + position.fret;
}

/** Les 78 positions du manche, ordonnées par corde (1→6) puis frette (0→12). */
export function allPositions(): Position[] {
    const positions: Position[] = [];
    for (const string of STRING_NUMBERS) {
        for (let fret = 0; fret <= MAX_FRET; fret++) {
            positions.push({ string, fret });
        }
    }
    return positions;
}
