/**
 * Générateur de nombres pseudo-aléatoires déterministe (mulberry32).
 *
 * À seed égale, la séquence produite est identique — indispensable pour
 * rendre la génération du plateau testable et reproductible (SPEC §4).
 */

/** Fonction renvoyant un flottant dans [0, 1). */
export type RandomFn = () => number;

/** Crée un RNG déterministe à partir d'une seed entière. */
export function mulberry32(seed: number): RandomFn {
    let a = seed >>> 0;
    return function (): number {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Entier dans [minInclusive, maxInclusive]. */
export function randomInt(
    rng: RandomFn,
    minInclusive: number,
    maxInclusive: number,
): number {
    return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

/** Copie mélangée (Fisher-Yates) sans muter la source. */
export function shuffle<T>(rng: RandomFn, source: readonly T[]): T[] {
    const arr = source.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
