/**
 * Meilleur temps par mode de jeu, persisté dans `localStorage`.
 *
 * Le « score » est le temps de la partie en millisecondes : plus il est bas,
 * meilleur il est. Chaque mode (nombre de feuilles) a son propre record.
 *
 * Tous les accès sont protégés : si `localStorage` est indisponible (navigation
 * privée, quota, environnement sans DOM), les fonctions deviennent inertes et le
 * jeu reste jouable sans persistance.
 */

const KEY_PREFIX = 'fretzen.best.';

/** Meilleur temps enregistré pour un mode (ms), ou null si aucun. */
export function getBestTime(mode: number): number | null {
    try {
        const raw = localStorage.getItem(KEY_PREFIX + mode);
        if (raw === null) {
            return null;
        }
        const ms = Number(raw);
        return Number.isFinite(ms) && ms > 0 ? ms : null;
    } catch {
        return null;
    }
}

/**
 * Enregistre `ms` comme nouveau record du mode s'il bat l'ancien (ou s'il n'y
 * en avait pas). Retourne `true` si un nouveau record a été établi.
 */
export function saveBestTime(mode: number, ms: number): boolean {
    if (!Number.isFinite(ms) || ms <= 0) {
        return false;
    }
    const previous = getBestTime(mode);
    if (previous !== null && ms >= previous) {
        return false;
    }
    try {
        localStorage.setItem(KEY_PREFIX + mode, String(Math.round(ms)));
        return true;
    } catch {
        return false;
    }
}
