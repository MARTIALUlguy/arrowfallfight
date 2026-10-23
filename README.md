# ARROWFALL

Jeu de combat **tour par tour stratégique avec QTE** (séquences de flèches directionnelles).
Deux duelists s'affrontent dans une arène néon : l'attaquant choisit son action, le défenseur
répond à l'aveugle, puis les réflexes des deux joueurs décident de l'efficacité réelle.

- **Stack** : Next.js 14 (App Router) · TypeScript strict · Tailwind CSS · Framer Motion · Zustand
- **Rendu** : client statique (`output: "export"`); le PvP en ligne utilise un serveur PeerJS séparé pour la signalisation
- **Assets** : aucun fichier binaire — SVG, Canvas et Web Audio générés en code
- **Langues** : FR / EN (i18n maison, sélecteur persistant)

## Installation

```bash
npm install
npm run dev        # http://localhost:3000
```

### Développement du PvP en ligne en local

Le mode `/online` utilise WebRTC pour le trafic de jeu et PeerServer uniquement pour
la signalisation. Dans un terminal, démarre le serveur PeerJS fourni :

```powershell
$env:PORT="9000"; $env:PEER_PATH="/peerjs"; npm run signaling:start
```

Dans un second terminal, crée `.env.local` à la racine avec :

```dotenv
NEXT_PUBLIC_PEER_HOST=localhost
NEXT_PUBLIC_PEER_PORT=9000
NEXT_PUBLIC_PEER_PATH=/peerjs
NEXT_PUBLIC_PEER_SECURE=false
NEXT_PUBLIC_PEER_KEY=peerjs
```

Puis lance `npm run dev`. Ouvre deux pages/navigateurs, crée un salon dans l'un et
rejoins-le avec le code dans l'autre. Les variables `NEXT_PUBLIC_*` sont intégrées au
bundle au build : il faut reconstruire l'application après les avoir modifiées.

Le serveur de signalisation est un sous-projet indépendant (`signaling-server/`) :
`npm install --prefix signaling-server` puis `npm run signaling:start`. Il accepte
`PORT`, `PEER_PATH`, `PEER_KEY` et `PEER_PROXIED`. En production, déploie ce serveur
sur une machine disposant de TLS et configure les variables `NEXT_PUBLIC_PEER_*`
avant le build statique. WebRTC peut nécessiter un serveur TURN derrière certains NAT
ou réseaux d'entreprise; le client actuel s'appuie sur la configuration ICE par défaut
de PeerJS, sans interface de configuration TURN.

## Build & déploiement Vercel

```bash
npm run build      # génère le dossier statique `out/`
```

Déploiement pas à pas :

1. Crée un dépôt GitHub et pousse le projet (`git init && git add -A && git commit -m "ARROWFALL" && git push`).
2. Sur [vercel.com](https://vercel.com) : **Add New Project** → importe le dépôt.
3. Framework : Next.js (détecté automatiquement). Build command : `npm run build`.
   Configure les variables `NEXT_PUBLIC_PEER_*` avant le build pour activer le PvP en
   ligne; les autres modes ne nécessitent pas de variables.
4. **Deploy**. Le dossier `out/` est servi en statique.

## Structure

```
src/
  app/            pages (menu, sélection, deck, combat, codex, options, records)
  components/     (Phases 2-5 : battle/, menus/, cards/, common/)
  engine/         (Phases 1-4 : machine à états, résolveur, QTE, IA)
  systems/        audio, save (localStorage), i18n, particles, rng
  data/           characters.ts, cards.ts, statuses.ts, campaign.ts, survival.ts, decks.ts
  i18n/           fr.ts (référence) + en.ts (typé typeof fr)
  types/          (les types vivent dans src/types/index.ts)
```

## Progression du projet (plan en phases)

| Phase | Contenu | Statut |
|-------|---------|--------|
| 0 | Scaffold + types + data (26 cartes universelles, 24 signatures, 8 persos, 11 statuts) + i18n FR/EN + écrans routés | ✅ |
| 1 | Moteur de combat (machine à états, résolveur, IA facile) + écran jouable | ✅ |
| 2 | QTE complet + scène Canvas + sprites SVG + juice | ✅ |
| 3 | Rendu des cartes + deck-builder + codex | ✅ |
| 4 | Compétences/ultimes/cooldowns des 8 persos + IA normale/difficile | ✅ |
| 5 | Écrans complets + campagne + survie + PvP local | ✅ |
| 6 | Audio procédural + tutoriel + sauvegarde avancée + co-op local + PvP PeerJS | ✅ |
| 7 | Polish responsive, safe-area mobile et accessibilité clavier | ✅ |

## Décisions d'implémentation (documentées ici, comme demandé)

- **Types** dans `src/types/index.ts` (un seul fichier, cohérent avec le plan §16).
- **`StatusApplication.onPerfect`** : un statut marqué `onPerfect: true` ne s'applique que si
  le QTE est majoritairement Perfect (badge doré sur la carte). Cela couvre Coup bas, Zéro absolu,
  Barrière de glace, Iaido, etc.
- **Effets déclaratifs** : `CardEffect` est un DTO interprété uniquement par le résolveur (Phase 1) —
  l'équilibrage se fait dans `src/data/` sans toucher à la logique.
- **Répliques** : stockées par clés `q.<perso>.<catégorie>.<n>` dans les deux dictionnaires.
- **Sauvegarde** : `localStorage["arrowfall_save_v1"]`, fusionnée avec les défauts à chaque lecture.
- **Ultime d'Aïko** (mode `hybrid`) : `defensiveEffect` porte blocage 80 % + riposte 18 + Régén ;
  celui de Vörn porte dégâts 20 + Bouclier 20 dans `effect`.

## Phase 1 — combat jouable

Le premier duel jouable est disponible via **Campagne** → chapitre → personnage → deck → combat.
L'écran réutilise les decks recommandés réels et oppose le personnage choisi à l'adversaire
du chapitre, contrôlé par l'IA correspondant à la difficulté du chapitre. Le combat s'enchaîne par échanges : choix de l'action
offensive, choix de défense, QTE de l'attaquant puis du défenseur, résolution, vérification
du K.O. et passage au combattant suivant.

- Machine à états dans `src/engine/battle.ts`, définitions d'actions dans
  `src/engine/actions.ts`, résolution des effets dans `src/engine/resolver.ts` et IA facile
  dans `src/engine/ai.ts`.
- Les QTE utilisent les flèches du clavier ou les boutons à l'écran ; la Phase 2 ajoute les
  fenêtres temporelles et les grades Perfect/Good/Miss.
- Les cartes, compétences, ultimes, coûts, dégâts, défense, boucliers, soins, statuts,
  ressources, pioche, cooldowns, contres et jauge Super utilisent les données du domaine.
  Les ressources démarrent à 3 (maximum 10) et récupèrent 1 de chaque ressource au début
  du tour de leur propriétaire. La main est limitée à 7 cartes.
- Le combat prend fin à 0 PV ou après 20 tours complets ; dans ce dernier cas, le ratio de
  PV restants départage les combattants.
- Les mécaniques passives et les cooldowns des personnages sont résolus par le moteur.
  La Phase 4 ajoute aussi les niveaux d'IA facile, normal et difficile, sélectionnables dans
  les options.

## Phase 2 — QTE et scène d'arène

- `src/engine/qte.ts` génère les séquences et définit les fenêtres chronométrées : Perfect
  jusqu'à 360 ms, Good jusqu'à 650 ms, puis Miss à l'expiration des 900 ms par flèche.
  Gel réduit la fenêtre de 25 % ; Célérité l'augmente de 25 %. Les réponses en retard sont
  automatiquement notées Miss, sans bloquer le combat.
- Le mode zen (option persistante) retire le chronomètre et fixe le multiplicateur à ×0,85.
  Un input conforme à la séquence est alors noté Perfect ; les entrées erronées restent des
  Miss.
- La séquence tient compte de `qteMinus` et `nextQtePerfectOnly` : ce dernier n'accepte que
  les entrées Perfect et n'est consommé qu'au prochain QTE effectif. Les QTE sans flèche ne
  consomment pas ces modificateurs.
- Les effets conditionnés par « Perfect » utilisent une majorité stricte de Perfects ; le
  bonus ×1,1 reste réservé à une séquence entièrement Perfect. Les protections de Gel sont
  appliquées, et le grade de chaque entrée est visible dans l'interface.
- `src/components/battle/BattleScene.tsx` dessine l'arène et les portraits stylisés en SVG,
  avec particules sur Canvas, flottement et impact. Aucun asset binaire ni dépendance
  supplémentaire n'est nécessaire ; les animations sont désactivées quand le système
  demande une réduction des mouvements.

## Phase 3 — cartes, deck-builder et codex

- `src/components/cards/CardTile.tsx` fournit une présentation réutilisable des cartes :
  coût en Énergie/Mana/PV, rareté, type, description, nombre de flèches et indicateur de
  condition Perfect.
- `/deck` est devenu un éditeur de deck. Il charge le deck personnalisé sauvegardé s'il est
  valide, sinon le deck recommandé du personnage. La bibliothèque est limitée aux cartes
  universelles et aux signatures de ce personnage, avec recherche et filtres par type,
  rareté et coût. Ajout/retrait, limite de 20 cartes, maximum 2 copies par carte et maximum
  1 carte épique sont vérifiés. Les decks invalides ne peuvent pas être lancés.
- La courbe de coûts est affichée en direct. **Enregistrer et combattre** conserve le deck
  dans `arrowfall_save_v1`; le moteur charge ce deck personnalisé au prochain combat. La
  validation du moteur refuse aussi les signatures d'un autre personnage.
- `/codex` détaille les 8 personnages (mécanique, statistiques, compétences et ultimes),
  les 50 cartes (filtrables par groupe et recherche) et les 11 statuts avec leurs icônes SVG,
  effets et alignements. Les libellés sont traduits FR/EN.

## Phase 4 — mécaniques et IA

- Les mécaniques passives annoncées dans le codex sont actives en combat : Saignement et
  réduction de coût de Kael, Brûlure renforcée de Lyra, bouclier réactif de Vörn, vol de
  ressources de Sylphe, soin sur dégâts de Poison/Saignement de Mordrak, bonus d'Énergie
  après les QTE parfaits consécutifs d'Aïko, Marque d'Écho et dégâts/réduction de QTE de
  Nyra contre une cible Gelée.
- Les statuts de dégâts sur la durée gardent la trace du combattant qui les a appliqués pour
  que Moisson attribue correctement ses soins. Les cooldowns d'attaque et de défense sont
  affichés dans l'arène avec la mécanique de chaque combattant.
- La difficulté se règle dans **Options** et est sauvegardée : facile choisit parmi les
  meilleures actions et réalise des QTE « Bien », normale choisit l'action la mieux notée
  avec des QTE généralement parfaits, difficile adapte ses défenses à l'attaque reçue et
  réussit tous ses QTE parfaitement.

## Phase 5 — modes de jeu

- `/campaign` présente les huit chapitres, leurs dialogues, adversaires et difficultés. Ils se
  débloquent dans l'ordre après les victoires; les cartes de récompense et le chapitre terminé
  sont enregistrés dans la sauvegarde. Chaque combat emploie l'adversaire et le niveau d'IA
  défini par le chapitre.
- `/survival` lance une série de vagues, permet de reprendre une partie entre les vagues et
  enregistre le meilleur numéro atteint. À chaque victoire, le joueur choisit un bonus; PV,
  jauges et améliorations sont conservés, tandis que l'IA gagne en difficulté et en PV.
- `/pvp` propose un duel local à deux joueurs avec choix de personnages. Chaque joueur choisit
  ses actions et réalise ses QTE sur le même clavier; les mains, ressources, statuts et
  cooldowns restent distincts.
- Les trois modes sont accessibles depuis le menu et restent compatibles avec l'export statique.

## Phase 6 — audio, tutoriel, sauvegarde et coopération locale

- `src/systems/audio.ts` génère musique d'ambiance et effets sonores avec Web Audio, sans
  fichier audio ni dépendance supplémentaire. L'audio est initialisé à la suite d'une
  interaction utilisateur pour respecter les règles d'autoplay du navigateur. La musique
  et les effets suivent leurs volumes respectifs; Options propose des préécoutes.
- Le premier combat affiche un tutoriel en cinq étapes, traduit en français et en anglais.
  Il est possible de le passer, de le terminer ou de le rouvrir pendant le combat.
- Les résultats des QTE humains alimentent les records cumulés de parfaits et la meilleure
  série. Le verrou de fin de combat existant empêche le comptage multiple des matchs.
- Options permet d'exporter une sauvegarde JSON ou d'en importer une version 1; les champs
  sont normalisés avant écriture et un fichier de structure invalide est refusé.
- `/coop` permet de choisir deux héros distincts (Vörn est réservé au rôle de boss), chacun
  avec son propre deck, ses PV, ses ressources, sa main, ses statuts et ses cooldowns. Le
  duo joue sur le même appareil : les héros attaquent à tour de rôle et le boss IA répond
  en visant alternativement le combattant actif. Le combat se termine lorsque les deux
  héros ou le boss sont vaincus.
- Le moteur porte maintenant les membres et cibles des équipes explicitement; les modes
  existants restent représentés comme des équipes d'un combattant et conservent ainsi leurs
  règles de tour. La coopération utilise le même résolveur de cartes, de QTE et de statuts.
- `/online` propose la création/rejoint d'un salon et un duel PeerJS/WebRTC. La
  simulation du combat et la validation des actions sont autoritaires côté hôte;
  PeerServer ne transporte pas l'état du jeu. L'hôte est toutefois un navigateur et
  non un serveur de confiance : ce prototype n'offre ni anti-triche, ni comptes,
  matchmaking, reconnexion ou serveur TURN intégré.

## Phase 7 — polish responsive et accessibilité

- L'arène de combat conserve un cadre **16:9 letterboxé** (largeur maximale de 56 rem),
  avec canvas et combattants à l'intérieur de ce cadre. Sa taille s'adapte aux écrans
  étroits et le rendu reste centré sur les vues desktop et en coopération.
- L'écran de combat prend en compte les safe areas des appareils mobiles et empêche le
  débordement horizontal. Les commandes sont dimensionnées pour rester facilement
  activables au tactile.
- Les boutons, liens et champs disposent d'un indicateur de focus clavier visible;
  les animations existantes continuent de respecter `prefers-reduced-motion`.
- Les écrans de sélection, deck-builder, coopération et lobby en ligne ont été vérifiés
  à 320, 390, 768 et 1280 px : aucun élément visible ne dépasse horizontalement de
  l'écran; les contrôles restent dans la zone de contenu.

### Checklist de validation finale

- [x] `npm run build` : compilation TypeScript et export statique des 15 routes.
- [x] Écrans de combat, sélection, deck-builder, coopération et lobby vérifiés en vue
  mobile et desktop; l'arène garde son ratio 16:9.
- [x] Lobby hôte/invité PeerJS testé sur deux pages locales; synchronisation d'état,
  échange d'action et QTE vérifiés dans le navigateur.
- [x] Guide de développement local et de déploiement Vercel ci-dessus; variables réseau
  documentées pour le serveur de signalisation autonome.
- [ ] Déploiement réel sur Vercel et duel depuis deux réseaux externes : dépend d'un
  serveur de signalisation public avec TLS et, selon les NAT, d'un serveur TURN.
