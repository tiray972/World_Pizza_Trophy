# Architecture et invariants — fiabilité des données

## Principe général

Le navigateur affiche et demande ; le serveur décide. Toute écriture qui touche l'argent, une identité,
un dossard, un repas, un règlement publié, un résultat ou une édition passe par une route serveur
(`app/api/admin/**`, `app/api/booking/**`, `app/api/stripe/webhook`) qui vérifie le jeton Firebase et le
rôle (`lib/server/auth.ts`), puis appelle un service transactionnel testable dans l'émulateur
(`lib/server/**`). Les règles Firestore (`firestore.rules`) interdisent ces écritures au navigateur.

```
Booking ──► /api/booking/checkout ──► prepareCheckout (transaction : prix, édition, verrous, règlement)
                                     └► Stripe Checkout (31 min)
Stripe ──► /api/stripe/webhook ─┐
Succès ──► /api/booking/record-payment ─┼► finalizeCheckoutSession (transaction unique, idempotente)
Rattrapage ► unlock-expired-slots ─┘        ├ payments/{sessionId}
                                             ├ participants, teams (identités)
                                             ├ slots (payés, participantIds)
                                             ├ mealSeats (une place par repas)
                                             └ ruleAcceptances
Dashboard ──► /api/admin/* ──► services (renommage, dossards, équipes, repas, règlements, éditions, résultats)
```

## Collections

| Collection | Rôle | Écrite par |
|---|---|---|
| `events` | Édition : statut `draft → open → closed → completed → archived`, `rulesAcceptanceRequired`, `copiedFrom`, `review` | dashboard (admin), duplication |
| `categories` | Configuration ; `rulesI18n.draft` / `rulesI18n.published` ; `nameI18n` ; `priceReview` | dashboard (admin) sauf règlements : serveur |
| `ruleVersions/{categoryId}_v{n}` | Version publiée immuable du règlement | serveur |
| `ruleAcceptances/{sessionId}_{categoryId}` | Acceptation : catégorie, version, langue demandée / présentée, acteur (acheteur), paiement, participants | finalisation |
| `slots` | Créneau ; `participantIds`, `teamId`, copies d'affichage `participants[]`, `pendingBookingId` pendant le paiement | serveur ; dashboard (admin) pour la configuration |
| `pendingBookings` | Commande en attente (charge utile, acceptations), statut `pending/paid/failed/expired` | serveur |
| `payments/{sessionId}` | Paiement (anciens : identifiant aléatoire + `stripeSessionId`) ; `slotConflicts`, `needsReview`, `mealSeatIds`, `amountRefunded` | serveur |
| `participants` | Identité sportive par édition, distincte de l'acheteur ; `bib`, `version`, `withdrawn`, `enteredAs` | serveur |
| `teams` | Équipe (duo) : un créneau, un dossard, un résultat ; `memberIds`, `status` complète / incomplète, `displayName` publié | serveur |
| `bibs/{eventId}_{n}` | Registre d'unicité des dossards (individuels et équipes confondus) | serveur |
| `mealSeats/{paymentId}_m{n}` | Une place par repas payé : bénéficiaire ou `null` (à compléter), statut financier, pointage | serveur |
| `resultSets/{eventId}_{catégorie}` | Résultats : `draft` → `validated` → `published` ; `isPublished` reste vrai pendant une correction | serveur |
| `resultRevisions` | Versions publiées remplacées (traçabilité des corrections) | serveur |
| `auditLogs` | Qui, quand, avant, après, motif | serveur |
| `paymentIncidents` | Paiement à traiter : charge utile perdue, conflit de créneau, remboursement sans paiement | serveur |
| `duplicationRequests`, `migrations` | Idempotence des duplications et migrations | serveur |

## Invariants (chacun couvert par un test)

1. **Une session Stripe = un paiement**, quel que soit le nombre ou l'ordre des appels
   (`tests/payments/finalize.test.ts`, appels simultanés compris).
2. **Un créneau attribué n'est jamais écrasé** par un paiement tardif : conflit enregistré, paiement
   « à vérifier ». Le verrou (35 min) survit à la session Stripe (31 min).
3. **Le prix vient de la base**, jamais du navigateur ; un écart affiché est refusé (`price_changed`).
4. **Pas de réservation hors édition ouverte** ; une session déjà payée est toujours finalisée, même
   archivée.
5. **Identité stable** : le nom se corrige sans changer l'identifiant, les inscriptions, le dossard ni
   le paiement ; versionné (modification concurrente refusée) et historisé. Aucune fusion sur
   ressemblance de nom.
6. **Dossard unique par édition**, attribut et non clé ; aucune réattribution silencieuse.
7. **Duo = une équipe** : un créneau, un paiement, un dossard, un résultat, visible pour chaque membre.
8. **Un repas payé = une place**, nommée ou « à compléter » ; jamais dédoublonnée sur un nom ; une
   session enregistrée deux fois n'est comptée qu'une fois (rien n'est supprimé).
9. **Règlement** : seule la version publiée est montrée ; acceptation explicite liée à la version et à
   la langue réellement présentée ; vérifiée au paiement ; exigence activable par édition, jamais
   rétroactive.
10. **Duplication** : configuration seulement, nouveaux identifiants, liens remappés, brouillon, prix
    à vérifier, créneaux libres aux dates choisies en heure de Paris ; idempotente.
11. **Résultats** : jamais publiés automatiquement ; ordre officiel conservé ; statuts ≠ dernière place ;
    noms publics résolus depuis les identités.
12. **Archiver n'est pas supprimer** ; une pièce comptable n'est jamais réécrite par une correction sportive.

## Compatibilité avec les données historiques

- Les créneaux gardent `participant` / `participants` (copies d'affichage) : les exports, programmes,
  emails et le compte participant existants continuent de fonctionner, et lisent désormais les noms
  corrigés.
- Les paiements à identifiant aléatoire sont reconnus par `stripeSessionId`.
- Les repas historiques sont reconstitués en lecture depuis `payment.metadata.mealGuests`, puis
  matérialisés à la demande (commande par commande) ou par la migration.
- Les créneaux sans `participantIds` sont signalés dans la page Participants jusqu'à la migration de
  l'édition (`scripts/migrations/identities.ts`).
