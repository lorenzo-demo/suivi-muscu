# Suivi Muscu Builder

**Un carnet d'entraînement qui décide de la charge à ta place.**

👉 **[Ouvrir l'application](https://lorenzo-demo.github.io/suivi-muscu/)**

Application web installable (PWA), sans compte, sans serveur, sans publicité. Tout est stocké
sur ton téléphone. Un seul fichier HTML, aucune dépendance, aucun outil de build.

---

## Le principe

Tu entres ce que tu as réellement fait. L'application calcule ce que tu dois faire la fois
suivante — poids **et** répétitions, série par série, sur des charges qui existent vraiment
dans ta salle.

Trois mécaniques travaillent ensemble :

**Un cycle de 6 semaines** alternant les blocs *Hypertrophie* (8-12 reps), *Force* (5-6 reps)
et *Endurance* (20-25 reps). Le cycle avance au rythme des séances réellement effectuées, pas
du calendrier. Chaque programme peut avoir son propre plan de cycle.

**Une double progression** qui pilote poids et répétitions séance après séance : consolidation,
+1 répétition, montée de charge avec atterrissage prédit, extension du plafond de reps. Une
borne stricte de +10 % par montée, modulée par un ressenti *Facile / Correct / Limite*. Quand
ça bloque deux séances de suite, la charge redescend d'un palier — et immédiatement si l'échec
est net.

**Des paliers réels.** Chaque exercice connaît les charges physiquement disponibles : machines
à plaques de 10 ou 15 lb (avec les petits poids d'appoint), haltères simples ou par paires,
barres et machines à disques chargeables au kilo près. L'application ne propose jamais un poids
qui n'existe pas.

Le 1RM est estimé en continu (formules d'Epley et Brzycki), lissé sur les meilleures séances
récentes, et sert de référence aux pourcentages de chaque bloc.

---

## Ce que tu peux faire

### Suivre un programme
Un programme par défaut est fourni : un split 3 séances (bas du corps, pectoraux/épaules,
dos/bras) prêt à l'emploi. Échauffement adapté au bloc, chronomètre de repos résistant à la
mise en veille, commentaires et ressenti par exercice, étirements en fin de séance.

### Créer les tiens
Un créateur complet : compose tes séances depuis une base de **65 mouvements** documentés
(muscles primaires et secondaires, matériel admis, avertissements techniques), assemble-les en
programmes, définis ton rythme hebdomadaire. Chaque exercice créé bénéficie immédiatement de
tout le moteur — 1RM, cycle, progression, paliers réels — exactement comme les exercices
préchargés.

### Te faire assister
Un assistant génère un programme complet à partir de trois réponses : ton niveau, tes jours
disponibles, tes muscles prioritaires. Il propose une structure (full body, haut/bas, PPL) en
expliquant *pourquoi*, et te laisse choisir parmi les alternatives légitimes. Le résultat est
un brouillon entièrement modifiable.

### Mesurer ton volume
Une jauge affiche tes séries hebdomadaires par muscle, avec le comptage fractionnel de la
littérature récente (série directe = 1, indirecte = 0,5) et les repères de ~10-20 séries par
muscle et par semaine. Tape une ligne : le calcul se déplie, exercice par exercice.

### Progresser sur le gainage
Les exercices de gainage sont organisés en **échelles de progression** — de la planche sur les
genoux jusqu'à la planche latérale genou-poitrine, du crunch jusqu'au dragon flag. Quand tu
tiens le haut de la fourchette deux séances de suite, l'application propose le palier suivant.
Quand tu restes en dessous, elle propose de redescendre. Les paliers avancés ne sont jamais
suggérés automatiquement.

### Compter en temps ou en répétitions
Chaque exercice bascule entre répétitions et secondes. En mode temps, un chronomètre se lance
sur chaque série et reporte la durée réellement tenue — pas la durée visée.

---

## Installation

Ouvre [l'application](https://lorenzo-demo.github.io/suivi-muscu/) dans ton navigateur, puis :

- **iPhone / iPad** : bouton Partager → *Sur l'écran d'accueil*
- **Android** : menu ⋮ → *Installer l'application* (ou *Ajouter à l'écran d'accueil*)

Elle fonctionne ensuite hors ligne, en plein écran, comme une application native.

**Avant la première séance**, renseigne ton poids et ta date de début de cycle dans ⚙️ Réglages.
Le poids sert à calculer la charge réelle des exercices assistés (tractions, dips) ; la date
lance la planification du cycle.

---

## Tes données

Tout reste sur ton appareil, dans le stockage local du navigateur. Rien n'est envoyé nulle part,
aucun compte n'est requis.

**Pense à exporter régulièrement** (⚙️ Réglages → Export JSON) : vider les données du navigateur
ou désinstaller l'application effacerait ton historique. L'import restaure tout, y compris tes
programmes personnels et tes préférences.

---

## Fondements

Les choix méthodologiques s'appuient sur la littérature scientifique plutôt que sur la
tradition de salle :

- **Volume** — Schoenfeld et al. (2017) pour la relation dose-réponse ; Baz-Valle et al. (2022)
  et Pelland et al. (2024) pour les repères hebdomadaires et le comptage fractionnel.
- **Ordre des exercices** — Nunes et al. (2021) : l'ordre n'affecte pas l'hypertrophie, mais la
  force progresse davantage sur ce qui est placé en premier. D'où des avertissements
  pédagogiques, jamais de blocage.
- **Fréquence** — Grgic et al. (2018) : à volume égalisé, la fréquence importe peu. Elle sert à
  répartir le volume, pas à le remplacer.
- **Débutants** — recommandations NSCA et ACSM : full body 2-3 fois par semaine, charges
  modérées, priorité à la technique. L'assistant applique un cycle sans bloc Force tant que la
  technique se construit.

L'application conseille, elle n'impose pas. Chaque avertissement explique son raisonnement et
peut être ignoré.

---

## Technique

Fichier unique `index.html` (HTML, CSS et JavaScript), service worker pour le mode hors ligne,
manifest PWA. Aucune dépendance, aucun framework, aucune étape de compilation : le fichier
déployé est le fichier source.

Le stockage utilise un schéma versionné avec migration automatique — les mises à jour de
l'application enrichissent le programme par défaut sans jamais toucher aux programmes
personnels, ni aux substitutions d'exercices, ni aux préférences.

Plus de **400 tests headless** (jsdom) couvrent le moteur de progression, les tables de paliers,
le créateur, l'assistant, les échelles de gainage et les migrations de données.
