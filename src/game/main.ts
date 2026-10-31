import { Game as MainGame } from './scenes/Game';
import { DPR, DESIGN_WIDTH, DESIGN_HEIGHT } from './theme';
import { AUTO, Game, Scale, Types } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
//
// Le tampon de rendu est dimensionné à la densité de l'écran (× DPR) pour un
// rendu net sur écrans Retina. La scène rétablit le repère 1024×768 via un zoom
// caméra (voir Game.create), donc aucune coordonnée du jeu n'a besoin de changer.
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: DESIGN_WIDTH * DPR,
    height: DESIGN_HEIGHT * DPR,
    parent: 'game-container',
    // Teinte lin de la palette : en plein écran, les bandes autour du canvas 4:3
    // sont peintes par cette couleur (et non plus un gris sombre discordant).
    backgroundColor: '#cfccb6',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [
        MainGame
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
