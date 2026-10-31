# FretZen

Jeu web d'apprentissage du manche de guitare. Une note cible apparaît ; trouve
une position correspondante sur le manche (six cordes, frettes 0 à 12) et éclate
sa feuille. La partie est gagnée quand le manche est vidé. Esthétique minimaliste
et naturelle, feedback arcade satisfaisant.

Construit avec **Phaser 4**, **TypeScript** et **Vite**.

## Commandes

| Commande | Description |
|----------|-------------|
| `npm install` | Installe les dépendances |
| `npm run dev` | Serveur de développement sur `http://localhost:8080` |
| `npm run build` | Build de production dans `dist/` |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:watch` | Tests en mode watch |
| `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |

Variantes `dev-nolog` / `build-nolog` : identiques sans le ping anonyme du
template Phaser (voir `log.js`).

## Comment jouer

1. Choisis un **mode** : 10, 15 ou 20 feuilles (chacun a son propre record).
2. La note cible (une classe de note sans octave, ex. `E`) s'affiche en grand.
   Toutes les feuilles de cette note, quelle que soit l'octave, sont des
   réponses valides.
3. Clique sur une feuille à la bonne note du manche : elle éclate, la note
   résonne à sa vraie hauteur, et la cible suivante apparaît.
4. Un mauvais clic produit une secousse légère, sans rien supprimer.
5. Vide le manche pour gagner ; le chronomètre s'arrête, le record du mode est
   mis à jour et tu peux rejouer.

Le bouton haut-parleur (en haut à droite) coupe/réactive le son. La partie peut
être mise en pause avec le bouton ⏸ ou les touches `Échap` / `P`.

## Choix techniques

- **Séparation domaine / rendu.** Toute la logique musicale et de jeu vit dans
  [`src/domain/`](src/domain/) sans aucune dépendance à Phaser, donc testable
  isolément :
  - [`notes.ts`](src/domain/notes.ts), [`tuning.ts`](src/domain/tuning.ts),
    [`fretboard.ts`](src/domain/fretboard.ts) : hauteurs calculées via les
    numéros MIDI (`MIDI = corde à vide + frette`), jamais codées à la main.
  - [`rng.ts`](src/domain/rng.ts) : RNG déterministe (mulberry32).
  - [`board-generator.ts`](src/domain/board-generator.ts) : nombre de feuilles
    réglable par mode (10 / 15 / 20), à des **positions toutes distinctes**
    tirées par seed. Plusieurs feuilles peuvent partager la même note : la cible
    étant une note *sans octave*, les doublons sont volontairement permis.
  - [`game-state.ts`](src/domain/game-state.ts) : machine d'états
    (instruction → partie → finalisation → victoire), compteur, chronomètre,
    combo, pause, anti-double-suppression.
- **Rendu Phaser** dans [`src/game/`](src/game/) : scène, entité feuille, audio,
  thème. L'interface est rendue dans le canvas pour une mise à l'échelle
  cohérente avec `Scale.FIT`.
- **Audio** par synthèse Web Audio (aucun fichier, aucune licence) ; contexte
  créé seulement après interaction utilisateur (autoplay).
- **Feuilles** : textures pixélisées organiques générées à l'exécution.
- **Records** : meilleur temps par mode persisté dans `localStorage`
  ([`best-scores.ts`](src/game/best-scores.ts)), avec dégradation gracieuse si le
  stockage est indisponible.
- **Écart assumé vs SPEC §4.** La spécification demandait des *hauteurs uniques*
  parmi les cibles et l'affichage de l'octave. Le jeu retient plutôt la **classe
  de note** (sans octave) comme cible, toute position de cette note étant
  acceptée : un modèle jugé plus pédagogique pour mémoriser le manche.
- **Phaser 4** conservé (présent dans le template) plutôt que Phaser 3 mentionné
  à l'origine dans la spécification : l'API couvre tous les besoins.
- **TypeScript strict**, sans `any`.

Voir [`documentation/`](documentation/) pour le plan détaillé par phases.

## Structure

```text
src/
  domain/      # logique pure, testée (notes, manche, génération, état)
  game/        # Phaser : scène, orbe, audio, thème
  main.ts      # bootstrap
```

## Tests

Couverture unitaire ([`src/domain/*.test.ts`](src/domain/)) : calcul des
hauteurs des 78 positions, conversion MIDI → note, cordes à vide et 12e frette,
positions de même hauteur, génération déterministe, doublons de note autorisés,
transitions d'état, combo, pause, impossibilité de supprimer une feuille deux
fois, cohérence du compteur, arrêt du chronomètre à la victoire.

## Limites connues

- Desktop uniquement (pas d'optimisation tactile / mobile).
- Le chronomètre est en temps réel : changer d'onglet en pleine partie compte
  dans le temps final (pas d'auto-pause au blur).
- Pas de niveaux de difficulté au-delà des trois modes (hors périmètre MVP).
- Le rendu sonore réel n'a pas été validé en environnement automatisé (headless) ;
  à écouter dans un navigateur.
- Un hook de débogage (`window.fretzenGame`) est exposé **en développement
  uniquement** et retiré du build de production.

## Crédits

Basé au départ sur le template officiel
[`template-vite-ts`](https://github.com/phaserjs/template-vite-ts) de Phaser
Studio.
