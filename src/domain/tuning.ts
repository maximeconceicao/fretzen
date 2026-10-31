/**
 * Accordage standard de la guitare.
 *
 * Les cordes sont numérotées de 1 à 6 selon la convention guitaristique :
 *   - corde 1 = Mi aigu (E4)
 *   - corde 6 = Mi grave (E2)
 *
 * Les hauteurs des cordes à vide sont exprimées en numéros MIDI, ce qui permet
 * de calculer toutes les autres positions par simple addition de la frette.
 */

/** Numéro de corde valide (1 = aigu, 6 = grave). */
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Numéro MIDI de chaque corde à vide, indexé par numéro de corde.
 * E2=40, A2=45, D3=50, G3=55, B3=59, E4=64.
 */
export const OPEN_STRING_MIDI: Readonly<Record<StringNumber, number>> = {
    1: 64, // E4
    2: 59, // B3
    3: 55, // G3
    4: 50, // D3
    5: 45, // A2
    6: 40, // E2
};

/** Liste des numéros de corde, de la plus aiguë (1) à la plus grave (6). */
export const STRING_NUMBERS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];
