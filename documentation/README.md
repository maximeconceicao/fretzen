# FretZen — Plan d'implémentation

Jeu web d'apprentissage du manche de guitare (Phaser, TypeScript, Vite).
Ce dossier décrit le plan d'implémentation découpé en phases, dérivé de [SPEC.md](../SPEC.md).

## Décisions techniques retenues

| Sujet | Décision | Raison |
|-------|----------|--------|
| Moteur | **Phaser 4.0.0** (déjà installé) | API proche de nos besoins, pas de rétrogradation inutile malgré « Phaser 3 » au SPEC §9 |
| Tests | **Vitest** | Intégration native Vite, TypeScript direct, config minimale |
| UI (note cible, compteurs) | **Dans le canvas Phaser** | Mise à l'échelle cohérente avec `Scale.FIT` ; DOM réservé aux boutons Démarrer/Rejouer et au toggle son |
| Audio | **Synthèse Web Audio** | Aucun asset ni licence à gérer, sons d'action générés, ambiance simple optionnelle |

## Principe directeur

**Prototype jouable d'abord, finitions graphiques ensuite.** Le domaine musical pur est
isolé du rendu Phaser pour être testable sans moteur (SPEC §9). Pas de sur-ingénierie,
pas de système d'agents.

## Architecture cible

```text
src/
  domain/              # pur TS, 100% testable, zéro import Phaser
    notes.ts           # MIDI <-> nom de note + octave (C..B)
    tuning.ts          # accordage standard (MIDI des cordes à vide)
    fretboard.ts       # position(corde,frette) -> MIDI ; les 78 positions
    rng.ts             # RNG seedé déterministe (mulberry32)
    board-generator.ts # génère 15-20 orbes, unicité des hauteurs, anti-boucle
    game-state.ts      # machine d'états + compteur + chrono (logique pure)
  game/
    main.ts            # config Phaser
    scenes/
      BootScene.ts     # préchargement + transition
      GameScene.ts     # rendu manche, orbes, note cible, HUD
    entities/
      NoteOrb.ts       # objet visuel orbe (lié à une position)
    audio/
      audio-manager.ts # synthèse Web Audio, mute
  main.ts
  *.test.ts            # colocalisés avec le domaine
```

Les hauteurs se calculent via MIDI (`MIDI = corde_à_vide + frette`), jamais codées à la main (SPEC §4).

## Phases

| Phase | Fichier | Objet |
|-------|---------|-------|
| 0 | [phase-0-mise-en-route.md](phase-0-mise-en-route.md) | Outillage : install, Vitest, vérif build/dev/tsc |
| 1 | [phase-1-fondations-musicales.md](phase-1-fondations-musicales.md) | Modèle musical + tests |
| 2 | [phase-2-prototype-jouable.md](phase-2-prototype-jouable.md) | Génération, note cible, clics bon/mauvais |
| 3 | [phase-3-boucle-interface.md](phase-3-boucle-interface.md) | Instruction, compteur, chrono, redémarrage |
| 4 | [phase-4-direction-artistique.md](phase-4-direction-artistique.md) | Palette, manche stylisé, orbes |
| 5 | [phase-5-animations-audio.md](phase-5-animations-audio.md) | Éclatement, feedback, victoire, sons |
| 6 | [phase-6-finition.md](phase-6-finition.md) | Cas limites, perfs, mouvement réduit, livraison |

## Règles de travail

- Implémenter **une phase à la fois**, valider, puis s'arrêter pour revue.
- `npm test` (dès Phase 1) + `tsc --noEmit` à chaque phase ; lancement manuel `npm run dev` dès Phase 2.
- **Aucun commit Git sans demande explicite.**
- Ne pas prétendre avoir fait une vérification visuelle sans avoir exécuté le jeu (SPEC §13).

## Ambiguïtés levées (interprétations retenues)

- **« Accessibilité des cibles » (§4)** : orbes non superposées et toutes cliquables (hit-area suffisante).
- **État « finalisation » (§9)** : court sas « dernière orbe détruite → célébration » qui fige les interactions pendant la transition.
- **Orbes « pixélisées / organiques » (§5)** : textures générées à l'exécution (Graphics/RenderTexture), pas de PNG dessinés à la main.
- **Desktop uniquement** (§11) : `Scale.FIT` conservé, tests sur plusieurs tailles de fenêtre desktop.
