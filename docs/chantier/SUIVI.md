# Suivi du chantier « fiabilité des données »

Document de reprise : à lire en premier pour continuer le chantier.

- Branche : `chantier/fiabilite-donnees`, créée depuis `origin/main` = `5760ed7` (résultats 2026
  publiés). **Rien n'est poussé ni déployé.** Aucune écriture en base réelle.
- Audit, matrice et diagnostic des documents 2026 : [AUDIT.md](AUDIT.md).
- Modèle et invariants : [ARCHITECTURE.md](ARCHITECTURE.md). Mode d'emploi : [ADMIN.md](ADMIN.md).

## Lancer les tests et les outils

```bash
npm test                 # 80 tests dans l'émulateur Firestore (projet fictif demo-wpt)
npm run typecheck
npx vite-node --config vitest.config.ts scripts/migrations/diagnose-references-2026.ts   # dossards 2026, sans base
```

`npm test` utilise le JDK Homebrew `openjdk@21` (installé pour ce chantier) et `firebase-tools`.
Site local branché sur l'émulateur : `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST` + `FIRESTORE_EMULATOR_HOST`,
données de démo `scripts/dev/seed-emulator.ts`. Le lien `MEDIAS_WPT` (disque externe non monté) fait
échouer `next build` / `next dev` dans le dossier du projet : faire le build dans un worktree propre.

## État d'avancement (1er novembre 2026)

| Lot | État | Commit |
|---|---|---|
| Audit, matrice, diagnostic documents 2026 | fait | `4ad1f7e`, `f279bda` |
| Sécurité des routes (setRole, create-profile, routes retirées) | fait | `4ad1f7e` |
| Finalisation idempotente des paiements, remboursements, rattrapage repas seuls | fait, testé | `4ad1f7e` |
| Checkout serveur (prix, édition ouverte, verrou transactionnel, session 31 min) | fait, testé | `4ad1f7e` |
| Règlement : fenêtre Booking 4 langues, contrôle serveur | fait, testé, vérifié au navigateur | `4ad1f7e`, `2e1edb0` |
| Règlement : éditeur dashboard, versions, publication | fait, testé | `5d6a441` |
| Identités : correction de nom, dossards, équipes, ajout, retrait | fait, testé | `ec74cf9` |
| Repas : places, commandes, feuille de pointage | fait, testé | `ec74cf9` |
| Migration identités 2026 (simulation + application à empreinte) | fait, testé sur fixture | `f279bda` |
| Règles Firestore + API de disponibilité sans données personnelles | fait, testé | `15ae1a8` |
| Duplication d'édition, comparaison / réparation 2027, garde dashboard | fait, testé | `1a0fa45` |
| Résultats : brouillon / validé / publié, import CSV et 2026, exports | fait, testé | `084f51c` |
| Build de production | passe (worktree propre, variables factices) | — |

## Tests exécutés

80 tests, 11 fichiers, tous verts, sur l'**émulateur Firestore officiel** (transactions et concurrence
réelles, règles de sécurité réelles). Ce qu'ils ne prouvent pas : le comportement de Stripe lui-même
(sessions simulées par `CheckoutSessionSnapshot`), l'envoi d'emails, les index composites de production
(l'émulateur ne les exige pas — les requêtes nouvelles n'utilisent que des index simples, sauf
`resultSets` : `eventId` + `isPublished`, à créer si Firestore le demande), et les données réelles.

Vérifié au navigateur (site local + émulateur) : fenêtre de règlement en fr/en, Échap sans acceptation,
case non précochée, parcours clavier complet, repli linguistique annoncé, catégorie sans règlement
non réservable, panier et acceptation conservés au changement de langue, affichage mobile 375 px.

## Restant à faire (prochaines sessions)

1. **Page publique des résultats** : lire les classements publiés en base (`publicResults`) avec repli
   sur `lib/results/2026.json` tant que rien n'est publié ; historique dans le compte participant
   (`resultsOfParticipant` prêt, interface à faire).
2. **Attribution manuelle de créneaux** (SlotsPage, UsersPage, matrice) : passer par une route serveur
   créant les identités, gérant les duos, sans statut « payé » sans paiement. En attendant, un créneau
   attribué à la main apparaît dans « créneaux sans identité » et la migration peut être relancée.
3. **Statut d'édition** par route serveur tracée (aujourd'hui écrit par le dashboard, transitions
   encadrées dans l'interface).
4. **Booking entièrement traduit** (T11) : seuls la fenêtre de règlement et les noms de catégories le
   sont. Ajouter les traductions des pages Booking et Succès.
5. Ancien export « Repas » de la page Exports : à remplacer par la page Repas (il compte encore les
   doublons de session).
6. Inscription par email : demander nom et prénom (aujourd'hui vides).

## Actions de production à valider par l'organisateur (dans cet ordre)

1. Relire et fusionner la branche, déployer le code (Vercel).
2. Stripe : webhook vers `/api/stripe/webhook` avec `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` et `charge.refunded` ; vérifier le secret.
3. Déployer `firestore.rules` (**après** le code : le Booking lit désormais les créneaux par l'API).
4. Diagnostic 2026 sur la base réelle, en lecture seule :
   `GOOGLE_APPLICATION_CREDENTIALS=<clé> npx vite-node --config vitest.config.ts scripts/migrations/identities.ts -- --event <id 2026> --project world-pizza-trophy`
   → rapport dans `output/migrations/` ; arbitrer les points signalés ; appliquer avec `--apply
   --fingerprint <empreinte> --actor <uid admin>` après sauvegarde (export Firestore).
5. Corriger dans le dashboard ce que la migration signale : équipes incomplètes (FARGUES – COTTA,
   FARINA – POULARD, MAZET – ROCLE / MATHIOT), orthographes à arbitrer.
6. 2027 : Paramètres de 2026 → Comparer avec 2027 → réparation sélective éventuelle → publier les
   règlements → vérifier les prix → activer l'exigence du règlement → ouvrir.
7. Archiver 2026 seulement après ces étapes (conséquences décrites dans ADMIN.md).

## Décisions prises

1. Identité par édition, distincte de l'acheteur ; réutilisation automatique seulement pour une
   saisie strictement identique du même acheteur dans la même édition ; en migration, même nom chez
   plusieurs acheteurs regroupé seulement si un dossard unique du planning le confirme.
2. Dossard unique par édition, individuels et équipes confondus (constaté sur 2026).
3. Plannings imprimés = référence des dossards ; résultats publiés = complément et contrôle.
4. Paiement identifié par la session Stripe ; doublons historiques comptés une fois, jamais supprimés.
5. Repas : une place par repas ; aucun jour ni service inventé (le site vendait un repas générique).
6. Règlement : exigence par édition, repli français annoncé et enregistré.
7. Remboursement : statut financier mis à jour, créneaux jamais libérés automatiquement.
8. Résultats : rapprochement par dossard, noms publics issus des fiches.

## Points ouverts

- Accès lecture seule à la production : une clé de service `world-pizza-trophy-…json` existe dans
  `~/Downloads`, **non utilisée sans accord explicite**.
- Règles Firestore actuellement déployées : inconnues.
- Une requête HTTP 400 vue une fois dans la console du site local (page d'accueil) : non reproduite.
