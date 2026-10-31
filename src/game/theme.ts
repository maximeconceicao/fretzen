/**
 * Palette et constantes visuelles (SPEC §5) : minimalisme naturel, contraste
 * et lisibilité avant décoration.
 *
 * Deux formes : `palette` (entiers 0xRRGGBB pour Phaser) et `css` (chaînes
 * pour les styles de texte).
 */

// Palette « Matcha minimal » : fond lin, accents vert matcha pour l'interface
// (bouton, contours), tons sombres pour le texte. Les couleurs des feuilles
// (automne) sont définies à part dans NoteLeaf pour contraster chaudement.
export const palette = {
    charcoal: 0xe8e6d5, // fond lin
    charcoalDeep: 0xd8d6c0, // panneau du manche (carte)
    stone: 0x9c9780, // gris pierre (frettes, pistes, texte secondaire)
    stoneLight: 0xbfbaa4,
    sage: 0x7fb03a, // matcha vif (bouton, accent UI)
    moss: 0x5a7d33, // vert profond (survol, panneau)
    mossDark: 0x35471f, // contour UI
    ivory: 0x3c3f2e, // texte principal (encre verte)
    cream: 0xf5f3e6, // cordes, reflets clairs
    amber: 0xe6a23c, // accent feedback positif / progression (ambre chaud)
    honey: 0xeacc7f, // miel doux (fond du bouton) — chaud mais apaisé
    honeyDeep: 0xe0b968, // miel plus soutenu (survol du bouton)
    bark: 0x6b4a22, // brun écorce (contour + texte du bouton)
    coral: 0xcb7b5a, // accent feedback négatif (terracotta)
} as const;

/**
 * Police de l'interface : Fredoka, une sans-serif arrondie et chaleureuse pour
 * l'ambiance cosy. Repli sur les polices système si elle n'est pas chargée.
 */
export const fontFamily = 'Fredoka, "Segoe UI", system-ui, sans-serif';

/**
 * Densité de pixels de l'écran, bornée à 2 pour limiter le coût mémoire/GPU sur
 * les écrans à très haute densité (téléphones 3×). Le jeu est rendu à cette
 * densité pour rester net sur les écrans Retina : le canvas garde le repère de
 * coordonnées 1024×768 (via le zoom caméra dans Game.ts) mais son tampon de
 * rendu réel est multiplié par `DPR`, évitant le flou d'un simple étirement CSS.
 */
export const DPR = Math.min(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    2,
);

/** Résolution des textes : rendus à la densité écran pour rester nets au zoom. */
export const TEXT_RESOLUTION = DPR;

/** Repère de coordonnées « logique » du jeu (tout le code de scène y réfère). */
export const DESIGN_WIDTH = 1024;
export const DESIGN_HEIGHT = 768;

export const css = {
    ivory: '#3c3f2e', // texte principal
    cream: '#585c44', // texte secondaire doux (instructions)
    stone: '#7a7660', // texte tertiaire / compteurs
    stoneLight: '#9c9780',
    sage: '#7fb03a',
    moss: '#5a7d33',
    mossDark: '#35471f', // texte sur bouton matcha
    amber: '#9c6a1e', // ambre assombri pour rester lisible sur fond clair
    bark: '#6b4a22', // brun écorce (texte du bouton)
    coral: '#cb7b5a',
} as const;

/** Mélange linéaire de deux couleurs 0xRRGGBB (t ∈ [0,1]). */
export function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
}
