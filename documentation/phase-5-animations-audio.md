# Phase 5 — Animations et audio

Correspond à SPEC Phase 5 et §6 (référence game feel : Balatro, pour le feel pas le graphisme).

## Objectif

Rendre chaque interaction immédiatement satisfaisante, fluide et non bloquante.

## Ordre de travail (critère clé §6)

1. **Valider une seule interaction de bout en bout** (bonne réponse) et son plaisir de
   répétition **avant** de développer les animations secondaires.
2. Ensuite seulement : erreur, apparition, victoire, sons.

## Bonne réponse (SPEC §6)

- Désactiver immédiatement l'orbe sélectionnée (anti double-clic).
- Contraction brève → léger rebond → éclatement en fragments carrés/organiques.
- Particules dispersées en mouvement fluide puis fondu.
- Son court et doux.
- Compteur mis à jour et note suivante présentée **sans attendre** la fin des effets.

## Mauvaise réponse

- Petite secousse/déformation, éventuel changement de luminosité + son doux.
- L'orbe reste en place. Feedback clair mais jamais agressif.

## Démarrage et victoire

- Apparition progressive du manche et des orbes à l'ouverture.
- Victoire : chrono arrêté, célébration plus ample (particules + son), temps total, proposition de rejouer.

## Contraintes

- Les animations ne bloquent jamais les interactions ni la progression.
- Quelques effets soignés plutôt qu'une accumulation ; légère variété pour agrément des répétitions.
- Respect de **`prefers-reduced-motion`** : variante à animations réduites.
- Audio : **synthèse Web Audio** (validation, erreur, victoire) + ambiance discrète optionnelle.
  Tout désactivable (mute). Pas d'audio avant interaction utilisateur. Gameplay compréhensible sans son.

## Fichiers concernés

- `src/game/entities/NoteOrb.ts` (tweens, éclatement, particules)
- `src/game/scenes/GameScene.ts` (apparition, victoire, orchestration)
- `src/game/audio/audio-manager.ts` (synthèse, mute)

## Critère de fin

Les interactions sont immédiatement satisfaisantes, fluides et non bloquantes.
Vérification réelle via `npm run dev` (dont le mode mouvement réduit).
