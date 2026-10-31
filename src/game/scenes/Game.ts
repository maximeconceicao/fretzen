import { Scene, GameObjects, BlendModes, Scenes } from 'phaser';
import { generateBoard } from '../../domain/board-generator';
import { GameState } from '../../domain/game-state';
import { mulberry32 } from '../../domain/rng';
import { MAX_FRET } from '../../domain/fretboard';
import { STRING_NUMBERS, OPEN_STRING_MIDI, type StringNumber } from '../../domain/tuning';
import { midiToNoteName } from '../../domain/notes';
import { NoteLeaf, createLeafTextures } from '../entities/NoteLeaf';
import { AudioManager } from '../audio/audio-manager';
import { getBestTime, saveBestTime } from '../best-scores';
import {
    palette,
    css,
    lerpColor,
    fontFamily,
    DPR,
    TEXT_RESOLUTION,
    DESIGN_WIDTH,
    DESIGN_HEIGHT,
} from '../theme';

/** Frettes portant un repère visuel (SPEC §5). */
const FRET_MARKERS = [3, 5, 7, 9, 12];

/** Frettes dont le numéro est affiché sous le manche (repère de lecture). */
const FRET_NUMBERS = [3, 5, 7, 12];

/** Modes de jeu : nombre de feuilles à ramasser. Chacun a son propre record. */
const MODES = [10, 15, 20] as const;
type Mode = (typeof MODES)[number];

const INSTRUCTION_TEXT =
    'Repère la note affichée sur le manche et touche sa feuille.\n' +
    'Ramasse-les toutes !';

/**
 * Scène de jeu — Phase 4 : direction artistique.
 * Palette naturelle, manche stylisé, feuilles pixélisées organiques.
 * Les animations d'éclatement et l'audio arrivent en Phase 5.
 */
export class Game extends Scene {
    // Géométrie du manche (canvas 1024×768).
    private readonly boardLeft = 170;
    private readonly boardRight = 890;
    private readonly boardTop = 259;
    private readonly boardBottom = 509;

    private state: GameState | null = null;
    private mode: Mode = MODES[0];
    private leafViews: NoteLeaf[] = [];
    private leafTextureKeys: string[] = [];
    private reducedMotion = false;
    private readonly audio = new AudioManager();

    private targetText!: GameObjects.Text;
    private comboText!: GameObjects.Text;
    private objectiveText!: GameObjects.Text;
    private timeText!: GameObjects.Text;
    private muteIcon!: GameObjects.Graphics;
    private fullscreenIcon!: GameObjects.Graphics;
    /** Instant (horloge de scène) de la dernière sortie de plein écran, pour
     *  neutraliser l'Échap qui l'a provoquée et éviter une pause involontaire. */
    private lastFullscreenExit = -Infinity;
    private pauseText!: GameObjects.Text;
    private progressBar!: GameObjects.Rectangle;
    private readonly progressWidth = 440;

    private overlay: GameObjects.Container | null = null;

    /** Handler d'auto-pause (onglet masqué), conservé pour pouvoir le retirer. */
    private onVisibilityChange?: () => void;

    constructor() {
        super('Game');
    }

    create(): void {
        // Suréchantillonnage HiDPI : le tampon de rendu fait DESIGN × DPR pixels
        // (cf. main.ts). On « dézoome » la caméra d'autant pour que tout le code
        // continue de travailler dans le repère 1024×768, mais avec un rendu net
        // sur écrans Retina. centerOn recadre sur le centre du repère logique
        // (sinon le zoom reste centré sur le milieu du tampon, deux fois trop loin).
        this.cameras.main.setZoom(DPR);
        this.cameras.main.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);

        this.reducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.leafTextureKeys = createLeafTextures(this);

        this.drawBackground();
        this.startAmbientLeaves();

        // Note cible : élément prioritaire (SPEC §7), centrée dans la bande haute.
        // Remontée pour laisser respirer le badge de combo juste en dessous.
        this.targetText = this.add
            .text(512, 112, '—', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 92,
                fontStyle: '600',
                color: css.ivory,
            })
            .setOrigin(0.5);

        // Badge de combo : enchaînement de bonnes réponses (réf. Balatro, SPEC §6).
        // Discret par défaut (caché sous 2), pulse à chaque palier, en ambre.
        this.comboText = this.add
            .text(512, 182, '', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 30,
                fontStyle: '700',
                color: css.amber,
            })
            .setOrigin(0.5)
            .setAlpha(0);

        // --- Bloc de stats secondaires, regroupé sous le manche --------------
        // Barre de progression d'abord, puis les compteurs en dessous.
        const barY = 590;
        const statsY = 622;
        const barLeft = 512 - this.progressWidth / 2;
        const barRight = 512 + this.progressWidth / 2;

        this.objectiveText = this.add
            .text(barLeft, statsY, '', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 20,
                color: css.stone,
            })
            .setOrigin(0, 0.5);

        this.timeText = this.add
            .text(barRight, statsY, '0:00', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 20,
                color: css.stone,
            })
            .setOrigin(1, 0.5);

        // Barre de progression discrète (SPEC §7) ; piste éclaircie pour rester
        // lisible sur le fond charbon.
        this.add
            .rectangle(512, barY, this.progressWidth, 8, lerpColor(palette.charcoal, palette.stone, 0.18))
            .setStrokeStyle(1, palette.stone, 0.5)
            .setOrigin(0.5);
        this.progressBar = this.add
            .rectangle(barLeft, barY, 0, 8, palette.amber)
            .setOrigin(0, 0.5);

        // Bascule du son (effets) — SPEC §8. Haut-parleur monochrome dessiné à la
        // main : ondes = actif, croix = coupé ; suit la couleur du thème.
        this.muteIcon = this.add.graphics().setPosition(966, 36).setDepth(20);
        this.drawSpeaker(palette.stone, false);
        const muteHit = this.add
            .rectangle(966, 36, 34, 30, 0x000000, 0)
            .setDepth(20)
            .setInteractive({ useHandCursor: true });
        muteHit.on('pointerdown', () => {
            const muted = this.audio.toggleMuted();
            this.drawSpeaker(muted ? palette.coral : palette.stone, muted);
        });

        // Bascule du plein écran (API Fullscreen du navigateur) — SPEC §8.
        // Toujours visible (menu comme partie) ; icône dessinée à la main qui
        // passe de « crochets sortants » (entrer) à « crochets rentrants » (sortir).
        // L'API exige un geste utilisateur : d'où le bouton (+ touche F).
        this.fullscreenIcon = this.add.graphics().setPosition(894, 36).setDepth(20);
        this.drawFullscreen(palette.stone);
        const fullscreenHit = this.add
            .rectangle(894, 36, 30, 30, 0x000000, 0)
            .setDepth(20)
            .setInteractive({ useHandCursor: true });
        fullscreenHit.on('pointerover', () => this.drawFullscreen(palette.ivory));
        fullscreenHit.on('pointerout', () => this.drawFullscreen(palette.stone));
        fullscreenHit.on('pointerdown', () => this.scale.toggleFullscreen());
        this.input.keyboard?.on('keydown-F', () => this.scale.toggleFullscreen());
        // Redessine l'icône selon l'état réel (clic, touche F, ou Échap système).
        this.scale.on('enterfullscreen', () => this.drawFullscreen(palette.stone));
        this.scale.on('leavefullscreen', () => {
            this.drawFullscreen(palette.stone);
            this.lastFullscreenExit = this.time.now;
        });

        // Bouton pause — visible uniquement pendant une partie.
        this.pauseText = this.add
            .text(930, 36, '⏸', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 24,
                color: css.stone,
            })
            .setOrigin(0.5)
            .setDepth(20)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this.pauseText.on('pointerover', () => this.pauseText.setColor(css.ivory));
        this.pauseText.on('pointerout', () => this.pauseText.setColor(css.stone));
        // Bascule pause ↔ reprise : l'icône restant visible pendant la pause,
        // un clic doit aussi pouvoir reprendre la partie.
        this.pauseText.on('pointerdown', () => this.togglePause());

        // Raccourcis clavier : Échap / P basculent pause ↔ reprise. En plein
        // écran, Échap est réservé par le navigateur pour en sortir : on
        // n'enclenche alors pas la pause (double effet), que l'événement arrive
        // avant (isFullscreen encore vrai) ou juste après la sortie (fenêtre de
        // garde via lastFullscreenExit). P reste disponible en plein écran.
        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.scale.isFullscreen || this.time.now - this.lastFullscreenExit < 250) {
                return;
            }
            this.togglePause();
        });
        this.input.keyboard?.on('keydown-P', () => this.togglePause());

        // Auto-pause quand l'onglet passe en arrière-plan : le chronomètre est en
        // temps réel, sans quoi le temps passé ailleurs compterait dans le score.
        // On gèle seulement (pas de reprise auto) pour laisser le joueur revenir
        // via l'écran de pause. `pauseGame` ignore les phases hors `playing`.
        if (typeof document !== 'undefined') {
            this.onVisibilityChange = () => {
                if (document.hidden) {
                    this.pauseGame();
                }
            };
            document.addEventListener('visibilitychange', this.onVisibilityChange);
            this.events.once(Scenes.Events.SHUTDOWN, () => {
                if (this.onVisibilityChange) {
                    document.removeEventListener(
                        'visibilitychange',
                        this.onVisibilityChange,
                    );
                    this.onVisibilityChange = undefined;
                }
            });
        }

        this.drawFretboard();
        this.refreshHud();
        this.showInstruction();
    }

    update(): void {
        if (this.state && this.state.phase === 'playing') {
            this.timeText.setText(this.formatTime(this.state.elapsedMs()));
        }
    }

    // --- Géométrie ---------------------------------------------------------

    private get stringSpacing(): number {
        return (this.boardBottom - this.boardTop) / (STRING_NUMBERS.length - 1);
    }

    private get fretSpacing(): number {
        return (this.boardRight - this.boardLeft) / MAX_FRET;
    }

    private positionToXY(string: StringNumber, fret: number): {
        x: number;
        y: number;
    } {
        return {
            x: this.fretCenterX(fret),
            y: this.boardTop + this.stringRow(string) * this.stringSpacing,
        };
    }

    /**
     * Rangée d'affichage d'une corde (convention tablature) : Mi aigu (corde 1)
     * en haut, Mi grave (corde 6) en bas.
     */
    private stringRow(string: StringNumber): number {
        return string - 1;
    }

    /**
     * Abscisse du centre d'une case (entre deux frettes), et non sur la frette.
     * La corde à vide (frette 0) se place dans la zone « ouverte », avant le sillet.
     */
    private fretCenterX(fret: number): number {
        if (fret === 0) {
            return this.boardLeft - this.fretSpacing * 0.5;
        }
        return this.boardLeft + (fret - 0.5) * this.fretSpacing;
    }

    /** Bord gauche de la zone à vide (avant le sillet). */
    private get openLeft(): number {
        return this.boardLeft - this.fretSpacing * 0.72;
    }

    // --- Rendu statique ----------------------------------------------------

    private drawBackground(): void {
        this.cameras.main.setBackgroundColor(palette.charcoal);

        // Dégradé vertical doux (haut lumineux → bas sable chaud) pour une
        // atmosphère claire et enveloppante plutôt qu'un aplat.
        const top = lerpColor(palette.charcoal, 0xffffff, 0.4);
        const bottom = lerpColor(palette.charcoal, palette.stone, 0.28);
        const grad = this.add.graphics();
        const steps = 48;
        const h = 768 / steps;
        for (let i = 0; i < steps; i++) {
            grad.fillStyle(lerpColor(top, bottom, i / (steps - 1)), 1);
            grad.fillRect(0, Math.floor(i * h), 1024, Math.ceil(h) + 1);
        }

        // Halo lumineux doux centré sur le manche pour y attirer l'œil.
        const glow = this.add.graphics();
        glow.fillStyle(0xffffff, 1);
        glow.fillCircle(512, 435, 470);
        glow.setBlendMode(BlendModes.SCREEN);
        glow.setAlpha(0.14);

        // Fondu doux des bords vers la teinte lin du pourtour (cf. style.css /
        // backgroundColor du jeu) : le canvas 4:3 se fond dans la page colorée au
        // lieu d'afficher un cadre. Remplace l'ancienne vignette sombre, pensée
        // pour un fond noir et devenue un bord rayé incohérent sur fond clair.
        const feather = this.add.graphics();
        const band = 64; // profondeur du fondu
        const fsteps = 32;
        const t = band / fsteps; // épaisseur de chaque cadre
        for (let i = 0; i < fsteps; i++) {
            const d = (i / fsteps) * band; // distance au bord (0 = tout au bord)
            const a = 0.8 * Math.pow(1 - i / fsteps, 2); // opaque au bord → nul vers l'intérieur
            feather.fillStyle(palette.charcoalDeep, a);
            feather.fillRect(d, d, 1024 - 2 * d, t); // haut
            feather.fillRect(d, 768 - d - t, 1024 - 2 * d, t); // bas
            feather.fillRect(d, d, t, 768 - 2 * d); // gauche
            feather.fillRect(1024 - d - t, d, t, 768 - 2 * d); // droite
        }
        feather.setDepth(0);
    }

    /**
     * Feuilles pixélisées dérivant lentement en arrière-plan (ambiance cosy).
     * Discrètes (faible opacité, sous le manche) et désactivées en mouvement
     * réduit. Chaque feuille se recycle quand elle sort de l'écran.
     */
    private startAmbientLeaves(): void {
        if (this.reducedMotion) {
            return;
        }
        const COUNT = 14;
        for (let i = 0; i < COUNT; i++) {
            // Mêmes textures détaillées que les feuilles du manche (galbe, nervures,
            // ombrage), simplement réduites : les feuilles d'ambiance restent
            // cohérentes avec celles à ramasser plutôt que de petits losanges.
            const key =
                this.leafTextureKeys[
                    Math.floor(Math.random() * this.leafTextureKeys.length)
                ];
            const leaf = this.add.image(
                Math.random() * 1024,
                Math.random() * 768,
                key,
            );
            leaf.setDepth(0);
            leaf.setAlpha(0.12 + Math.random() * 0.12);
            leaf.setScale(0.3 + Math.random() * 0.45);
            leaf.setAngle(Math.random() * 360);
            this.driftLeaf(leaf);
        }
    }

    /** Programme une traversée verticale lente d'une feuille d'ambiance. */
    private driftLeaf(leaf: GameObjects.Image): void {
        const startX = Math.random() * 1024;
        leaf.setPosition(startX, -40);
        const duration = 14000 + Math.random() * 12000;
        const sway = 40 + Math.random() * 90;
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.tweens.add({
            targets: leaf,
            y: 808,
            duration,
            ease: 'Linear',
            onComplete: () => this.driftLeaf(leaf),
        });
        // Dérive latérale en balancier.
        this.tweens.add({
            targets: leaf,
            x: startX + dir * sway,
            duration: duration / 3,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.inOut',
        });
        // Rotation lente continue.
        this.tweens.add({
            targets: leaf,
            angle: leaf.angle + dir * 180,
            duration,
            ease: 'Linear',
        });
    }

    private drawFretboard(): void {
        // Padding symétrique autour des cordes : assez large pour loger la bande
        // des numéros de frettes sous la 6e corde, à l'intérieur du panneau, sans
        // chevaucher les feuilles. Symétrique → cordes toujours centrées (384),
        // manche équilibré. L'espacement avec le combo (au-dessus) et la barre de
        // progression (en dessous) se règle en déplaçant ces éléments, pas en
        // rognant le panneau.
        const padY = 46;
        const leftX = this.openLeft - 48; // gouttière gauche pour les noms de cordes
        const rightX = this.boardRight + 34;
        const panelW = rightX - leftX;
        const panelH = this.boardBottom - this.boardTop + padY * 2;
        const panel = this.add.graphics();
        // Panneau du manche (coins arrondis), teinte chaude sombre.
        panel.fillStyle(palette.charcoalDeep, 1);
        panel.fillRoundedRect(leftX, this.boardTop - padY, panelW, panelH, 14);
        panel.lineStyle(2, palette.mossDark, 0.8);
        panel.strokeRoundedRect(leftX, this.boardTop - padY, panelW, panelH, 14);

        const g = this.add.graphics();
        const midY = (this.boardTop + this.boardBottom) / 2;

        // Repères de frettes (derrière les cordes).
        g.fillStyle(palette.stone, 0.55);
        for (const fret of FRET_MARKERS) {
            const x = this.boardLeft + (fret - 0.5) * this.fretSpacing;
            if (fret === 12) {
                // Double point placé comme sur une vraie guitare : au centre du
                // carré B–G (rangées 1–2) et du carré D–A (rangées 3–4). Avec
                // midY au centre du manche (rangée 2,5), l'écart vaut exactement
                // un interligne de corde.
                const dotGap = this.stringSpacing;
                g.fillCircle(x, midY - dotGap, 5);
                g.fillCircle(x, midY + dotGap, 5);
            } else {
                g.fillCircle(x, midY, 5);
            }
        }

        // Frettes (lignes verticales) ; sillet plus clair et épais.
        for (let fret = 0; fret <= MAX_FRET; fret++) {
            const x = this.boardLeft + fret * this.fretSpacing;
            if (fret === 0) {
                g.lineStyle(6, palette.cream, 1);
            } else {
                g.lineStyle(2, palette.stone, 0.7);
            }
            g.lineBetween(x, this.boardTop, x, this.boardBottom);
        }

        // Cordes (lignes horizontales) : les graves (corde 6) plus épaisses.
        // Prolongées dans la zone à vide (avant le sillet).
        for (const string of STRING_NUMBERS) {
            const y = this.boardTop + this.stringRow(string) * this.stringSpacing;
            const thickness = 1 + (string - 1) * 0.5; // corde 1 (aiguë) fine → corde 6 épaisse
            g.lineStyle(thickness, palette.cream, 0.85);
            g.lineBetween(this.openLeft, y, this.boardRight, y);
        }

        this.drawLabels();
        this.drawFretNumbers();
    }

    /**
     * Numéros des frettes repères, dans la bande basse du panneau (sous la 6e
     * corde, à l'intérieur du manche), alignés sous leurs points. Logés dans le
     * padding agrandi, sous la portée des feuilles et de leurs ombres (~525).
     */
    private drawFretNumbers(): void {
        // boardBottom + 30 : sous les feuilles de la 6e corde, et à l'intérieur
        // du panneau (dont le bas est à boardBottom + padY = boardBottom + 42).
        const y = this.boardBottom + 30;
        for (const fret of FRET_NUMBERS) {
            const x = this.boardLeft + (fret - 0.5) * this.fretSpacing;
            this.add
                .text(x, y, String(fret), {
                    fontFamily,
                    resolution: TEXT_RESOLUTION,
                    fontSize: 13,
                    color: css.stone,
                })
                .setOrigin(0.5)
                .setAlpha(0.7)
                // Au-dessus des feuilles d'ambiance qui dérivent en fond (depth 0).
                .setDepth(4);
        }
    }

    /** Noms des cordes à vide, dans la gouttière à gauche. */
    private drawLabels(): void {
        const labelX = this.openLeft - 30;
        for (const string of STRING_NUMBERS) {
            const y = this.boardTop + this.stringRow(string) * this.stringSpacing;
            this.add
                .text(labelX, y, midiToNoteName(OPEN_STRING_MIDI[string]), {
                    fontFamily,
                    resolution: TEXT_RESOLUTION,
                    fontSize: 15,
                    color: css.stone,
                })
                .setOrigin(0.5)
                .setAlpha(0.7);
        }
    }

    // --- Cycle de partie ---------------------------------------------------

    private beginGame(): void {
        for (const view of this.leafViews) {
            view.destroy();
        }
        this.leafViews = [];
        this.comboText.setAlpha(0).setText('');
        this.pauseText.setText('⏸').setVisible(true);

        const seed = Math.floor(Math.random() * 0xffffffff);
        const board = generateBoard(seed, { minLeaves: this.mode, maxLeaves: this.mode });
        this.state = new GameState(board, mulberry32((seed ^ 0x9e3779b9) >>> 0));

        const radius = Math.min(this.stringSpacing, this.fretSpacing) * 0.34;
        board.forEach((leaf, index) => {
            const { x, y } = this.positionToXY(leaf.position.string, leaf.position.fret);
            const key =
                this.leafTextureKeys[
                    Math.floor(Math.random() * this.leafTextureKeys.length)
                ];
            const view = new NoteLeaf(this, x, y, radius, leaf, key);
            view.setDepth(1);
            view.on('pointerdown', () => this.handleLeafClick(view));
            this.leafViews.push(view);

            // Apparition progressive (SPEC §6).
            if (this.reducedMotion) {
                view.startBreathing(true);
            } else {
                view.setScale(0.4);
                view.setAlpha(0);
                this.tweens.add({
                    targets: view,
                    alpha: 1,
                    scale: 1,
                    duration: 300,
                    delay: index * 22,
                    ease: 'Back.out',
                    onComplete: () => view.startBreathing(false),
                });
            }
        });

        this.state.start();
        this.refreshHud();
    }

    private handleLeafClick(view: NoteLeaf): void {
        if (!this.state) {
            return;
        }
        const result = this.state.clickLeaf(view.leaf.id);
        if (result === 'correct') {
            const combo = this.state.combo;
            // Intensité d'escalade bornée (ton zen) : pleine échelle vers ~7 d'affilée.
            const intensity = Math.min(1, (combo - 1) / 6);
            // Retirer immédiatement de la liste (anti double-clic) ; l'éclatement
            // se joue sans bloquer la progression (SPEC §6).
            this.leafViews = this.leafViews.filter((v) => v !== view);
            this.audio.playCorrect(
                view.leaf.midi,
                view.leaf.position.fret,
                view.leaf.position.string,
                combo,
            );
            view.burst(this.reducedMotion, intensity);
            this.showCombo(combo);
            this.refreshHud();
            if (this.state.phase === 'finalizing') {
                this.enterFinalizing();
            }
        } else if (result === 'wrong') {
            this.audio.playWrong();
            view.flashWrong();
            this.hideCombo();
        }
    }

    /**
     * Affiche le badge de combo « ×N » à partir de 2 d'affilée, avec un petit
     * rebond à chaque palier (le feedback monte avec l'enchaînement, SPEC §6).
     */
    private showCombo(combo: number): void {
        if (combo < 2) {
            this.comboText.setAlpha(0).setText('');
            return;
        }
        this.comboText.setText(`×${combo}`);
        // Teinte qui se réchauffe légèrement vers le corail quand l'enchaînement grimpe.
        const warmth = Math.min(1, (combo - 2) / 8);
        this.comboText.setColor(css.amber);
        if (this.reducedMotion) {
            this.comboText.setAlpha(1).setScale(1);
            return;
        }
        this.comboText.setAlpha(1).setScale(1.4 + warmth * 0.3);
        this.tweens.add({
            targets: this.comboText,
            scale: 1,
            duration: 320,
            ease: 'Back.out',
        });
    }

    /** Masque le badge de combo en douceur (mauvais clic ou nouvelle partie). */
    private hideCombo(): void {
        if (this.reducedMotion) {
            this.comboText.setAlpha(0).setText('');
            return;
        }
        this.tweens.add({
            targets: this.comboText,
            alpha: 0,
            duration: 220,
            ease: 'Sine.out',
            onComplete: () => this.comboText.setText(''),
        });
    }

    private enterFinalizing(): void {
        this.hideCombo();
        this.pauseText.setVisible(false);
        this.targetText.setText('✓');
        // Le ✓ éclot doucement (petit rebond) pour saluer la fin de manche.
        if (!this.reducedMotion) {
            this.targetText.setScale(0.6);
            this.tweens.add({
                targets: this.targetText,
                scale: 1,
                duration: 460,
                ease: 'Back.out',
            });
        }
        this.audio.playVictory();
        this.celebrate();
        // Court sas avant l'écran de victoire, le temps de la célébration.
        this.time.delayedCall(650, () => {
            this.state?.finalize();
            this.showVictory();
        });
    }

    /**
     * Célébration de victoire : une pluie de feuilles lente et douce descend
     * de tout le haut de l'écran, chaque feuille dérivant en balancier façon
     * chute d'automne. Volontairement apaisée (ton zen) plutôt qu'explosive.
     */
    private celebrate(): void {
        if (this.reducedMotion) {
            return;
        }
        const COUNT = 30;
        for (let i = 0; i < COUNT; i++) {
            this.time.delayedCall(i * 90, () => {
                const startX = 40 + Math.random() * 944;
                const key =
                    this.leafTextureKeys[
                        Math.floor(Math.random() * this.leafTextureKeys.length)
                    ];
                const leaf = this.add.image(startX, -40, key);
                leaf.setDepth(11); // au-dessus du voile de victoire
                leaf.setScale(0.5 + Math.random() * 0.6);
                leaf.setAngle(Math.random() * 360);
                leaf.setAlpha(0.9);
                const dir = Math.random() < 0.5 ? -1 : 1;
                const duration = 3200 + Math.random() * 2200;
                // Descente lente jusqu'en bas de l'écran.
                this.tweens.add({
                    targets: leaf,
                    y: 820,
                    duration,
                    ease: 'Sine.in',
                    onComplete: () => leaf.destroy(),
                });
                // Balancier latéral doux.
                this.tweens.add({
                    targets: leaf,
                    x: startX + dir * (40 + Math.random() * 70),
                    duration: duration / 3,
                    yoyo: true,
                    repeat: 2,
                    ease: 'Sine.inOut',
                });
                // Rotation lente et continue.
                this.tweens.add({
                    targets: leaf,
                    angle: leaf.angle + dir * (120 + Math.random() * 160),
                    duration,
                    ease: 'Linear',
                });
            });
        }
    }

    private refreshHud(): void {
        if (!this.state) {
            this.objectiveText.setText('Objectif : —');
            this.timeText.setText('0:00');
            this.progressBar.width = 0;
            return;
        }
        const target = this.state.target;
        if (this.state.phase === 'playing') {
            this.targetText.setText(target ? target.label : '—');
        }
        this.objectiveText.setText(
            `Objectif : ${this.state.cleared} / ${this.state.total}`,
        );
        this.timeText.setText(this.formatTime(this.state.elapsedMs()));
        const ratio = this.state.total === 0 ? 0 : this.state.cleared / this.state.total;
        this.progressBar.width = this.progressWidth * ratio;
    }

    // --- Pause -------------------------------------------------------------

    /** Bascule pause ↔ reprise (bouton ⏸ ou touches Échap/P). */
    private togglePause(): void {
        if (!this.state) {
            return;
        }
        if (this.state.paused) {
            this.resumeGame();
        } else if (this.state.phase === 'playing') {
            this.pauseGame();
        }
    }

    private pauseGame(): void {
        if (!this.state || this.state.phase !== 'playing' || this.state.paused) {
            return;
        }
        this.state.pause();
        // L'icône reste visible et devient un bouton « lecture » (▶) : elle sert
        // alors à reprendre (cf. togglePause). Elle est posée au-dessus du voile.
        this.pauseText.setText('▶');
        this.showPauseOverlay();
    }

    private resumeGame(): void {
        if (!this.state || !this.state.paused) {
            return;
        }
        this.state.resume();
        this.closeOverlay();
        this.pauseText.setText('⏸').setVisible(true);
    }

    /**
     * Écran de pause : voile interactif (absorbe les clics sur les feuilles) et
     * trois actions centrées — reprendre, rejouer (même mode), choisir un mode.
     */
    private showPauseOverlay(): void {
        const dim = this.add
            .rectangle(512, 384, 1024, 768, palette.charcoal, 0.72)
            .setInteractive();
        const heading = this.add
            .text(512, 264, 'Pause', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 44,
                fontStyle: '600',
                color: css.ivory,
            })
            .setOrigin(0.5);

        const resume = this.makeButton(512, 344, 'Reprendre');
        resume.on('pointerdown', () => this.resumeGame());

        const replay = this.makeButton(512, 416, 'Rejouer');
        replay.on('pointerdown', () => {
            this.closeOverlay();
            this.beginGame();
        });

        const chooseMode = this.makeButton(512, 488, 'Choisir un mode');
        chooseMode.on('pointerdown', () => {
            this.closeOverlay();
            this.showInstruction();
        });

        this.overlay = this.add
            .container(0, 0, [dim, heading, resume, replay, chooseMode])
            .setDepth(10);
    }

    // --- Écrans ------------------------------------------------------------

    private showInstruction(): void {
        // Aucune partie active sur l'écran de choix : évite qu'un Échap/P y
        // reprenne une partie laissée en pause.
        this.state = null;
        // Neutralise l'affichage de la partie précédente derrière le voile.
        this.targetText.setText('—').setScale(1);
        this.comboText.setAlpha(0).setText('');
        this.pauseText.setVisible(false);

        const dim = this.add.rectangle(512, 384, 1024, 768, palette.charcoal, 0.8);
        const heading = this.add
            .text(512, 276, 'Prêt à jouer ?', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 42,
                fontStyle: '600',
                color: css.ivory,
            })
            .setOrigin(0.5);
        const instr = this.add
            .text(512, 354, INSTRUCTION_TEXT, {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 23,
                color: css.cream,
                align: 'center',
                lineSpacing: 10,
            })
            .setOrigin(0.5);
        const items: GameObjects.GameObject[] = [dim, heading, instr];
        items.push(...this.buildModeSelector(458));

        this.overlay = this.add.container(0, 0, items).setDepth(10);
    }

    /**
     * Trois boutons de mode (10 / 15 / 20 feuilles) alignés, chacun surmontant
     * son meilleur temps. Sélectionner un mode démarre aussitôt une partie.
     * @returns les objets à ajouter à l'overlay.
     */
    private buildModeSelector(y: number): GameObjects.GameObject[] {
        const objects: GameObjects.GameObject[] = [];
        const spacing = 185;
        MODES.forEach((mode, i) => {
            const cx = 512 + (i - 1) * spacing;
            const btn = this.makeButton(cx, y, `${mode} feuilles`, {
                width: 165,
                fontSize: 21,
            });
            btn.on('pointerdown', () => this.selectModeAndStart(mode));

            const best = getBestTime(mode);
            const record = this.add
                .text(cx, y + 48, best === null ? 'Record : —' : `Record : ${this.formatTime(best)}`, {
                    fontFamily,
                    resolution: TEXT_RESOLUTION,
                    fontSize: 15,
                    color: css.stone,
                })
                .setOrigin(0.5);

            objects.push(btn, record);
        });
        return objects;
    }

    /** Fixe le mode, active l'audio (autoplay) et lance une partie. */
    private selectModeAndStart(mode: Mode): void {
        this.mode = mode;
        // Première interaction utilisateur : on active l'audio (autoplay).
        this.audio.resume();
        this.closeOverlay();
        this.beginGame();
    }

    private showVictory(): void {
        if (!this.state) {
            return;
        }
        const elapsed = this.state.elapsedMs();
        const total = this.formatTime(elapsed);
        // Enregistre le temps comme record du mode courant (le cas échéant) et
        // relit le meilleur pour l'afficher.
        const isRecord = saveBestTime(this.mode, elapsed);
        const best = getBestTime(this.mode);

        // Voile un peu plus léger que l'écran de départ : la pluie de feuilles
        // reste visible derrière/devant pour une fin chaleureuse.
        const dim = this.add.rectangle(512, 384, 1024, 768, palette.charcoal, 0.62);
        const heading = this.add
            .text(512, 238, 'Toutes ramassées !', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 50,
                fontStyle: '700',
                color: css.amber,
            })
            .setOrigin(0.5);
        const timeLabel = this.add
            .text(512, 304, `Temps (${this.mode} feuilles) : ${total}`, {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 28,
                color: css.ivory,
            })
            .setOrigin(0.5);

        const cascade: (GameObjects.Text | GameObjects.Container)[] = [timeLabel];

        // Record du mode : célébré s'il vient d'être battu, sinon rappelé.
        const recordLabel = this.add
            .text(
                512,
                342,
                isRecord
                    ? '✨ Nouveau record !'
                    : `Meilleur : ${best === null ? '—' : this.formatTime(best)}`,
                {
                    fontFamily,
                    resolution: TEXT_RESOLUTION,
                    fontSize: 22,
                    fontStyle: isRecord ? '600' : '400',
                    color: isRecord ? css.amber : css.stone,
                },
            )
            .setOrigin(0.5);
        cascade.push(recordLabel);

        // Meilleur enchaînement de la partie (réf. Balatro, SPEC §6) : n'apparaît
        // qu'au-delà de 1 pour rester une petite récompense, pas un reproche.
        if (this.state.bestCombo >= 2) {
            const comboLabel = this.add
                .text(512, 378, `Meilleur enchaînement : ×${this.state.bestCombo}`, {
                    fontFamily,
                    resolution: TEXT_RESOLUTION,
                    fontSize: 22,
                    color: css.amber,
                })
                .setOrigin(0.5);
            cascade.push(comboLabel);
        }

        const btn = this.makeButton(512, 452, 'Rejouer');
        btn.on('pointerdown', () => {
            this.closeOverlay();
            this.beginGame();
        });
        cascade.push(btn);

        // Lien discret pour revenir au choix du mode.
        const modeLink = this.add
            .text(512, 512, 'Choisir un mode', {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: 18,
                color: css.stone,
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        modeLink.on('pointerover', () => modeLink.setColor(css.ivory));
        modeLink.on('pointerout', () => modeLink.setColor(css.stone));
        modeLink.on('pointerdown', () => {
            this.closeOverlay();
            this.showInstruction();
        });
        cascade.push(modeLink);

        this.overlay = this.add
            .container(0, 0, [dim, heading, ...cascade])
            .setDepth(10);

        // Entrée en cascade, douce : le titre éclot, puis le temps et le bouton
        // montent en fondu l'un après l'autre.
        if (!this.reducedMotion) {
            heading.setScale(0.7).setAlpha(0);
            this.tweens.add({
                targets: heading,
                scale: 1,
                alpha: 1,
                duration: 520,
                ease: 'Back.out',
            });
            for (const [i, obj] of cascade.entries()) {
                obj.setAlpha(0);
                obj.y += 14;
                this.tweens.add({
                    targets: obj,
                    alpha: 1,
                    y: obj.y - 14,
                    duration: 420,
                    delay: 220 + i * 140,
                    ease: 'Sine.out',
                });
            }
        }
    }

    private closeOverlay(): void {
        this.overlay?.destroy(true);
        this.overlay = null;
    }

    private makeButton(
        cx: number,
        cy: number,
        label: string,
        opts: { width?: number; fontSize?: number } = {},
    ): GameObjects.Container {
        const w = opts.width ?? 220;
        const h = 60;
        const radius = 18;

        // Fond arrondi dessiné en Graphics (Rectangle ne gère pas les coins
        // arrondis) ; redessiné au survol pour la teinte miel soutenu.
        const bg = this.add.graphics();
        const paint = (fill: number): void => {
            bg.clear();
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
            bg.lineStyle(2, palette.bark, 1);
            bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
        };
        paint(palette.honey);

        const txt = this.add
            .text(0, 0, label, {
                fontFamily,
                resolution: TEXT_RESOLUTION,
                fontSize: opts.fontSize ?? 26,
                fontStyle: '600',
                color: css.bark,
            })
            .setOrigin(0.5);

        // Zone de clic transparente par-dessus (hit-test centré et fiable
        // couvrant toute la surface) : le Graphics n'a pas de hit-area simple.
        // On ré-émet le clic sur le Container pour que les appelants
        // (`btn.on('pointerdown')`) continuent de fonctionner.
        const hit = this.add
            .rectangle(0, 0, w, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const button = this.add.container(cx, cy, [bg, txt, hit]);
        button.setSize(w, h);

        hit.on('pointerover', () => paint(palette.honeyDeep));
        hit.on('pointerout', () => paint(palette.honey));
        hit.on('pointerdown', () => button.emit('pointerdown'));
        return button;
    }

    /**
     * Dessine l'icône haut-parleur (monochrome) dans `muteIcon`, centrée sur son
     * origine. `muted` remplace les ondes sonores par une croix.
     */
    private drawSpeaker(color: number, muted: boolean): void {
        const g = this.muteIcon;
        g.clear();

        // Corps du haut-parleur (silhouette pleine), orienté vers la droite.
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(-9, -3);
        g.lineTo(-5, -3);
        g.lineTo(0, -8);
        g.lineTo(0, 8);
        g.lineTo(-5, 3);
        g.lineTo(-9, 3);
        g.closePath();
        g.fillPath();

        g.lineStyle(2, color, 1);
        if (muted) {
            // Croix « coupé » à droite du haut-parleur.
            g.beginPath();
            g.moveTo(4, -5);
            g.lineTo(11, 5);
            g.moveTo(11, -5);
            g.lineTo(4, 5);
            g.strokePath();
        } else {
            // Deux ondes sonores concentriques.
            const a = 0.7;
            g.beginPath();
            g.arc(1, 0, 6, -a, a);
            g.strokePath();
            g.beginPath();
            g.arc(1, 0, 10, -a, a);
            g.strokePath();
        }
    }

    /**
     * Dessine l'icône plein écran dans `fullscreenIcon`, centrée sur son origine.
     * Quatre crochets d'angle : tournés vers l'extérieur hors plein écran
     * (« agrandir »), vers l'intérieur en plein écran (« réduire »).
     */
    private drawFullscreen(color: number): void {
        const g = this.fullscreenIcon;
        g.clear();
        g.lineStyle(2, color, 1);

        const o = 9; // position des angles du cadre
        const a = 4; // longueur des branches du crochet
        // Chaque entrée : [vertexX, vertexY, dirX, dirY] — sommet du crochet et
        // sens de ses deux branches (une horizontale, une verticale).
        const corners = this.scale.isFullscreen
            ? [
                  // Réduire : sommets ramenés vers le centre, branches vers les angles.
                  [-o + a, -o + a, -1, -1],
                  [o - a, -o + a, 1, -1],
                  [-o + a, o - a, -1, 1],
                  [o - a, o - a, 1, 1],
              ]
            : [
                  // Agrandir : sommets aux angles, branches vers le centre.
                  [-o, -o, 1, 1],
                  [o, -o, -1, 1],
                  [-o, o, 1, -1],
                  [o, o, -1, -1],
              ];
        for (const [vx, vy, dx, dy] of corners) {
            g.beginPath();
            g.moveTo(vx + a * dx, vy);
            g.lineTo(vx, vy);
            g.lineTo(vx, vy + a * dy);
            g.strokePath();
        }
    }

    private formatTime(ms: number): string {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
