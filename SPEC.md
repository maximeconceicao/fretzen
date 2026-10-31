# FretZen — Cahier des charges

## 1. Objectif

Créer un jeu web d’apprentissage du manche de guitare, développé avec Phaser, TypeScript et Vite. Le jeu doit associer une expérience pédagogique claire, une esthétique minimaliste inspirée de la nature et des animations arcade satisfaisantes.

Priorités : exactitude musicale, gameplay fluide, qualité des interactions, identité visuelle cohérente et code simple à maintenir. Éviter toute sur-ingénierie.

## 2. Méthode de travail avec Claude Code

Avant de modifier le dépôt :
1. Inspecter sa structure, ses dépendances et ses scripts.
2. Analyser cette spécification et relever les ambiguïtés importantes.
3. Proposer un plan découpé en phases courtes, avec fichiers concernés, tests et critères de fin.
4. Attendre mon approbation avant toute modification.

Ensuite, implémenter une phase à la fois, exécuter les validations et signaler honnêtement ce qui a été testé. Ne jamais créer de commit Git sans demande explicite.

## 3. Concept et boucle de jeu

Le joueur découvre un manche de guitare à six cordes, de la corde à vide jusqu’à la 12e frette. Des orbes interactives sont réparties aléatoirement sur le manche. Chaque orbe correspond à une position précise, c’est-à-dire une corde et une frette.

Une note cible apparaît en grand. Le joueur clique sur l’orbe correspondant. Une bonne réponse détruit l’orbe avec une animation satisfaisante, diminue le nombre de bulles restantes et déclenche la note suivante. Une mauvaise réponse déclenche un feedback léger et ne supprime rien.

La partie est gagnée lorsque toutes les orbes ont été éliminées. Il n’existe ni compte à rebours ni limite de temps. Le chronomètre affiche le temps écoulé et s’arrête à la victoire. Le joueur peut recommencer immédiatement.

## 4. Règles musicales

Accordage standard, de la corde 6 à la corde 1 : E2, A2, D3, G3, B3, E4.

Le manche comprend les positions à vide et les frettes 1 à 12, soit 78 positions possibles. Les notes sont affichées en notation internationale : C, C#, D, D#, E, F, F#, G, G#, A, A#, B.

Calculer les hauteurs à partir de la corde et de la frette, avec une représentation musicale explicite et testable, par exemple les numéros MIDI. Ne pas coder manuellement les notes de chaque position.

**Unicité des cibles :** chaque note cible doit correspondre à une seule orbe encore active. Une même hauteur absolue pouvant apparaître à plusieurs positions, le générateur doit empêcher les doublons de hauteur parmi les cibles actives. Afficher l’octave dans la note cible afin de lever toute ambiguïté.

Générer environ 15 à 20 orbes par partie, distribuées aléatoirement sur différentes cordes et frettes. Vérifier la validité du plateau, l’accessibilité des cibles et l’absence de doublons. La génération doit être testable avec une seed et ne jamais boucler indéfiniment si les contraintes ne peuvent être satisfaites.

## 5. Direction artistique

Créer une esthétique minimaliste et abstraite, à mi-chemin entre contemplation zen et jeu arcade. L’inspiration naturelle doit être présente sans recourir aux clichés visuels japonais ou à un décor détaillé.

Palette suggérée : vert sauge, vert mousse, ivoire, crème, gris pierre et anthracite doux, avec quelques accents ambre ou corail pour les feedbacks.

Les orbes sont des formes naturelles pixélisées, lisibles, légèrement organiques, avec une texture subtile et une animation discrète de respiration ou de flottement.

Le manche doit rester stylisé mais précis : six cordes, frettes clairement identifiables, positions à vide, et repères aux frettes 3, 5, 7, 9 et 12. Les orbes doivent être alignées sur leurs positions logiques. La lisibilité et le contraste priment sur la décoration.

## 6. Référence d’animation : Balatro

Balatro est une référence pour le game feel, le rythme et les animations satisfaisantes, pas pour son identité graphique. Ne pas reproduire ses cartes, son interface, ses illustrations ou ses effets distinctifs à l’identique.

Principes recherchés :
- Réaction visuelle immédiate à chaque interaction.
- Sensation d’impact obtenue par une combinaison subtile de mouvement, déformation, échelle et particules.
- Animations courtes, expressives et synchronisées avec le son.
- Continuité entre les actions, sans attente frustrante.
- Légère variété des effets pour rendre les répétitions agréables.
- Intensité contenue pendant le jeu et célébration plus riche à la victoire.

### Bonne réponse

Désactiver immédiatement l’orbe sélectionnée pour éviter les doubles clics. La contracter brièvement, lui donner un léger rebond, puis la faire éclater en fragments carrés et organiques. Les particules se dispersent avec un mouvement fluide puis disparaissent progressivement. Jouer un son court et doux. Mettre à jour le compteur et présenter la prochaine note sans attendre la fin de tous les effets.

### Mauvaise réponse

Déclencher une petite secousse ou déformation, éventuellement accompagnée d’un changement de luminosité et d’un son doux. L’orbe reste en place. Le feedback doit être clair, mais jamais agressif ou punitif.

### Démarrage et victoire

À l’ouverture de la partie, faire apparaître le manche et les orbes progressivement. À la victoire, arrêter le chronomètre, lancer une célébration plus ample avec particules et son, afficher le temps total et proposer de rejouer.

Les animations ne doivent jamais bloquer les interactions ni retarder la progression du jeu. Privilégier quelques effets soignés plutôt qu’une accumulation d’effets. Respecter `prefers-reduced-motion` et prévoir une réduction des animations.

**Critère clé :** tester une seule interaction de bout en bout et valider son plaisir de répétition avant de développer toutes les animations secondaires.

## 7. Interface

L’écran de jeu doit afficher :
- La note cible, très visible et prioritaire.
- Le manche et les orbes.
- Le nombre de bulles restantes.
- Le temps écoulé.
- Une indication discrète de progression.

Avant le démarrage, afficher une instruction courte : « Trouve la note sur le manche et éclate son orbe. Continue jusqu’à vider le manche. » Ajouter un bouton de démarrage explicite. Ne pas lancer d’audio avant une interaction utilisateur.

Éviter les menus complexes et les éléments qui détournent l’attention du manche.

## 8. Audio

Prévoir une ambiance discrète et des sons d’action : validation, erreur et victoire. Les sons doivent renforcer les interactions sans devenir fatigants. L’ambiance et les effets sonores doivent pouvoir être désactivés. Respecter les restrictions d’autoplay des navigateurs.

Utiliser des sons originaux, des ressources libres autorisées ou une synthèse simple. Ne pas intégrer d’audio protégé sans autorisation. Le gameplay doit rester compréhensible sans son.

## 9. Stack et architecture

Stack cible : Phaser 3, TypeScript et Vite. Utiliser les conventions et dépendances déjà présentes dans le dépôt lorsqu’elles conviennent.

Séparer les règles musicales et le gameplay du rendu Phaser. Le calcul des notes, la validation des positions, la génération du plateau et les transitions d’état doivent être testables indépendamment du moteur de rendu.

Prévoir des états explicites : instruction, partie en cours, finalisation et victoire. Garantir que les clics répétés ne suppriment jamais une orbe deux fois et que le compteur reste cohérent.

Une organisation indicative :

```text
src/
  main.ts
  game/
    config.ts
    scenes/
      BootScene.ts
      GameScene.ts
    entities/
      NoteOrb.ts
    systems/
      board-generator.ts
      game-state.ts
    audio/
      audio-manager.ts
  domain/
    notes.ts
    tuning.ts
    fretboard.ts
    game-rules.ts
  styles/
    main.css
```

Adapter cette structure au dépôt. Ne pas multiplier les fichiers, classes ou abstractions sans besoin réel. Phaser gère le rendu et les interactions de jeu. Utiliser des éléments DOM/CSS simples si nécessaire pour les éléments d’interface, sans ajouter React uniquement pour ce MVP. Utiliser TypeScript strict et éviter `any`.

## 10. Tests et robustesse

Tester au minimum :
- Calcul des hauteurs pour les six cordes et les frettes 0 à 12.
- Conversion des numéros MIDI en noms de notes.
- Cas des cordes à vide et de la 12e frette.
- Positions qui partagent une même hauteur.
- Génération du plateau, unicité des cibles et validité du nombre d’orbes.
- Génération déterministe avec une seed.
- Transitions d’état et impossibilité de supprimer une orbe deux fois.
- Cohérence du compteur et arrêt du chronomètre à la victoire.
- Possibilité de démarrer et recommencer une partie.

Vérifier aussi le rendu à différentes tailles de fenêtre desktop, la précision des interactions souris, l’absence de blocage lié aux animations et le comportement avec les animations réduites. Utiliser les outils déjà présents ; ajouter le minimum nécessaire si aucun système de test n’existe.

## 11. Périmètre MVP

Inclus : instruction initiale, plateau de 78 positions possibles, 15 à 20 orbes, cibles musicales non ambiguës, feedback positif et négatif, compteur, chronomètre sans limite, animations de démarrage et de victoire, ambiance et sons d’action désactivables, bouton pour rejouer, tests unitaires.

Exclus : comptes, backend, classement en ligne, synchronisation cloud, progression complexe, monétisation, multijoueur, éditeur de niveaux, application mobile native, statistiques avancées et niveaux de difficulté multiples.

## 12. Phases d’implémentation et critères de validation

### Phase 1 — Fondations musicales
Configurer ou vérifier Phaser, TypeScript et Vite. Implémenter le modèle musical et ses tests.

Validation : les 78 positions produisent les bonnes hauteurs et les bons noms de notes.

### Phase 2 — Prototype jouable
Dessiner le manche, générer les orbes, afficher une note cible et gérer les clics corrects et incorrects.

Validation : une partie peut être terminée sans ambiguïté musicale ni incohérence de compteur.

### Phase 3 — Boucle et interface
Ajouter l’instruction initiale, le compteur, le chronomètre, les transitions et le redémarrage.

Validation : le jeu est compréhensible sans explication extérieure.

### Phase 4 — Direction artistique
Créer la palette, les orbes, le manche stylisé et les détails visuels.

Validation : le jeu est lisible, cohérent et possède une identité visuelle propre.

### Phase 5 — Animations et audio
Soigner l’éclatement, le feedback d’erreur, les transitions et la victoire ; ajouter les sons.

Validation : les interactions sont immédiatement satisfaisantes, fluides et non bloquantes.

### Phase 6 — Finition
Tester les cas limites, le redémarrage, les tailles de fenêtre, les performances et les préférences de mouvement réduit.

Validation : tests, vérification TypeScript et build réussis ; jeu jouable du début à la fin.

## 13. Livraison

Livrer un jeu fonctionnel et non une simple maquette. Fournir les commandes de développement et de build, expliquer les choix techniques importants et signaler les limites restantes. Ne pas prétendre avoir effectué une vérification visuelle si le jeu n’a pas été exécuté.

Commencer par inspecter le dépôt et présenter le plan d’implémentation. Ne modifier aucun fichier avant validation explicite du plan.