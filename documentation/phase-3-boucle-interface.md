# Phase 3 — Boucle et interface

Correspond à SPEC Phase 3.

## Objectif

Rendre le jeu compréhensible sans explication extérieure : instruction initiale,
HUD complet, chronomètre, transitions d'états et redémarrage.

## Tâches

- **Écran d'instruction** (SPEC §7) : « Trouve la note sur le manche et éclate son orbe.
  Continue jusqu'à vider le manche. » + bouton **Démarrer** explicite.
- **Pas d'audio avant interaction utilisateur** (contrainte autoplay §8).
- **HUD** : note cible très visible et prioritaire, bulles restantes, temps écoulé, indication de progression discrète.
- **Chronomètre** : démarre au lancement de la partie, s'arrête à la victoire.
- **États explicites** (SPEC §9) : instruction → partie en cours → finalisation → victoire.
- **Écran de victoire** : temps total affiché + bouton **Rejouer** (reset complet : état, compteur, chrono, nouveau plateau).

## Fichiers concernés

- `src/domain/game-state.ts` (chrono + transitions ; extension des tests)
- `src/game/scenes/GameScene.ts` (HUD, écrans, boutons)
- `src/game/scenes/BootScene.ts` (si séparation du préchargement)
- DOM/CSS minimal pour boutons si besoin

## Tests

- Le chronomètre s'arrête exactement à la victoire.
- Redémarrage propre : état, compteur et chrono réinitialisés, nouveau plateau valide.
- Impossible de jouer avant d'avoir cliqué sur Démarrer.
- Transitions d'états dans l'ordre attendu.

## Critère de fin

Le jeu est compréhensible sans explication extérieure. Tests et typecheck verts.
