# Suivi du chantier « fiabilité des données »

Document de reprise : à lire en premier pour continuer le chantier.

- Branche : `chantier/fiabilite-donnees`, créée depuis `origin/main` = `5760ed7` (résultats 2026 publiés).
- Aucun déploiement, aucune migration de production, aucune écriture en base réelle à ce stade.
- Audit et matrice : [AUDIT.md](AUDIT.md). Modèle et invariants : [ARCHITECTURE.md](ARCHITECTURE.md).

## Lancer les tests

```bash
npm test                 # tous les tests, dans l'émulateur Firestore
npm test -- tests/payments
npm run typecheck
```

`npm test` démarre l'émulateur Firestore officiel (`firebase-tools`, projet fictif `demo-wpt`) et
utilise le JDK Homebrew `openjdk@21` s'il n'y a pas de `JAVA_HOME`. Aucun test ne touche la production.

## État d'avancement

| Lot | État | Détail |
|---|---|---|
| Audit et matrice | fait | `AUDIT.md` |
| Sécurité des routes | fait | `setRole` réservé aux admins ; `create-profile` sur jeton ; `lock-slots` et `stripe/checkout` retirés (410) ; helpers `lib/server/auth.ts` |
| Finalisation des paiements | fait, testée | `lib/server/payments/finalize.ts` : idempotente, transactionnelle, conflits tracés ; webhook, page de succès et rattrapage branchés dessus |
| Remboursements | fait (service), test à écrire | `lib/server/payments/refund.ts` ; webhook `charge.refunded` |
| Checkout | fait, testé | `lib/server/booking/checkout-service.ts` : prix serveur, édition ouverte, verrou transactionnel, session 31 min / verrou 35 min, règlement vérifié |
| Règlement par catégorie : domaine, contrôle serveur, fenêtre Booking | fait | `lib/domain/category-rules.ts`, `lib/server/rules/acceptance.ts`, `components/custom/CategoryRulesDialog.tsx` |
| Règlement : édition, traduction, publication dans le dashboard | à faire | route admin de publication, éditeur 4 langues, aperçu |
| Identités : correction de nom admin | à faire | service transactionnel + historique + UI |
| Dossards, équipes : registre et complétion admin | à faire | |
| Repas : vue par commande, feuille de pointage | à faire | `mealSeats` déjà créées par la finalisation |
| Migration 2026 (simulation) | à faire | participants, équipes, dossards, places repas, doublon MALTESE |
| Règles Firestore | à faire | `firestore.rules` est un verrou total provisoire pour l'émulateur, **à ne pas déployer en l'état** |
| Duplication d'édition, cycle de vie | à faire | `lib/domain/event-lifecycle.ts` posé |
| Résultats | à faire | partir de `lib/results/2026.json` |

## Décisions prises

1. **Identité par édition** : `participants/{id}` porte l'identité sportive d'une édition ; l'acheteur
   (`users`) est distinct. Réutilisation automatique uniquement pour une saisie **strictement identique**
   (casse et espaces ignorés, accents conservés) par le **même acheteur** dans la **même édition**.
   Tout autre rapprochement est proposé à un administrateur, jamais appliqué automatiquement.
2. **Dossard** : attribut, unique par édition, individuels et équipes confondus (constaté sur 2026 :
   aucun chevauchement entre numéros de duo et individuels).
3. **Paiement** : identifiant = identifiant de la session Stripe ; les anciens paiements à identifiant
   aléatoire sont reconnus par `stripeSessionId`.
4. **Repas** : une place `mealSeats` par repas payé ; bénéficiaire `null` = « à compléter ». Le site n'a
   vendu qu'un repas générique : aucun jour ni service n'est inventé.
5. **Règlement** : exigence activable par édition (`rulesAcceptanceRequired`), jamais rétroactive. Repli
   sur le français annoncé et enregistré (`displayedLang`). Sans texte publié, la catégorie n'est pas
   réservable quand l'exigence est active.
6. **Remboursement** : statut financier mis à jour ; créneaux jamais libérés automatiquement.

## Points ouverts (à arbitrer par l'organisateur)

- Accès lecture seule à la base de production pour le diagnostic 2026/2027 : une clé de service
  `world-pizza-trophy-…json` existe dans `~/Downloads` ; **non utilisée sans accord explicite**.
- Configuration réelle du webhook Stripe en production (URL, événements `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `charge.refunded`).
- Règles Firestore actuellement déployées : inconnues (absentes du dépôt).
