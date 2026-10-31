# Phase 4 — Direction artistique

Correspond à SPEC Phase 4.

## Objectif

Donner au jeu une identité visuelle minimaliste, naturelle et lisible (SPEC §5),
sans clichés visuels japonais ni décor détaillé.

## Tâches

- **Palette** : vert sauge, vert mousse, ivoire, crème, gris pierre, anthracite doux ;
  accents ambre/corail réservés aux feedbacks. Centraliser dans un module de constantes.
- **Manche stylisé mais précis** : six cordes, frettes clairement identifiables,
  positions à vide, repères aux frettes **3, 5, 7, 9 et 12**.
- **Orbes** : formes naturelles pixélisées, lisibles, légèrement organiques, texture subtile,
  générées à l'exécution (Graphics/RenderTexture). Alignées sur leurs positions logiques.
- **Animation discrète** de respiration/flottement (préparée ici, détaillée en Phase 5).
- Lisibilité et contraste priment sur la décoration.

## Fichiers concernés

- `src/game/theme.ts` (ou `styles/`) — palette et constantes visuelles
- `src/game/scenes/GameScene.ts` — rendu du manche et repères
- `src/game/entities/NoteOrb.ts` — apparence des orbes

## Tests / validation

- Vérification **visuelle réelle** en exécutant `npm run dev` (ne pas prétendre sans exécution, §13).
- Lisibilité du manche et des orbes à différentes tailles de fenêtre desktop.
- `npm run typecheck` vert (les tests unitaires du domaine restent verts).

## Critère de fin

Le jeu est lisible, cohérent et possède une identité visuelle propre.
