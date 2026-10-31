import { BlendModes, GameObjects, Geom, Textures, type Scene } from 'phaser';
import type { Leaf } from '../../domain/board-generator';
import { palette } from '../theme';

/** Taille (en pixels) de la texture de feuille avant mise à l'échelle. */
const TEXTURE_SIZE = 26;

/** Clé de la petite texture de feuille utilisée pour les fragments de voltige. */
export const LEAF_FRAGMENT_KEY = 'leaf-frag';

/** Jeu de couleurs d'une feuille (cel-shading + contour). */
interface LeafColors {
    light: number; // reflet
    base: number; // aplat principal
    shade: number; // ombre
    vein: number; // nervure
    outline: number; // contour
}

// Contour charbon foncé (tracé net) et nervures rouge rouille, comme la
// référence : le cerne et les veines ne partagent plus la même teinte.
const LEAF_VEIN = 0xd13b2e; // rouge rouille des nervures
const LEAF_OUTLINE = 0x2b2b2b; // charbon du contour

/**
 * Feuilles d'automne lancéolées (feuille simple « plume »), dans les tons
 * orange : du doré au rouille. Chaque variante est un aplat chaud nuancé
 * (reflet / base / ombre), cerné de charbon et veiné de rouge.
 */
const LEAF_VARIANTS: readonly LeafColors[] = [
    { light: 0xf9cf72, base: 0xf3a94a, shade: 0xdd8a2e, vein: LEAF_VEIN, outline: LEAF_OUTLINE }, // doré
    { light: 0xf8c56e, base: 0xf3994a, shade: 0xdd7a2e, vein: LEAF_VEIN, outline: LEAF_OUTLINE }, // orange
    { light: 0xf4b45c, base: 0xee8a3c, shade: 0xcf6a24, vein: LEAF_VEIN, outline: LEAF_OUTLINE }, // citrouille
    { light: 0xf0a254, base: 0xe4702c, shade: 0xc2561c, vein: LEAF_VEIN, outline: LEAF_OUTLINE }, // rouille
];

/** Distance d'un point `(px,py)` au segment `[a,b]` (espace nervures). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Dessine une feuille simple lancéolée (« feuille plume ») dans le graphics
 * `g`, centrée dans un carré `size`, d'après la référence : lame orange en
 * goutte effilée (pointe en haut, large au tiers inférieur, qui s'affine vers
 * la tige), cernée d'un contour charbon net, parsemée de petits reflets clairs,
 * veinée de rouge (nervure centrale + branches pinnées) et terminée par une
 * courte tige à points rouge/charbon alternés.
 *
 * `angle` incline la feuille (radians), `curve` lui donne une légère courbure
 * organique, `colors` choisit la teinte (variante d'automne).
 */
function drawLeaf(
    g: GameObjects.Graphics,
    size: number,
    opts: { angle?: number; colors?: LeafColors; curve?: number } = {},
): void {
    const angle = opts.angle ?? 0;
    const colors = opts.colors ?? LEAF_VARIANTS[1];
    const curve = opts.curve ?? 0.1;
    const c = size / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Géométrie longitudinale de la lame (ly négatif = vers le haut).
    const tipY = -size * 0.46; // pointe
    const baseY = size * 0.2; // jonction lame / tige
    const stemY = size * 0.44; // bout de la tige
    const bladeLen = baseY - tipY;
    const wMax = size * 0.24; // demi-largeur maximale

    // Demi-largeur de la lame en fonction de `t` (0 base → 1 pointe) : amande
    // effilée aux deux bouts, un peu plus pleine côté base (galbe ovale d'une
    // vraie feuille) — sans le renflement « pilon » d'avant.
    const halfW = (t: number): number => {
        const tt = Math.max(0, Math.min(1, t));
        const oval = Math.pow(Math.sin(Math.PI * tt), 0.68); // pointue aux 2 bouts
        const lean = 0.82 + 0.36 * (1 - tt); // légèrement plus large vers la base
        return wMax * oval * lean;
    };
    // Décalage de l'axe : légère courbure de la nervure centrale.
    const bend = (t: number): number => curve * wMax * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));

    // Nervures pinnées : branches partant de l'axe à ces fractions de `t`.
    const VEIN_STARTS = [0.26, 0.46, 0.66, 0.84];

    // 1re passe : masque de présence + couleur de remplissage par pixel.
    const inside: boolean[] = new Array(size * size).fill(false);
    const fill: number[] = new Array(size * size).fill(0);
    const at = (x: number, y: number) => y * size + x;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const px = x - c + 0.5;
            const py = y - c + 0.5;
            const lx = px * cos + py * sin; // transversal
            const ly = -px * sin + py * cos; // longitudinal (négatif = vers le haut)

            const t = (baseY - ly) / bladeLen; // 0 base → 1 pointe
            const axis = bend(t); // axe courbé
            const q = lx - axis; // écart latéral à l'axe
            const w = halfW(t);
            const isBody = t >= 0 && t <= 1 && Math.abs(q) <= w;
            const isStem = ly >= baseY - 0.5 && ly <= stemY && Math.abs(lx - bend(0)) < size * 0.045;
            if (!isBody && !isStem) {
                continue;
            }

            inside[at(x, y)] = true;

            // Tige : points rouge / charbon alternés le long de la queue.
            if (isStem && !isBody) {
                fill[at(x, y)] = y % 2 === 0 ? colors.vein : colors.outline;
                continue;
            }

            // Cel-shading : lumière diffuse depuis le haut-gauche, en bandes.
            const edge = w > 0.01 ? Math.abs(q) / w : 1; // 0 axe → 1 bord
            const hl = -(px + py) / size + 0.12;
            let col: number;
            if (hl > 0.4) {
                col = colors.light; // reflet
            } else if (hl > 0.04) {
                col = colors.base; // aplat principal
            } else {
                col = colors.shade; // ombre
            }
            // Reflets clairs disséminés, façon tavelures de la référence.
            if (edge < 0.78 && (x * 7 + y * 13) % 11 === 0) {
                col = colors.light;
            }
            // Liseré interne légèrement ombré avant le contour.
            if (edge > 0.82) {
                col = colors.shade;
            }

            // Nervure centrale (rouge), le long de l'axe courbé.
            const L = baseY - ly; // longitudinal depuis la base (px)
            if (Math.abs(q) < 0.9 && t > 0.04 && t < 0.95) {
                col = colors.vein;
            } else {
                // Branches pinnées : segments obliques de part et d'autre.
                for (const u of VEIN_STARTS) {
                    const Ls = u * bladeLen;
                    const reach = halfW(u) * 0.95;
                    let hit = false;
                    for (const s of [-1, 1]) {
                        const d = segDist(q, L, 0, Ls, s * reach, Ls + bladeLen * 0.16);
                        if (d < 0.75) {
                            hit = true;
                            break;
                        }
                    }
                    if (hit && edge < 0.84) {
                        col = colors.vein;
                        break;
                    }
                }
            }

            fill[at(x, y)] = col;
        }
    }

    // 2e passe : contour (pixel intérieur bordé de vide) + remplissage.
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (!inside[at(x, y)]) {
                continue;
            }
            const border =
                x === 0 ||
                y === 0 ||
                x === size - 1 ||
                y === size - 1 ||
                !inside[at(x - 1, y)] ||
                !inside[at(x + 1, y)] ||
                !inside[at(x, y - 1)] ||
                !inside[at(x, y + 1)];
            g.fillStyle(border ? colors.outline : fill[at(x, y)], 1);
            g.fillRect(x, y, 1, 1);
        }
    }
}

/**
 * Génère quelques textures de feuilles pixélisées (SPEC §5) : silhouettes
 * organiques légèrement variées (inclinaison, courbure) pour éviter la
 * répétition. Les textures sont en filtre NEAREST pour conserver l'aspect pixel.
 * @returns les clés de texture créées.
 */
export function createLeafTextures(scene: Scene, variants = 4): string[] {
    const keys: string[] = [];
    const size = TEXTURE_SIZE;
    // Inclinaisons et courbures distinctes par variante pour une touche naturelle.
    const angles = [-0.35, -0.12, 0.14, 0.38];
    const curves = [0.14, -0.1, 0.08, -0.16];
    for (let v = 0; v < variants; v++) {
        const key = `leaf-${v}`;
        if (!scene.textures.exists(key)) {
            const g = scene.make.graphics({ x: 0, y: 0 }, false);
            drawLeaf(g, size, {
                angle: angles[v % angles.length],
                colors: LEAF_VARIANTS[v % LEAF_VARIANTS.length],
                curve: curves[v % curves.length],
            });
            g.generateTexture(key, size, size);
            g.destroy();
            scene.textures.get(key).setFilter(Textures.FilterMode.NEAREST);
        }
        keys.push(key);
    }

    // Petite feuille pour les fragments de voltige.
    if (!scene.textures.exists(LEAF_FRAGMENT_KEY)) {
        const fs = 10;
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        drawLeaf(g, fs, { angle: 0 });
        g.generateTexture(LEAF_FRAGMENT_KEY, fs, fs);
        g.destroy();
        scene.textures.get(LEAF_FRAGMENT_KEY).setFilter(Textures.FilterMode.NEAREST);
    }

    return keys;
}

/**
 * Libère de petites feuilles pixélisées qui s'écartent en tournoyant puis
 * retombent doucement (voltige) : dérive latérale, rotation lente et chute
 * amortie façon feuille au vent. Sert à l'éclatement et à la célébration.
 */
export function spawnLeaves(
    scene: Scene,
    x: number,
    y: number,
    opts: {
        count?: number;
        spread?: number;
        fall?: number;
        depth?: number;
        scale?: number;
    } = {},
): void {
    const count = opts.count ?? 6;
    const spread = opts.spread ?? 36;
    const fall = opts.fall ?? 46;
    for (let i = 0; i < count; i++) {
        const leaf = scene.add.image(x, y, LEAF_FRAGMENT_KEY);
        leaf.setDepth(opts.depth ?? 2);
        leaf.setScale(opts.scale ?? 1);
        leaf.setAngle(Math.random() * 360);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const dx = dir * (spread * 0.3 + Math.random() * spread);
        // Mouvement flottant : certains éclats s'élèvent un peu avant de
        // redescendre, décélération douce (Sine.out) et chute lente.
        const dy = fall * (Math.random() * 1.1 - 0.25);
        const duration = 900 + Math.random() * 700;
        scene.tweens.add({
            targets: leaf,
            x: x + dx,
            y: y + dy,
            angle: leaf.angle + dir * (90 + Math.random() * 150),
            alpha: 0,
            scale: (opts.scale ?? 1) * 0.6,
            duration,
            ease: 'Sine.out',
            onComplete: () => leaf.destroy(),
        });
    }
}

/**
 * Représentation visuelle d'une feuille : sprite pixélisé + ombre douce,
 * respiration discrète, feedback d'erreur non punitif.
 */
export class NoteLeaf extends GameObjects.Container {
    readonly leaf: Leaf;
    private readonly sprite: GameObjects.Image;
    private readonly baseScale: number;

    constructor(
        scene: Scene,
        x: number,
        y: number,
        radius: number,
        leaf: Leaf,
        textureKey: string,
    ) {
        super(scene, x, y);
        this.leaf = leaf;

        const shadow = scene.add.ellipse(
            0,
            radius * 0.55,
            radius * 1.7,
            radius * 0.8,
            0x000000,
            0.18,
        );

        this.sprite = scene.add.image(0, 0, textureKey);
        this.baseScale = (radius * 2) / TEXTURE_SIZE;
        this.sprite.setScale(this.baseScale);

        this.add([shadow, this.sprite]);
        this.setSize(radius * 2, radius * 2);

        // Interactivité portée par le sprite (hit-test centré et fiable) plutôt
        // que par le Container : toute la feuille devient cliquable. Le cercle est
        // exprimé dans l'espace texture (origine haut-gauche), centré, et suit
        // automatiquement l'échelle du sprite.
        this.sprite.setInteractive(
            new Geom.Circle(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2, TEXTURE_SIZE / 2),
            Geom.Circle.Contains,
        );
        if (this.sprite.input) {
            this.sprite.input.cursor = 'pointer';
        }
        this.sprite.on('pointerdown', () => this.emit('pointerdown'));

        scene.add.existing(this);
    }

    /** Respiration/flottement discrets (désactivés si mouvement réduit). */
    startBreathing(reducedMotion: boolean): void {
        if (reducedMotion) {
            return;
        }
        // Déphasage aléatoire pour éviter une pulsation synchrone.
        const delay = Math.random() * 1200;
        this.scene.tweens.add({
            targets: this.sprite,
            scale: this.baseScale * 1.06,
            duration: 1600,
            delay,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
        this.scene.tweens.add({
            targets: this.sprite,
            y: -2,
            duration: 2000,
            delay,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
        // Léger balancement façon feuille au vent.
        this.scene.tweens.add({
            targets: this.sprite,
            angle: 5,
            duration: 2400,
            delay,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut',
        });
    }

    /**
     * Éclatement « bonne réponse » : contraction → rebond → fragments → fin.
     * Désactive aussitôt l'interactivité pour éviter les doubles clics.
     *
     * `intensity` (0 → 1) enrichit l'effet avec le combo (réf. Balatro, SPEC §6) :
     * anneau plus ample, halo plus marqué et davantage d'éclats. Escalade
     * contenue pour rester dans le ton zen.
     */
    burst(reducedMotion: boolean, intensity = 0): void {
        const boost = Math.max(0, Math.min(1, intensity));
        this.sprite.disableInteractive();
        this.scene.tweens.killTweensOf(this.sprite);
        const x = this.x;
        const y = this.y;

        if (reducedMotion) {
            this.scene.tweens.add({
                targets: this,
                alpha: 0,
                scale: 0.6,
                duration: 120,
                onComplete: () => {
                    spawnLeaves(this.scene, x, y, { count: 4, scale: this.baseScale });
                    this.destroy();
                },
            });
            return;
        }

        // Éclatement zen : un halo lumineux s'épanouit, la feuille « respire »
        // une dernière fois puis s'évapore vers le haut en libérant des éclats
        // qui flottent doucement. Rien de brusque — lecture apaisée.
        const r = (this.baseScale * TEXTURE_SIZE) / 2;

        // Anneau clair qui s'étend et s'estompe ; plus ample avec le combo.
        const ring = this.scene.add.circle(x, y, r * 0.85, 0xffffff, 0).setDepth(3);
        ring.setStrokeStyle(3 + boost * 2, palette.amber, 0.85);
        this.scene.tweens.add({
            targets: ring,
            scale: 2.8 + boost * 1.6,
            alpha: 0,
            duration: 520,
            ease: 'Sine.out',
            onComplete: () => ring.destroy(),
        });

        // Halo diffus chaud, en fondu additif ; un peu plus marqué en combo.
        const glow = this.scene.add
            .circle(x, y, r * 0.8, palette.amber, 0.4 + boost * 0.25)
            .setDepth(2);
        glow.setBlendMode(BlendModes.SCREEN);
        this.scene.tweens.add({
            targets: glow,
            scale: 2 + boost * 1,
            alpha: 0,
            duration: 420,
            ease: 'Sine.out',
            onComplete: () => glow.destroy(),
        });

        // Petit « pop » doux, puis évaporation flottante vers le haut.
        this.scene.tweens.chain({
            targets: this.sprite,
            tweens: [{ scale: this.baseScale * 1.22, duration: 150, ease: 'Sine.out' }],
            onComplete: () => {
                spawnLeaves(this.scene, x, y, {
                    count: 7 + Math.round(boost * 6),
                    spread: 30 + boost * 18,
                    fall: 18,
                    scale: this.baseScale,
                });
                this.scene.tweens.add({
                    targets: this.sprite,
                    scale: this.baseScale * 1.4,
                    duration: 360,
                    ease: 'Sine.out',
                });
                this.scene.tweens.add({
                    targets: this,
                    y: y - 16,
                    alpha: 0,
                    duration: 360,
                    ease: 'Sine.out',
                    onComplete: () => this.destroy(),
                });
            },
        });
    }

    /** Feedback d'erreur : courte secousse + teinte corail, sans punition. */
    flashWrong(): void {
        const originX = this.x;
        this.sprite.setTint(palette.coral);
        this.scene.time.delayedCall(180, () => this.sprite.clearTint());
        this.scene.tweens.add({
            targets: this,
            x: originX + 5,
            duration: 45,
            yoyo: true,
            repeat: 3,
            onComplete: () => {
                this.x = originX;
            },
        });
    }
}
