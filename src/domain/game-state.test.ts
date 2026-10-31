import { describe, it, expect } from 'vitest';
import { GameState } from './game-state';
import { generateBoard, type Leaf } from './board-generator';
import { mulberry32 } from './rng';
import { midiToPitchClass } from './notes';

/** Vide le plateau en cliquant, à chaque cible, une feuille active de cette note. */
function clearBoard(state: GameState, board: readonly Leaf[]): void {
    const removed = new Set<number>();
    let guard = 0;
    while (state.phase === 'playing') {
        const pc = state.target!.pitchClass;
        const leaf = board.find(
            (o) => !removed.has(o.id) && midiToPitchClass(o.midi) === pc,
        );
        if (!leaf) throw new Error('aucune feuille active pour la cible');
        if (state.clickLeaf(leaf.id) === 'correct') removed.add(leaf.id);
        if (++guard > 1000) throw new Error('boucle anormale');
    }
}

// Plateau contrôlé : deux E (octaves différentes) et un F.
function controlledBoard(): Leaf[] {
    return [
        { id: 0, position: { string: 1, fret: 0 }, midi: 64 }, // E4
        { id: 1, position: { string: 2, fret: 0 }, midi: 76 }, // E5 (classe E)
        { id: 2, position: { string: 3, fret: 0 }, midi: 65 }, // F4
    ];
}
const firstLeafRng = () => 0; // pickTarget choisit toujours la 1re feuille active

describe('game-state', () => {
    it('démarre en phase instruction, compteur plein, sans cible', () => {
        const board = generateBoard(1);
        const state = new GameState(board, mulberry32(1));
        expect(state.phase).toBe('instruction');
        expect(state.remaining).toBe(board.length);
        expect(state.cleared).toBe(0);
        expect(state.target).toBeNull();
    });

    it('la cible est une note sans octave, présente sur le plateau', () => {
        const board = generateBoard(7);
        const state = new GameState(board, mulberry32(7));
        state.start();
        const target = state.target!;
        expect(target.label).toMatch(/^[A-G]#?$/); // pas d'octave
        expect(board.some((o) => midiToPitchClass(o.midi) === target.pitchClass)).toBe(
            true,
        );
    });

    it('ignore les clics avant le démarrage', () => {
        const board = controlledBoard();
        const state = new GameState(board, firstLeafRng);
        expect(state.clickLeaf(0)).toBe('ignored');
        expect(state.remaining).toBe(3);
    });

    it('accepte n’importe quelle feuille de la note cible', () => {
        const state = new GameState(controlledBoard(), firstLeafRng);
        state.start();
        expect(state.target!.label).toBe('E'); // 1re feuille = E
        // L'autre E (id 1) est aussi une réponse valide.
        expect(state.clickLeaf(1)).toBe('correct');
        expect(state.remaining).toBe(2);
    });

    it('refuse une feuille d’une autre note', () => {
        const state = new GameState(controlledBoard(), firstLeafRng);
        state.start(); // cible E
        expect(state.clickLeaf(2)).toBe('wrong'); // F
        expect(state.remaining).toBe(3);
        expect(state.target!.label).toBe('E');
    });

    it('peut réafficher la même note tant qu’il en reste', () => {
        const state = new GameState(controlledBoard(), firstLeafRng);
        state.start(); // cible E (feuille 0)
        expect(state.clickLeaf(0)).toBe('correct');
        // Il reste une E (feuille 1) et un F ; firstLeafRng pointe la 1re active (E).
        expect(state.target!.label).toBe('E');
    });

    it('ne supprime jamais une feuille deux fois', () => {
        const state = new GameState(controlledBoard(), firstLeafRng);
        state.start();
        expect(state.clickLeaf(0)).toBe('correct');
        const after = state.remaining;
        expect(state.clickLeaf(0)).toBe('ignored');
        expect(state.remaining).toBe(after);
    });

    it('la dernière feuille mène à la finalisation puis à la victoire', () => {
        const board = generateBoard(555);
        const state = new GameState(board, mulberry32(555 ^ 0x9e3779b9));
        state.start();
        clearBoard(state, board);
        expect(state.phase).toBe('finalizing');
        expect(state.remaining).toBe(0);
        expect(state.cleared).toBe(state.total);
        expect(state.target).toBeNull();

        state.finalize();
        expect(state.phase).toBe('won');
    });

    it('ignore les clics pendant la finalisation et après la victoire', () => {
        const board = generateBoard(555);
        const state = new GameState(board, mulberry32(555 ^ 0x9e3779b9));
        state.start();
        clearBoard(state, board);
        expect(state.clickLeaf(board[0].id)).toBe('ignored');
        state.finalize();
        expect(state.clickLeaf(board[0].id)).toBe('ignored');
    });

    describe('combo', () => {
        it('démarre à zéro et monte à chaque bonne réponse', () => {
            const state = new GameState(controlledBoard(), firstLeafRng);
            expect(state.combo).toBe(0);
            state.start(); // cible E
            expect(state.clickLeaf(0)).toBe('correct');
            expect(state.combo).toBe(1);
            expect(state.clickLeaf(1)).toBe('correct'); // autre E (cible redevient E)
            expect(state.combo).toBe(2);
        });

        it('retombe à zéro sur un mauvais clic, sans toucher au meilleur', () => {
            // Deux E, un F, un G : après avoir vidé les E, la cible devient F,
            // ce qui permet un mauvais clic (sur le G) encore présent.
            const board: Leaf[] = [
                { id: 0, position: { string: 1, fret: 0 }, midi: 64 }, // E4
                { id: 1, position: { string: 2, fret: 0 }, midi: 76 }, // E5
                { id: 2, position: { string: 3, fret: 0 }, midi: 65 }, // F4
                { id: 3, position: { string: 3, fret: 3 }, midi: 67 }, // G4
            ];
            const state = new GameState(board, firstLeafRng);
            state.start(); // cible E (feuille 0)
            expect(state.clickLeaf(0)).toBe('correct'); // combo 1
            expect(state.clickLeaf(1)).toBe('correct'); // combo 2, cible devient F
            expect(state.bestCombo).toBe(2);
            expect(state.clickLeaf(3)).toBe('wrong'); // G alors que la cible est F
            expect(state.combo).toBe(0);
            expect(state.bestCombo).toBe(2);
        });

        it('mémorise le plus long enchaînement de la partie', () => {
            const board = generateBoard(555);
            const state = new GameState(board, mulberry32(555 ^ 0x9e3779b9));
            state.start();
            clearBoard(state, board);
            expect(state.bestCombo).toBe(board.length); // vidé sans erreur
        });
    });

    describe('pause', () => {
        it('gèle le chronomètre pendant la pause et le reprend ensuite', () => {
            let t = 1000;
            const state = new GameState(generateBoard(1), mulberry32(1), () => t);
            state.start(); // startTime = 1000
            t = 3000;
            expect(state.elapsedMs()).toBe(2000);
            state.pause(); // gèle à 2000
            t = 9000; // 6 s en pause
            expect(state.paused).toBe(true);
            expect(state.elapsedMs()).toBe(2000); // toujours figé
            state.resume();
            t = 10000; // +1 s après reprise
            expect(state.paused).toBe(false);
            expect(state.elapsedMs()).toBe(3000); // 2000 + 1000, pause exclue
        });

        it('ignore les clics pendant la pause, sans rien supprimer', () => {
            const state = new GameState(controlledBoard(), firstLeafRng);
            state.start(); // cible E
            state.pause();
            expect(state.clickLeaf(0)).toBe('ignored'); // E pourtant valide
            expect(state.remaining).toBe(3);
            state.resume();
            expect(state.clickLeaf(0)).toBe('correct');
            expect(state.remaining).toBe(2);
        });

        it('pause() et resume() sont sans effet hors partie', () => {
            const state = new GameState(controlledBoard(), firstLeafRng);
            state.pause(); // avant le démarrage
            expect(state.paused).toBe(false);
            state.resume();
            expect(state.paused).toBe(false);
        });
    });

    describe('chronomètre', () => {
        it('reste à zéro avant le démarrage', () => {
            let t = 0;
            const state = new GameState(generateBoard(1), mulberry32(1), () => t);
            t = 5000;
            expect(state.elapsedMs()).toBe(0);
        });

        it('mesure le temps écoulé pendant la partie', () => {
            let t = 1000;
            const state = new GameState(generateBoard(1), mulberry32(1), () => t);
            state.start();
            t = 4500;
            expect(state.elapsedMs()).toBe(3500);
        });

        it("s'arrête à la victoire et ne bouge plus ensuite", () => {
            let t = 0;
            const board = generateBoard(555);
            const state = new GameState(
                board,
                mulberry32(555 ^ 0x9e3779b9),
                () => t,
            );
            state.start();
            t = 8000;
            clearBoard(state, board);
            const frozen = state.elapsedMs();
            expect(frozen).toBe(8000);
            t = 20000;
            expect(state.elapsedMs()).toBe(frozen);
            state.finalize();
            expect(state.elapsedMs()).toBe(frozen);
        });
    });
});
