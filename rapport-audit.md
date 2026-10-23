# ARROWFALL — Rapport d'audit fonctionnel

**Date :** 2026-10-22
**Périmètre :** audit statique et fonctionnel complet du dépôt ARROWFALL (moteur, UI, données, i18n, modes de jeu, contenu, documentation).
**Méthode :** lecture exhaustive du code source, exécution de `npx tsc --noEmit` et `npm run build`, comptage automatisé des clés i18n et du contenu.
**Statut :** aucun fichier du projet n'a été modifié. Ce rapport est le seul artefact produit.

---

## 1. Verdict

ARROWFALL est une **alpha jouable et techniquement saine**. Le socle est réel : le moteur de combat fonctionne, le build passe, le typage est strict, l'i18n FR/EN est complet et apparié, et les 8 phases du plan sont structurellement livrées.

En revanche, **plusieurs mécaniques annoncées ne sont pas câblées**. Un statut est décrit dans les données et dans les textes mais n'a aucun effet ; un mode « Super » est typé et documenté mais inerte ; un corpus de 112 répliques de personnages n'est jamais affiché. Le README présente ces features comme livrées.

Le projet est **plus avancé que son README ne le déclare dans un sens, et moins avancé dans l'autre**. Il faut distinguer deux choses :

- **Ce qui est structurellement livré** : fichiers présents, routes rendues, données complètes, i18n apparié → conforme au plan.
- **Ce qui est comportementallement livré** : la feature produit-elle l'effet décrit dans les données et les textes → plusieurs non.

C'est précisément la seconde catégorie qui pose problème, et c'est celle qu'un audit de phases basé sur la présence des fichiers ne détecte pas.

**Recommandation :** traiter les 4 écarts P1 comme bloquants avant toute mise en production ou présentation externe. Le reste est de la dette de finition, gérable par lots.

---

## 2. Conformité par phase

Évaluation sur la base du comportement observable, pas uniquement de l'existence des fichiers.

| Phase | Contenu annoncé | Statut structurel | Statut fonctionnel | Verdict |
|-------|------------------|-------------------|--------------------|---------|
| 0 | Scaffold + types + data (26 cartes universelles, 24 signatures, 8 persos, 11 statuts) + i18n FR/EN + écrans routés | Livré | Conforme | **OK** |
| 1 | Moteur de combat (machine à états, résolveur, IA facile) + écran jouable | Livré | Conforme | **OK** |
| 2 | QTE complet + scène Canvas + sprites SVG + juice | Livré | Conforme | **OK** |
| 3 | Rendu des cartes + deck-builder + codex | Livré | Mineur | **Écarts mineurs** |
| 4 | Compétences/ultimes/cooldowns + IA normale/difficile | Livré | Partiel | **Écart critique** |
| 5 | Écrans complets + campagne + survie + PvP local | Livré | Conforme | **OK** |
| 6 | Audio procédural + tutoriel + sauvegarde avancée + co-op local + PvP PeerJS | Livré | Conforme | **OK** |
| 7 | Polish responsive, safe-area mobile et accessibilité clavier | Livré | Mineur | **Écarts mineurs** |

**Bilan :** 5 phases pleinement conformes, 2 partielles (4 et 7), 1 avec des écarts mineurs (3). Aucune phase manquante.

---

## 3. Écarts critiques (P1)

### 3.1 — Le statut `stun` est défini mais n'a aucun effet

**Gravité : P1 — bloquant pour la correctitude du jeu.**

Le statut `Étourdi` est déclaré dans `src/data/statuses.ts:55-58`, listé dans le catalogue des statuts négatifs (`src/data/statuses.ts:125`), typé dans `StatusId` (`src/types/index.ts:182`), et correctement traité comme un statut négatif purgable (`src/engine/resolver.ts:148`).

Il est appliqué par deux sources :
- `src/data/cards.ts:34` — carte *Coup bas* : `targetStatuses: [{ id: "stun", duration: 1, onPerfect: true }]`
- `src/data/characters.ts:491` — ultime de Sylphe : `{ id: "stun", duration: 1, onPerfect: true }`

**Mais aucun code ne le consomme.** La fonction qui gère les statuts de fin de tour (`endTurnStatuses`, `src/engine/resolver.ts:404-431`) traite `burn`, `bleed`, `poison` (dégâts), `regen` (soin) et la décroissance de `turnsLeft`. Elle ne gère **pas** `stun`.

Conséquence exacte :
1. Le statut est **appliqué** sur la cible → le badge s'affiche dans l'UI (`src/app/game/page.tsx:774-776`).
2. Le statut **n'est jamais lu** → aucune phase d'action n'est sautée.
3. Le statut **décrémente et expire** normalement → il disparaît sans jamais avoir fait quoi que ce soit.

Le joueur voit donc « Étourdi » s'afficher pendant un tour, et le combattant étourdi joue normalement au tour suivant. C'est une promesse non tenue au joueur, doublée d'un état d'interface qui contredit la règle.

**Preuves complémentaires :**
- Le texte i18n existe et est correct : `battle.stunned` → « Étourdi ! Phase d'action sautée. » (`src/i18n/fr.ts:214`, `src/i18n/en.ts:215`).
- La description du statut est explicite : « Saute la prochaine phase d'action (Garde automatique). » (`src/i18n/fr.ts:301`, `src/i18n/en.ts:302`).
- **Or la clé `battle.stunned` n'est référencée nulle part dans le code applicatif.** Une recherche sur `src/app/`, `src/components/` et `src/engine/` ne retourne aucune occurrence. Le message existe, mais il n'est jamais affiché.

**Règle annoncée mais non implémentée :** la phase d'action doit être sautée, le défenseur doit passer en Garde automatique.

**Correctif attendu :** dans le résolveur, avant la sélection d'action de la cible, vérifier `hasStatus(fighter, "stun")` ; si présent, forcer l'action de défense à `basic-guard`, court-circuiter la phase d'attaque, pousser le message `battle.stunned` dans le log et dans un bandeau UI, et consommer le statut.

**Point d'attention :** la phrase « Garde automatique » dans la description n'est pas couverte par le même correctif. Il faut décider explicitement si `stun` implique une garde automatique ou si la carte *Coup bas* et l'ultime de Sylphe sont « saut d'action pur ». C'est un arbitrage de design à acter, pas un détail d'implémentation.

### 3.2 — Le mode « Super » est typé et documenté mais jamais activable

**Gravité : P1.**

Le concept existe à trois endroits, mais il n'est relié à rien.

**Ce qui existe :**
- `superTurnsLeft: number` dans `CombatantState` (`src/types/index.ts:304`) — initialisé à 0 (`src/engine/battle.ts:21`).
- Le kind d'action `"super-activate"` dans `ActionKind` (`src/types/index.ts:285`).
- Un case dans `getActionDefinition` : `case "super-activate": return { effect: {}, qte: 0, cost: {} };` (`src/engine/actions.ts:53-54`).
- `superGauge` (0→100) sur le combattant (`src/types/index.ts:303`), alimenté par `effect.superGain` (`src/engine/resolver.ts:80`) et par les dégâts infligés (`src/engine/resolver.ts:243-244`).
- L'interface affiche la jauge : `Super: {fighter.superGauge}%` (`src/app/game/page.tsx:756`).

**Ce qui manque :**
- `superTurnsLeft` n'est **écrit nulle part** en dehors de son initialisation à 0. Il n'est lu par aucun code. Recherche exhaustive : les 2 seules occurrences dans tout `src/` sont la déclaration de type et l'initialisation.
- Aucun `super-activate` n'est proposé dans `getAvailableActions` (`src/engine/actions.ts:145-151` n'ajoute que des actions `ultimate`).
- Le `superGain` des cartes existe (`src/data/cards.ts:149, 199, 218, 256, 355`) mais alimente la jauge `superGauge`, pas le mode Super.
- Le README mentionne « jauge Super » dans les mécaniques actives (`README.md:118`).

**Résultat :** la jauge monte, s'affiche, ne peut déclencher aucune action, et le mode « Super » — le mot lui-même présent dans le type — n'est jamais atteint. Un joueur qui optimise sa jauge découvrira qu'elle ne mène nulle part.

**Deux options, à trancher :**

| Option | Action | Effort | Risque |
|--------|--------|--------|--------|
| **A — Implémenter** | Câbler `super-activate` : afficher un bouton quand la jauge est pleine, déclencher une phase bonus (demi-tours), gérer `superTurnsLeft` dans la machine à états | Élevé (engine + UI + règles de demi-tour) | Retarder la livraison |
| **B — Retirer** | Supprimer `superTurnsLeft` et `super-activate` des types, du moteur et du README ; garder `superGauge` comme jauge d'ultime | Faible (nettoyage) | Perte d'une feature annoncée |

**Recommandation :** Option A si le mode Super figure dans la vision du produit, sinon Option B. Ce qui est inadmissible, c'est de laisser l'état actuel : la feature est annoncée comme livrée et ne l'est pas. Si l'option B est retenue, le README doit être corrigé — c'est le seul écart que l'utilisateur verra.

---

### 3.3 — Les 112 répliques de personnages ne sont jamais affichées

**Gravité : P1 (perception produit) — plus faible en impact mécanique, mais c'est la fonctionnalité la plus visible du corpus de contenu.**

Le corpus est complet et cohérent :
- 8 personnages × 14 répliques = **112 répliques par langue**, réparties en 6 catégories (`attack`, `damage`, `victory`, `defeat`, `ultimate`, `taunt`).
- Répartition : attack 24, damage 24, victory 16, defeat 16, ultimate 16, taunt 16.
- Les clés sont **parfaitement appariées** entre FR et EN (112 / 112, 0 orpheline de part ou d'autre).
- Chaque personnage expose ses répliques via `quotes` dans `src/data/characters.ts` (8 blocs, lignes 63, 132, 189, 253, 313, 374, 433, 502).

**Mais rien ne les affiche :**
- Le helper `ta()` existe dans l'API i18n (`src/systems/i18n.tsx:6, 48` — `ta: (key: string) => string[]`).
- **Aucun appel à `ta()` dans tout `src/app/` ni `src/components/`.** Recherche exhaustive : 0 occurrence.
- `quotes` n'est lu par aucun composant.

Le README décrit pourtant la mécanique en détail : « **Répliques** : stockées par clés `q.<perso>.<catégorie>.<n>` dans les deux dictionnaires. » (`README.md:99`).

**Impact :** un corpus de 112 textes localisés dans deux langues, dont la finalité est identifiée dans les types (`CharacterQuotes`, `src/types/index.ts:233`) et documenté dans le README, n'atteint jamais le joueur. C'est du contenu produit puis jamais branché — l'inverse exact d'un contenu manquant.

**Correctif attendu :** tirer une réplique aléatoire dans la catégorie appropriée au moment de l'événement (attaque, dégâts reçus, victoire, défaite, ultime, raillerie) et l'afficher dans la scène de combat (`src/components/battle/BattleScene.tsx`) ou en overlay au-dessus de l'arène.

---

### 3.4 — Aucun test automatisé

**Gravité : P1 (dette structurelle).**

Le dépôt ne contient **aucun** fichier de test :
- Aucun `*.test.*`, aucun `*.spec.*` dans tout le dépôt.
- Aucun script `test` dans `package.json` — les scripts disponibles sont `dev`, `build`, `start`, `signaling:start`, `lint`.
- Aucune dépendance de test : ni Vitest, ni Jest, ni Testing Library.

Le moteur de combat est le cœur de valeur du projet (résolveur, machine à états, IA, QTE, effets déclaratifs) et il repose sur des invariants non triviaux : ordre d'application des statuts, décroissance des compteurs, propagation des ressources, ciblage en équipe, conditions `onPerfect`. **Rien de tout cela n'est protégé par un test.**

C'est aussi ce qui rend les trois écarts P1 précédents si peu coûteux à corriger : le problème n'est pas la complexité de l'implémentation, c'est l'absence de filet de sécurité. Un `stun` correctement implémenté sans test peut réintroduire le bug en deux refactors.

**Correctif attendu :** ajouter Vitest avec une suite minimale ciblant les zones à risque :
- `resolver.ts` — application et expiration des statuts, ordre des effets, calcul de dégâts, absorption de bouclier.
- `battle.ts` — transitions de phases, coût des actions, rotation en équipe.
- `qte.ts` — bornes de fenêtre (360 / 650 / 900 ms), multiplicateurs Gel / Célérité, mode zen.
- `decks.ts` — validation de deck, deck recommandé.
- `ai.ts` — sélection d'action par niveau de difficulté.
- `resolver.ts` — le cas `stun` nouvellement implémenté.

**Effort :** initialisation ≈ 1 h ; suite de tests de non-régression sur le résolveur ≈ 3-5 h.

---

## 4. Écarts mineurs (P2)

| # | Écart | Preuve | Impact | Effort |
|---|-------|--------|--------|--------|
| P2.1 | **Journal de combat non traduit.** Les messages du log sont écrits en français dans le moteur. | `src/engine/resolver.ts:389-391` (`${attacker.characterId} inflige ${totalDamage} dégâts…`), `src/engine/resolver.ts:467` (`${winners} remporte le combat.`) | Le journal reste en français en mode EN | 2-3 h |
| P2.2 | **Écran de résultats non exploité.** L'écran de fin de combat n'affiche ni statistiques (dégâts totaux, coups perfect, tours) ni récapitulatif de la partie. | `src/app/game/page.tsx:948-1010` — seuls le message de victoire/défaite et les boutons de navigation sont rendus | L'écran de résultats est le moment naturel d'afficher les répliques `victory`/`defeat` ; c'est aussi la place naturelle du récapitulatif de statistiques | 3-5 h |
| P2.3 | **`keepPerfectStreak` inactif.** La variable est écrite par une carte mais jamais lue. | Écriture unique : `src/data/cards.ts:295` (`varsSet: { keepPerfectStreak: 1 }`). Aucune lecture dans tout `src/`. `resolver.ts:396` remet `perfectStreak` à 0 sans consulter cette variable | La carte promet un effet qui n'existe pas ; le multiplicateur de streak est perdu même quand la carte est jouée | 1-2 h |
| P2.4 | **`superGain` déséquilibré.** La jauge se remplit beaucoup trop vite. | `src/data/cards.ts` : 25 / 30 / 25 / 30 / 15 points sur 5 cartes, plus `resolver.ts:243-244` qui ajoute `ceil(dégâts/4)` à l'attaquant et `ceil(dégâts/6)` à la cible à chaque coup porté. Une carte à 25 points + un tour de combat de ~30 dégâts porte la jauge à ~100 en un tour | Le mode Super (ou l'ultime) devient accessible dès le premier tour : le rythme de progression est court-circuité | 1-2 h |
| P2.5 | **Zustand déclaré mais inutilisé.** | `package.json` : `"zustand": "^4.5.4"`. Recherche sur `src/` : 0 occurrence de `zustand` ou `useStore`. L'état de combat vit dans un `useState` local de `src/app/game/page.tsx` | Dépendance inutile (~1 ko), et le README annonce « Zustand » dans la stack alors que le state est en React local | 10 min |
| P2.6 | **Arborescence README incohérente.** | `README.md:68-76` annonce `components/ (Phases 2-5 : battle/, menus/, cards/, common/)`. Or `src/components/` ne contient que `battle/` et `cards/` — pas de `menus/`, pas de `common/`. `src/data/` annonce `survival.ts` : le fichier existe bien. `src/systems/` annonce `particles, rng` : `particles.ts` et `rng.ts` existent bien | Un lecteur qui suit le README cherche des dossiers inexistants | 10 min |
| P2.7 | **Sprites génériques.** | Les personnages sont dessinés procéduralement en SVG dans `src/components/battle/` — pas de sprite dédié par personnage | Acceptable pour une alpha, mais limite l'identification visuelle | Non chiffré |
| P2.8 | **Zéro contrôle de version.** | Aucun dépôt Git dans le répertoire. Les phases sont archivées en `.zip` à la racine (`arrowfall-phase1.zip` … `arrowfall-phase7-polish.zip`) | Pas d'historique, pas de diff, pas de rollback. Les `.zip` sont un substitut fragile au versionnage | 1 h (init + commit initial) |
| P2.9 | **Encodage de sortie console.** | Les accents apparaissent en `Ã©` dans la sortie PowerShell (effet d'affichage du terminal, pas un défaut des fichiers) | Aucun — effet d'affichage uniquement | — |

---

## 5. Points de conformité validés

Éléments **conformes** au cahier des charges, à conserver comme acquis :

- **Contenu** : 50 cartes, 8 personnages, 11 statuts, decks recommandés et validation de deck opérationnels.
- **i18n** : 638 clés par langue, **appariement parfait** — 0 clé présente en FR et absente en EN, 0 inverse, 0 chaîne vide, 0 divergence de placeholders.
- **QTE** : fenêtres temporelles conformes (Perfect ≤ 360 ms, Good ≤ 650 ms, Miss à 900 ms), multiplicateurs Gel (×0,75) et Célérité (×1,25), mode zen (×0,85), gestion de `qteMinus` et `nextQtePerfectOnly`.
- **Moteur** : machine à états complète, résolveur d'effets déclaratifs, IA à 3 niveaux (facile / normal / difficile, sélectionnable en options), cooldowns, contre-attaques, ressources, pioche, jauge Super.
- **Modes de jeu** : Campagne (8 chapitres), Survie, PvP local, Co-op local (2 contre 1 avec rotation), PvP en ligne (PeerJS + serveur de signalisation séparé).

---

## 6. Plan de remédiation

### P1 — avant toute diffusion

| Ordre | Action | Fichiers | Effort | Risque |
|-------|--------|----------|--------|--------|
| 1 | **Implémenter `stun`** : saut de la phase d'action + garde automatique + affichage de `battle.stunned` + consommation du statut | `src/engine/resolver.ts`, `src/app/game/page.tsx` | 3-5 h | Moyen (impact sur le rythme de combat — rejouer une campagne pour valider) |
| 2 | **Ajouter Vitest** + suite de non-régression (résolveur, statuts, QTE, decks, IA) | `package.json`, `src/engine/*.test.ts` | 4-6 h | Faible |
| 3 | **Trancher le mode Super** : implémenter `super-activate` + `superTurnsLeft`, **ou** les retirer du code et du README | `src/types/index.ts`, `src/engine/actions.ts`, `src/engine/battle.ts`, `src/app/game/page.tsx`, `README.md` | 6-10 h (A) / 2 h (B) | Moyen (A) / Faible (B) |
| 4 | **Brancher les répliques** via `ta()` : tirage aléatoire par catégorie + affichage en overlay | `src/app/game/page.tsx`, `src/components/battle/BattleScene.tsx` | 3-5 h | Faible |

### P2 — par lots

| Lot | Actions | Effort |
|-----|---------|--------|
| Lot 1 — Polish visible | Écran de résultats (statistiques + répliques victoire/défaite) ; traduction du journal de combat | 5-8 h |
| Lot 2 — Cohérence du contenu | `keepPerfectStreak` (implémenter ou retirer) ; rééquilibrage de `superGain` | 2-4 h |
| Lot 3 — Hygiène | Retirer Zustand ; corriger l'arborescence README ; initialiser Git | 1-2 h |

**Effort total estimé :** environ 20-30 h de développement pour traiter l'ensemble des P1 et P2, dont ~12 h pour les 4 écarts bloquants (3-5 h pour `stun`, 4-6 h pour les tests, 2-10 h pour le mode Super, 3-5 h pour les répliques).

---

## 7. Recommandations de process

Constats transversaux issus de l'audit :

1. **Le statut de phase du README est un statut de présence, pas de comportement.** Les 8 phases sont marquées ✅ alors que 4 features documentées ne produisent aucun effet. Le tableau du README (`README.md:80-89`) devrait distinguer « livré » de « livré et fonctionnel », ou renvoyer vers ce rapport.

2. **Les données et les textes ont été écrits avant le moteur qui les consomme.** Le pattern « effets déclaratifs » (documenté dans le README) est excellent pour l'équilibrage, mais il n'a pas de garde-fou : une carte peut déclarer `targetStatuses: [{ id: "stun" }]` et être acceptée par le typechecker sans qu'aucun code ne lise `stun`. Un test de non-régression par statut (§ 6, étape 2) aurait attrapé ce cas.

3. **Les clés i18n orphelines sont un signal précoce fiable.** `battle.stunned` existe dans les deux langues mais n'est référencée nulle part. Un contrôle qui vérifie que chaque clé traduite est utilisée (ou volontairement réservée) aurait signalé le bug `stun` avant l'audit manuel.

4. **Zustand est un signal de dérive d'architecture.** La dépendance est installée et annoncée dans la stack, mais le state est en `useState` local. C'est le genre de résidu qui s'accumule et qui rend l'état global non fiable.

---

## Annexe A — Méthode de vérification

**Commandes exécutées (résultats)**

| Vérification | Commande | Résultat |
|--------------|----------|----------|
| Typage | `npx tsc --noEmit` | exit 0 — aucune erreur |
| Build | `npm run build` | exit 0 — 15 pages statiques générées |
| Clés i18n | Script Node : parcours récursif des deux dictionnaires | FR 638 / EN 638 — 0 orpheline, 0 vide, 0 divergence de placeholders |
| Répliques | Script Node : extraction des blocs `q.<perso>` | 112 clés FR / 112 EN, 112 références dans `characters.ts`, 0 clé manquante |
| Statuts | Recherche `stun` dans `src/` | 17 occurrences — **aucune lecture** dans le moteur |
| Mode Super | Recherche `superTurnsLeft` | 2 occurrences — type + initialisation à 0, aucune écriture, aucune lecture |
| Répliques | Recherche `ta(` dans `src/app/` et `src/components/` | **0 occurrence** |
| Tests | Recherche `*.test.*` / `*.spec.*` + scripts `package.json` | **0 fichier, 0 script** |
| Zustand | Recherche dans `src/` | 0 occurrence (présente dans `package.json` uniquement) |

**Fichiers audités en profondeur**

`README.md`, `package.json`, `src/types/index.ts`, `src/app/{page.tsx,game/page.tsx,options/page.tsx}`, `src/app/codex/**`, `src/app/records/**`, `src/app/{campaign,coop,deck,online,pvp,select,survival}/**`, `src/data/{campaign,cards,characters,decks,statuses,survival}.ts`, `src/engine/{actions,ai,battle,qte,resolver}.ts`, `src/i18n/{fr,en}.ts`, `src/systems/i18n.tsx`, `src/systems/save.ts`, `src/components/battle/BattleScene.tsx`, `src/components/cards/**`.

**Limites de l'audit**

- Audit **statique** : les comportements multi-étapes (QTE en conditions réelles, co-op à 3, PvP en ligne entre deux navigateurs) n'ont pas été joués manuellement de bout en bout. La validation du correctif `stun` devra donc passer par une partie réelle.
- Aucun test automatisé n'existant dans le dépôt, il n'y avait aucun harnais de référence pour comparer les comportements avant/après correction.
- La signalisation PeerJS a été vérifiée par lecture du code et de la configuration, pas par un test de bout en bout entre deux pairs.
- Le compte de « 8 phases livrées » est une lecture de la structure du code et du README, pas une validation fonctionnelle phase par phase.

---

*Rapport produit dans le cadre d'un audit en lecture seule. Aucun fichier source de ARROWFALL n'a été modifié.*

- **Sauvegarde** : `localStorage["arrowfall_save_v1"]` avec fusion des défauts, validation des bornes (`superGauge` borné à 0-100, `bestPerfectStreak` borné).
- **Build** : `npx tsc --noEmit` → exit 0, aucune erreur de typage. `npm run build` → exit 0, 15 pages statiques générées.
- **Aucun asset binaire** : SVG, Canvas et Web Audio générés en code, conformément au README.
