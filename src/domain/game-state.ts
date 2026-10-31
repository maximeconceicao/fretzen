/**
 * État de jeu pur (sans Phaser) : machine d'états, compteur, chronomètre et
 * sélection de cible.
 *
 * Garantit (SPEC §9) :
 *  - des transitions explicites instruction → partie → finalisation → victoire ;
 *  - qu'une feuille ne peut jamais être supprimée deux fois ;
 *  - un compteur cohérent à tout instant ;
 *  - un chronomètre qui démarre à la partie et s'arrête à la victoire.
 *
 * Le temps est injecté (`now`) pour rester testable sans horloge réelle.
 */

import type { Leaf } from './board-generator';
import { NOTE_NAMES, midiToPitchClass } from './notes';
import type { RandomFn } from './rng';

export type GamePhase = 'instruction' | 'playing' | 'finalizing' | 'won';

export type ClickResult = 'correct' | 'wrong' | 'ignored';

/**
 * Cible courante : une classe de hauteur (note sans octave). Toutes les feuilles
 * de cette note sont des réponses valides.
 */
export interface TargetInfo {
    /** Classe de hauteur (0 = C … 11 = B). */
    readonly pitchClass: number;
    /** Nom de note sans octave (ex. "E"). */
    readonly label: string;
}

const defaultNow = (): number =>
    typeof performance !== 'undefined' ? performance.now() : Date.now();

export class GameState {
    private _phase: GamePhase = 'instruction';
    private readonly active = new Map<number, Leaf>();
    private readonly _total: number;
    private _targetPitchClass: number | null = null;
    private _combo = 0;
    private _bestCombo = 0;
    private readonly rng: RandomFn;
    private readonly now: () => number;

    private startTime = 0;
    private endTime: number | null = null;

    private _paused = false;
    private pauseStart = 0;
    private totalPausedMs = 0;

    constructor(leaves: readonly Leaf[], rng: RandomFn, now: () => number = defaultNow) {
        this._total = leaves.length;
        for (const leaf of leaves) {
            this.active.set(leaf.id, leaf);
        }
        this.rng = rng;
        this.now = now;
    }

    get phase(): GamePhase {
        return this._phase;
    }

    get total(): number {
        return this._total;
    }

    get remaining(): number {
        return this.active.size;
    }

    /** Feuilles éliminées depuis le début de la partie. */
    get cleared(): number {
        return this._total - this.active.size;
    }

    /**
     * Bonnes réponses consécutives sans erreur (remis à zéro par un mauvais
     * clic). Sert à l'escalade du feedback (réf. Balatro, SPEC §6).
     */
    get combo(): number {
        return this._combo;
    }

    /** Plus long enchaînement atteint dans la partie. */
    get bestCombo(): number {
        return this._bestCombo;
    }

    /** Démarre la partie, lance le chronomètre et choisit la première cible. */
    start(): void {
        if (this._phase !== 'instruction') {
            return;
        }
        this._phase = 'playing';
        this.startTime = this.now();
        this.endTime = null;
        this.pickTarget();
    }

    /** Confirme la victoire après la phase de finalisation (célébration). */
    finalize(): void {
        if (this._phase === 'finalizing') {
            this._phase = 'won';
        }
    }

    /** Vrai si la partie est en pause (temps gelé, clics ignorés). */
    get paused(): boolean {
        return this._paused;
    }

    /** Met la partie en pause : gèle le chronomètre. Sans effet hors `playing`. */
    pause(): void {
        if (this._phase !== 'playing' || this._paused) {
            return;
        }
        this._paused = true;
        this.pauseStart = this.now();
    }

    /** Reprend après une pause : le temps écoulé pendant la pause est ignoré. */
    resume(): void {
        if (!this._paused) {
            return;
        }
        this.totalPausedMs += this.now() - this.pauseStart;
        this._paused = false;
    }

    /**
     * Temps écoulé en millisecondes, hors temps passé en pause. Figé dès la
     * finalisation, et gelé tant que la partie est en pause.
     */
    elapsedMs(): number {
        if (this._phase === 'instruction') {
            return 0;
        }
        const end = this.endTime ?? (this._paused ? this.pauseStart : this.now());
        return end - this.startTime - this.totalPausedMs;
    }

    /** Cible courante (note sans octave), ou null hors partie. */
    get target(): TargetInfo | null {
        if (this._targetPitchClass === null) {
            return null;
        }
        return {
            pitchClass: this._targetPitchClass,
            label: NOTE_NAMES[this._targetPitchClass],
        };
    }

    /**
     * Traite un clic sur une feuille.
     *  - 'correct' : la feuille est de la note cible ; détruite, puis nouvelle note
     *                (éventuellement la même), ou finalisation si c'était la
     *                dernière (chronomètre figé) ;
     *  - 'wrong'   : feuille active mais pas de la bonne note, rien n'est supprimé ;
     *  - 'ignored' : hors partie, ou feuille déjà détruite / inexistante.
     */
    clickLeaf(leafId: number): ClickResult {
        if (this._phase !== 'playing' || this._paused) {
            return 'ignored';
        }
        const leaf = this.active.get(leafId);
        if (!leaf) {
            // Déjà détruite ou inexistante : jamais de double suppression.
            return 'ignored';
        }
        if (midiToPitchClass(leaf.midi) !== this._targetPitchClass) {
            this._combo = 0; // une erreur casse l'enchaînement (sans punition)
            return 'wrong';
        }

        this._combo++;
        if (this._combo > this._bestCombo) {
            this._bestCombo = this._combo;
        }
        this.active.delete(leafId);
        if (this.active.size === 0) {
            this._targetPitchClass = null;
            this.endTime = this.now(); // le chronomètre s'arrête à la victoire
            this._phase = 'finalizing';
        } else {
            this.pickTarget();
        }
        return 'correct';
    }

    /** Choisit une nouvelle note cible parmi les feuilles encore actives. */
    private pickTarget(): void {
        const leaves = [...this.active.values()];
        if (leaves.length === 0) {
            this._targetPitchClass = null;
            return;
        }
        const pick = leaves[Math.floor(this.rng() * leaves.length)];
        this._targetPitchClass = midiToPitchClass(pick.midi);
    }
}
