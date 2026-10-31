import StartGame from './game/main';

/**
 * Attend que la police Fredoka soit chargée avant de démarrer Phaser : le
 * texte est rendu en canvas (mis en cache), donc une police absente au boot
 * s'afficherait en police système jusqu'au prochain rafraîchissement.
 */
async function waitForFonts(): Promise<void> {
    if (!('fonts' in document)) {
        return;
    }
    try {
        await Promise.all([
            document.fonts.load('400 16px Fredoka'),
            document.fonts.load('600 16px Fredoka'),
            document.fonts.load('700 16px Fredoka'),
        ]);
    } catch {
        // Police indisponible (hors ligne) : on démarre quand même, la police
        // système de secours prend le relais.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    void waitForFonts().then(() => {
        const game = StartGame('game-container');

        // Exposition du jeu en développement uniquement (supprimée du build de
        // production) : pratique pour le débogage et les tests pilotés.
        if (import.meta.env.DEV) {
            (window as unknown as Record<string, unknown>).fretzenGame = game;
        }
    });
});
