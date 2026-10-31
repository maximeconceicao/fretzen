# Phase 1 — Fondations musicales

Correspond à SPEC Phase 1. Modèle musical pur et testable, sans Phaser.

## Objectif

Calculer et nommer correctement les hauteurs des 78 positions du manche à partir
de la corde et de la frette, via les numéros MIDI (SPEC §4). Aucune note codée à la main.

## Modèle

- Accordage standard, cordes 6→1 : E2, A2, D3, G3, B3, E4.
- MIDI des cordes à vide : E2=40, A2=45, D3=50, G3=55, B3=59, E4=64.
- `MIDI(corde, frette) = midi_corde_à_vide + frette`, frette ∈ [0, 12].
- Nom de note : `['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi % 12]`.
- Octave : `Math.floor(midi / 12) - 1` (convention MIDI, C4 = 60).
- 6 cordes × 13 positions (0–12) = **78 positions**.

## Fichiers concernés

- `src/domain/notes.ts` — conversions MIDI ↔ nom + octave.
- `src/domain/tuning.ts` — constantes d'accordage (MIDI des cordes à vide).
- `src/domain/fretboard.ts` — `positionToMidi`, énumération des 78 positions.
- `src/domain/notes.test.ts`, `src/domain/fretboard.test.ts` — tests.

## Tests

- Hauteurs correctes pour les 6 cordes × frettes 0 à 12.
- Conversion MIDI → nom de note.
- Cas des cordes à vide (frette 0) et de la 12e frette (octave au-dessus de la corde à vide).
- Positions distinctes partageant une même hauteur absolue (ex. E4 corde 1 à vide = corde 2 frette 5).
- Les 78 positions sont bien énumérées, sans doublon de position.

## Critère de fin

Les 78 positions produisent les bonnes hauteurs et les bons noms de notes (avec octave).
`npm test` et `npm run typecheck` verts.
