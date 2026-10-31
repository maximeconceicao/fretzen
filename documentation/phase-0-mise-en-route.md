# Phase 0 — Mise en route

Préalable d'outillage avant toute logique de jeu.

## Objectif

Rendre le dépôt opérationnel : dépendances installées, framework de test en place,
chaîne dev/build/typecheck vérifiée.

## Tâches

- `npm install` (installe Phaser 4, Vite, TypeScript).
- Ajouter **Vitest** en `devDependency`.
- Ajouter un script `"test": "vitest run"` (et éventuellement `"test:watch": "vitest"`) dans `package.json`.
- Ajouter un script `"typecheck": "tsc --noEmit"`.
- Config Vitest minimale (environnement `node` pour le domaine pur ; `jsdom` seulement si nécessaire plus tard).

## Fichiers concernés

- `package.json` (scripts + devDependency)
- `vitest.config.ts` ou bloc `test` dans la config Vite existante
- Éventuel `src/domain/__smoke__.test.ts` (test trivial, supprimé ensuite)

## Tests / validation

- `npm run dev` démarre le serveur sur `http://localhost:8080`.
- `npm run build` produit un `dist/` sans erreur.
- `npm run typecheck` passe.
- `npm test` exécute la suite (même triviale) avec succès.

## Critère de fin

Serveur dev démarre, build passe, `npm test` et `npm run typecheck` sont verts.
