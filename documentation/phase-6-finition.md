# Phase 6 — Finition et livraison

Correspond à SPEC Phase 6 et §13.

## Objectif

Robustesse, performances et livraison d'un jeu fonctionnel (pas une maquette).

## Tâches

- **Cas limites** : plateaux aux contraintes serrées, parties enchaînées, redémarrages répétés.
- **Tailles de fenêtre desktop** : vérifier le rendu et la précision des interactions souris.
- **Performances** : pas de blocage lié aux animations, fluidité maintenue.
- **`prefers-reduced-motion`** : comportement correct en animations réduites.
- **Audio** : activation/désactivation ambiance + effets, respect autoplay.
- **README** : commandes dev/build, choix techniques importants, limites restantes.

## Tests / validation finale

- `npm test` vert (tous les tests du domaine).
- `npm run typecheck` propre (TypeScript strict, pas de `any`).
- `npm run build` réussit.
- Jeu jouable **du début à la fin** (vérification réelle via `npm run dev`).

## Checklist périmètre MVP (SPEC §11)

- [ ] Instruction initiale
- [ ] Plateau 78 positions possibles, 15–20 orbes
- [ ] Cibles musicales non ambiguës (octave affichée)
- [ ] Feedback positif et négatif
- [ ] Compteur de bulles restantes
- [ ] Chronomètre sans limite, arrêt à la victoire
- [ ] Animations de démarrage et de victoire
- [ ] Ambiance et sons d'action désactivables
- [ ] Bouton Rejouer
- [ ] Tests unitaires

## Critère de fin

Tests, vérification TypeScript et build réussis ; jeu jouable du début à la fin.
Limites restantes signalées honnêtement.
