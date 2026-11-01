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

## Lot 2 (reprise coordonnée, 1er novembre 2026) — terminé

| Lot | Commit |
|---|---|
| FARINA Gennaro Super Champion 4631 points (JSON, provenance, transcriptions locales) ; choix manuels de résultats revalidés côté serveur (type, catégorie, retrait, doublons, structure) | `4910a20` |
| Attribution manuelle serveur (fiche créneau, Utilisateurs, matrice) : duo saisi en entier dès l'attribution, transaction, idempotence, « payé » seulement rattaché à un paiement réel | `fc35778` |
| Statut d'édition par route serveur tracée, transitions et prérequis d'ouverture, règles Firestore (statut non modifiable par le navigateur) | `f0733a2` |
| Page publique des résultats sur les classements publiés, repli 2026 par catégorie ; historique du compte | `346a1cb` |
| Export Repas aligné sur la page Repas | `bf43835` |
| Nom et prénom demandés à l'inscription par email (Google inchangé) | `31a3295` |
| Booking et page de succès traduits fr/en/es/it, messages serveur localisés | `642dcfa` |

109 tests verts (15 fichiers) dans l'émulateur ; `npm run typecheck` sans erreur.

## Restant à faire

1. **Vérification de build** du lot 2 dans un worktree propre (la dernière vérification date du lot 1,
   commit `084f51c`) et contrôle visuel du Booking traduit et des fenêtres d'attribution au navigateur.
2. Page Compte (hors historique) et page Règlement : textes encore en français.
3. Diagnostic et migration 2026 sur la base réelle, arbitrages historiques (voir ci-dessous) : en
   attente d'accès et de validation, sans bloquer le code.

## Actions de production à valider par l'organisateur (dans cet ordre)

1. Relire et fusionner la branche, déployer le code (Vercel).
2. Stripe : webhook vers `/api/stripe/webhook` avec `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` et `charge.refunded` ; vérifier le secret.
3. Déployer `firestore.rules` (**après** le code : le Booking lit désormais les créneaux par l'API,
   le statut d'édition et les attributions passent par le serveur).
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
- Index composites Firestore possiblement demandés en production : `resultSets` (`eventId` + `isPublished`),
  `categories`/`products` (`eventId` + `priceReview`).

## Revue Codex après le lot 2

- Correction des prérequis de compilation Next.js 16 : route de redirection `/` déplacée dans un groupe avec son propre layout racine, sans modifier les layouts des pages linguistiques ; `params` asynchrone sur accueil, éditions et galerie.
- Build webpack de production réussi sur une copie isolée des fichiers suivis avec configuration factice (aucune connexion à la production). Le repli des résultats a été utilisé lors de l’indisponibilité de l’émulateur.
- Une relance indépendante de la suite a donné 108/109 : le test de concurrence d’attribution a reçu une erreur native Firestore au lieu de l’erreur métier attendue. Les 10 tests ciblés d’attribution ont ensuite passé. Une autre relance complète a rencontré un délai dépassé sur le double clic (durée observée très supérieure au timeout, possiblement liée à la suspension de la machine ; cause non établie). Ne pas présenter ces relances comme toutes vertes : stabiliser et confirmer avant le mail « prêt à pousser ».
- Aucun push, déploiement ou changement de base réelle. Compte et page Règlement hors nouveaux composants restent partiellement français, comme signalé par Claude.

Dernière vérification indépendante : `caffeinate -i npm test` → **109/109 tests, 15 fichiers, 29,66 s**, sans erreur. L’exécution maintenue éveillée a passé, y compris concurrence et double clic ; les échecs intermittents précédents restent documentés, leur cause n’est pas établie. Le contrôle visuel final du lot 2 n’a pas été fait : Mac verrouillé au moment de la revue. La validation de l’organisateur avant push doit tenir compte de cette limite. Aucun accès à la production.
