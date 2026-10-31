/**
 * Génération du plateau de feuilles.
 *
 * Contraintes (adaptées) :
 *  - 15 à 20 feuilles par partie, à des positions toutes distinctes ;
 *  - plusieurs feuilles peuvent partager la même note (les cibles sont des noms de
 *    note sans octave, cf. game-state) ;
 *  - génération déterministe à partir d'une seed, sans boucle infinie.
 */

import { allPositions, positionToMidi, type Position } from './fretboard';
import { mulberry32, randomInt, shuffle } from './rng';

/** Une feuille placée sur le manche. */
export interface Leaf {
    /** Identifiant stable au sein d'une partie. */
    readonly id: number;
    /** Position (corde, frette) sur le manche. */
    readonly position: Position;
    /** Hauteur absolue en numéro MIDI. */
    readonly midi: number;
}

export interface BoardOptions {
    readonly minLeaves?: number;
    readonly maxLeaves?: number;
}

const DEFAULT_MIN_LEAVES = 15;
const DEFAULT_MAX_LEAVES = 20;

/**
 * Génère un plateau déterministe pour une seed donnée : des positions distinctes
 * tirées aléatoirement parmi les 78 du manche. Les doublons de note sont permis.
 * @throws RangeError si les bornes sont incohérentes.
 */
export function generateBoard(seed: number, options: BoardOptions = {}): Leaf[] {
    const minLeaves = options.minLeaves ?? DEFAULT_MIN_LEAVES;
    const maxLeaves = options.maxLeaves ?? DEFAULT_MAX_LEAVES;
    if (minLeaves <= 0 || maxLeaves < minLeaves) {
        throw new RangeError(
            `Bornes de feuilles invalides : [${minLeaves}, ${maxLeaves}]`,
        );
    }

    const rng = mulberry32(seed);
    const positions: Position[] = allPositions();
    // Nombre voulu, borné par le nombre de positions disponibles.
    const count = Math.min(randomInt(rng, minLeaves, maxLeaves), positions.length);

    return shuffle(rng, positions)
        .slice(0, count)
        .map((position, index) => ({
            id: index,
            position,
            midi: positionToMidi(position),
        }));
}
