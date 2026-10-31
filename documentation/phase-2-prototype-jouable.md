# Phase 2 — Prototype jouable

Correspond à SPEC Phase 2. **Priorité absolue** : une partie terminable, même sans esthétique.

## Objectif

Dessiner un manche brut, générer les orbes, afficher une note cible, gérer les clics
corrects et incorrects, décompter jusqu'à la victoire.

## Logique (domaine pur)

- **RNG seedé** déterministe (mulberry32) pour une génération reproductible (SPEC §4).
- **Générateur de plateau** : 15 à 20 orbes réparties sur différentes cordes/frettes.
  - Unicité : chaque hauteur absolue apparaît au plus une fois parmi les orbes actives
    (une même hauteur existant à plusieurs positions, on évite les doublons de cibles).
  - Validité : nombre d'orbes dans [15, 20], pas de superposition de positions.
  - **Anti-boucle infinie** : nombre d'essais borné ; échec explicite si contraintes insatisfaisables.
- **Sélection de cible** : une note cible = une seule orbe active correspondante.
- **Résolution de clic** : bon clic → orbe retirée + cible suivante ; mauvais clic → rien.
- **Anti-double-suppression** : une orbe déjà retirée ne peut pas être supprimée à nouveau.
- Compteur de bulles restantes cohérent à tout instant.

## Rendu (Phaser, volontairement brut)

- Manche : lignes pour cordes et frettes, positions repérables (pas encore stylisé).
- Orbes : cercles/formes simples alignés sur leur position logique, cliquables.
- Note cible : texte lisible dans le canvas (avec octave).
- Pas d'animation soignée ni de palette à ce stade.

## Fichiers concernés

- `src/domain/rng.ts`
- `src/domain/board-generator.ts` + `board-generator.test.ts`
- `src/domain/game-state.ts` + `game-state.test.ts`
- `src/game/scenes/GameScene.ts`
- `src/game/entities/NoteOrb.ts`

## Tests

- Génération déterministe avec une seed (même seed → même plateau).
- Unicité des hauteurs parmi les cibles actives.
- Nombre d'orbes valide (15–20).
- Pas de boucle infinie quand les contraintes sont serrées.
- Transitions d'état cohérentes.
- Une orbe ne peut pas être supprimée deux fois.
- Compteur cohérent après chaque résolution.

## Critère de fin

Une partie peut être terminée sans ambiguïté musicale ni incohérence de compteur
(rendu moche accepté). `npm test` et `npm run typecheck` verts ; `npm run dev` jouable.
