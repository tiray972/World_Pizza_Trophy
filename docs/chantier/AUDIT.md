# Audit World Pizza Trophy — fiabilité des données (novembre 2026)

Audit réalisé le 1er novembre 2026 sur le code de `origin/main` (`5760ed7`), branche de travail
`chantier/fiabilite-donnees`. Sources de preuve : code du dépôt, traces locales de `tmp/` (instantanés
Google Sheets des plannings imprimés) et exports du dashboard présents dans `~/Downloads`
(`WPT_2026_Repas (1).csv`, `WPT_2026_Financial_Detail.csv`, `WPT_2026_Financial_Summary.csv`, téléchargés
le 28/10/2026). **Aucune lecture de la base de production** : aucun accès n'est configuré dans le projet
(pas de `.env`, pas de clé de service dans le dépôt).

Légende : **V** = vérifié (code ou donnée cités) · **P** = probable (mécanisme vérifié, occurrence en
production non prouvée) · **I** = inconnu (nécessite la base ou la configuration de production).

## 1. Constats transverses

| # | Constat | Statut | Preuve |
|---|---|---|---|
| T1 | `POST /api/auth/setRole` attribue n'importe quel rôle (y compris `admin`) à n'importe quel compte, **sans authentification**. | V | `app/api/auth/setRole/route.ts` |
| T2 | Le dashboard n'a aucun garde : ni connexion, ni rôle. Toutes ses écritures passent par le SDK client ; la seule barrière possible est la configuration des règles Firestore, **absente du dépôt**. | V (code) / I (règles déployées) | `app/[lang]/dashboard/page.tsx`, `useFirebase.ts` ; aucun `firestore.rules` |
| T3 | L'auteur des actions admin est enregistré sous la valeur fictive `'admin_current'` : aucune traçabilité réelle. | V | `SlotsPage.tsx:156`, `UsersPage.tsx:57`, `useFirebase.ts:433,484` |
| T4 | Les pages publiques Booking et Règlement lisent **tous** les documents `slots`, qui contiennent nom, email, téléphone et taille des participants. Si les règles le permettent (nécessaire au Booking hors connexion), ces données personnelles sont lisibles par tout visiteur. | P | `booking/page.tsx:131`, `rules/page.tsx:47`, champs `participant(s)` des slots |
| T5 | Le checkout reprend le montant (`totalAmount`) et le prix du repas (`mealPrice`) **envoyés par le navigateur** ; seul le pack est recalculé côté serveur. | V | `app/api/booking/checkout/route.ts` (calcul `slotsCost`) |
| T6 | Le checkout et le checkout pack ne vérifient ni l'identité de l'appelant (`userId` libre), ni le statut de l'événement, ni l'appartenance des créneaux à l'événement, ni l'activité de la catégorie : un appel direct peut réserver sur une édition close ou archivée. | V | mêmes routes |
| T7 | `POST /api/booking/lock-slots` verrouille n'importe quel créneau (même payé) pour n'importe qui, sans contrôle d'état ni d'identité. | V | `app/api/booking/lock-slots/route.ts` |
| T8 | `POST /api/booking/unlock-expired-slots` est public ; il appelle `record-payment` via HTTP. | V | route |
| T9 | Ancienne route `POST /api/stripe/checkout` (price id libre, `customer_email: userId`) toujours exposée et inutilisée. | V | `app/api/stripe/checkout/route.ts` |
| T10 | L'inscription par email envoie un prénom vide : le profil est créé avec le prénom `User`. Les acheteurs « User » des exports viennent de là. | V | `RegisterForm.tsx:50`, `create-profile/route.ts:38` ; 1 acheteur « User » dans `Financial_Summary` |
| T11 | Le Booking est entièrement rédigé en dur en français alors qu'il est servi en fr/en/es/it. | V | `booking/page.tsx`, `SlotBookingCalendar.tsx` |
| T12 | Aucun framework de test, aucun émulateur configuré. | V | `package.json` |

## 2. Matrice incidents → causes → corrections

| Incident | Cause | Statut | Correction | Migration | Test |
|---|---|---|---|---|---|
| **A. Payé mais absent des listes** | (1) Finalisation exécutée deux fois en parallèle (webhook + page de succès) : contrôle de doublon non transactionnel, identifiant de paiement aléatoire. | V (code) + V (donnée : session `cs_live_b1dadj…` enregistrée 2 fois, total affiché 540 € pour 270 €) | Service unique `finalizeCheckoutSession` transactionnel, id de paiement = id de session, création conditionnelle. | Rapport des paiements en double (même `stripeSessionId`) ; aucun effacement automatique. | `tests/payments/finalize.test.ts` |
| | (2) La finalisation écrase le créneau sans relire son état : si le verrou a expiré et qu'un autre acheteur l'a pris, l'un des deux perd sa place sans alerte. | V (code) | Lecture dans la transaction, conflit enregistré (`slotConflicts`, `needsReview`) au lieu d'écraser. | Rapport des créneaux dont `stripeSessionId` ne correspond à aucun paiement. | idem |
| | (2 bis) Le verrou d'un créneau dure 10 minutes alors qu'une session Stripe reste payable 24 heures : le créneau est libéré puis revendu pendant que le premier acheteur peut encore payer. | V (code) | Session Stripe limitée à 31 min, verrou à 35 min : une session payable garde toujours ses créneaux. | — | `tests/booking/checkout.test.ts` |
| | (2 ter) Deux checkouts simultanés sur un même créneau passent tous les deux : vérification puis écriture hors transaction. | V (code) | Verrouillage transactionnel avant la création de la session Stripe. | — | idem |
| | (3) Le webhook sort sans rien faire et répond 200 si `eventId` est absent, ou si la réservation en attente est introuvable : Stripe ne réessaie pas. | V (code) | Réponse 500 tant que la finalisation n'a pas abouti (Stripe réessaie) ; journal `paymentIncidents`. | — | idem |
| | (4) Un achat composé uniquement de repas n'est jamais rattrapé par `unlock-expired-slots` : aucun créneau verrouillé ne déclenche le rattrapage. | V (code) | Rattrapage par les réservations en attente (`pendingBookings`), pas par les créneaux. | Rapport des `pendingBookings` restées `pending` avec session payée (nécessite Stripe). | idem |
| | (5) Configuration du webhook Stripe en production (URL, événements, secret). | I | À vérifier dans le tableau de bord Stripe. | — | — |
| **B. Noms corrigés dans un export sans effet en base** | Le participant n'est qu'une copie de texte sur chaque créneau (`slot.participants[]`), sans identifiant ; aucune interface ne modifie un nom ; un export est un fichier déconnecté. | V | Entité `participants` + correction admin serveur propagée aux créneaux, équipes, places repas et résultats, avec historique. | Création des entités à partir des créneaux 2026, en simulation d'abord. | `tests/participants/rename.test.ts` |
| **C. Équipier manquant en Pizza Due** | Les trois chemins d'attribution manuelle n'acceptent qu'un participant par créneau (`AssignSlotModal`, `ManualSlotAssignModal`, `offerSlots` : `participants: [participant]`). | V (code) | Équipe explicite (`teams`) avec membres requis, statut incomplet visible, complétion admin. | Création des équipes 2026 ; équipes incomplètes signalées, pas complétées par déduction. | `tests/participants/teams.test.ts` |
| | Plannings imprimés : duo n° 3 sans COTTA Yvan, n° 62 sans POULARD, n° 36 avec MATHIOT seul. | V (donnée `tmp/reprint-data.json`) | idem | Les compléments viennent des résultats officiels publiés, avec validation. | rapport de simulation |
| **D. Dossards confondus ou absents du site** | Aucun dossard en base : ils n'existent que dans les feuilles d'impression. | V | Attribut `bib` sur participant et équipe ; unicité par édition garantie par un registre transactionnel (`bibs/{eventId}_{n}`). | Import du registre 2026 depuis les instantanés de planning et les résultats, sans réattribution. | `tests/participants/bibs.test.ts` |
| | En 2026, numéros de duo et individuels ne se chevauchent pas, aucun numéro n'a deux porteurs. | V (donnée) | Périmètre d'unicité retenu : **l'édition**, individuels et équipes confondus. | — | idem |
| **E. Repas payés absents du pointage** | Repas stockés uniquement en JSON texte dans `payment.metadata.mealGuests`, sans entité ni statut. Export non filtré sur le statut du paiement. | V | Entité `mealSeats` : une place par repas payé, bénéficiaire nommable, statut financier, pointage. | Matérialisation des places depuis les paiements 2026, doublons de session isolés. | `tests/meals/seats.test.ts` |
| | Cause du cas MALTESE : le paiement en double (incident A1) produit deux lignes de repas. Montant par créneau 120 € = (270 − 30) / 2 : **un seul repas** acquitté. | V (donnée) | idem A1 | Ligne en double exclue après validation, sans toucher à Stripe. | rapport |
| | Repas des acheteurs dont la finalisation n'a jamais eu lieu (A3/A4). | P | idem A | Rapport Stripe ↔ base (nécessite la clé Stripe). | — |
| **F. Commandes multi-repas difficiles à retrouver** | L'export repas affiche une ligne par invité, avec le nom de l'acheteur et sans regroupement par commande ; un acheteur « User » est introuvable (T10). | V | Vue par commande (quantité, statut, référence, bénéficiaires, places à compléter) et feuille de pointage par place. | — | `tests/meals/export.test.ts` |
| | FAGNANI : 3 places sous le même nom. | V (donnée) | Conservées comme 3 places, 2 bénéficiaires « à compléter » à confirmer par l'organisateur. | Aucune fusion. | rapport |
| **C bis. Duo dans un pack** | Le paiement d'un pack n'envoie que le premier participant de chaque créneau (`booking/page.tsx`, `participant: slot.participant`). | V (code) | Tous les participants transmis. | — | `tests/booking/checkout.test.ts` (duo) |
| **G. Création manuelle et annulation** | Attribution manuelle : statut `paid` déduit du fait que l'utilisateur a payé *autre chose* (`registrations[eventId].paid`) ; aucune relecture transactionnelle (`SlotsPage`, `UsersPage`). | V | Attribution serveur transactionnelle ; « payé » réservé à un paiement réel. | Rapport des créneaux `paid` sans paiement associé. | — |
| | Remboursement Stripe : `charge.refunded` est ignoré (TODO). Aucune annulation n'existe. | V | Statut `refunded` propagé au paiement et aux places repas ; créneaux non libérés automatiquement (décision admin). | — | `tests/payments/refund.test.ts` |
| **H. Règlement par catégorie** | `Category.rules` est un texte unique et monolingue, édité dans le dashboard mais **jamais affiché dans le Booking**. La page `/rules` utilise un second texte, statique, dans les dictionnaires (4 langues). | V | Règlement versionné en 4 langues dans la catégorie, brouillon / publié, acceptation avant les créneaux, contrôle serveur. | Brouillons initialisés depuis les dictionnaires, publication manuelle. | `tests/rules/*.test.ts` |
| **I. Duplication d'édition** | Copie depuis `categories`/`products` du **seul événement affiché** (copie vide sinon) ; oublie `participantsPerSlot` (le duo devient individuel), `mealsIncluded`, `excludedCategoryIds` ; aucun créneau ; aucune idempotence (double clic = deux éditions). | V | Duplication serveur atomique, idempotente, avec remappage et récapitulatif. | Diagnostic 2026/2027 en lecture seule. | `tests/events/duplicate.test.ts` |
| **J. Archivage** | `archived` ne bloque que l'attribution dans une page du dashboard ; le serveur ne bloque rien. Le Booking ne liste que `open`. | V | Garde serveur par statut ; finalisation des paiements tardifs conservée. | — | `tests/events/lifecycle.test.ts` |
| **K. Résultats** | Instantané JSON versionné, sans lien avec les participants ni gestion admin. | V | Gestion des résultats reliée aux participants et aux équipes, brouillon / validé / publié. | Import de `lib/results/2026.json` en brouillon. | `tests/results/*.test.ts` |

## 3. Cas nominatifs

| Cas | Constat | Traitement prévu |
|---|---|---|
| PROSPÉRITÉ → PROSPER Kévin, n° 11 | Les plannings imprimés portent déjà `PROSPER Kévin` n° 11 ; la base contient encore probablement la saisie fautive (I). | Correction tracée sur l'entité participant après migration. |
| ZARI Faysal → ZARI Fayzal, n° 60 | Plannings : `ZARI Fayzal` n° 60. | idem |
| ROCLE Richard | Absent des plannings imprimés. | Jamais recréé depuis un CSV ; traces financières conservées ; signalé dans le rapport de migration s'il existe un créneau actif. |
| POUVREAU Sébastien n° 63, COLONNA Giulia n° 64 | Absents des plannings, présents dans les résultats. | Participants créés « ajout tardif » au moment de l'import des résultats, après validation. |
| SCARIATO Flavio, SERRA Florent | Corrections de planning ; plusieurs versions des feuilles dans `tmp/` (`print-data`, `reprint-data`, `corrected-pages`, `tuesday/wednesday-current`, `calzone-28-update`). | La migration compare les versions et liste les différences ; aucune version choisie automatiquement. |
| MALTESE Giovanni | Paiement enregistré deux fois (même session). | Isolé dans le rapport ; suppression du doublon uniquement après validation. |
| FAGNANI Francesco | 3 places au même nom. | 3 places conservées, bénéficiaires à préciser. |

## 4. Diagnostic des documents de référence 2026 (sans accès à la base)

Exécuté le 1er novembre 2026 par `scripts/migrations/diagnose-references-2026.ts` sur les six
instantanés de planning de `tmp/` et sur `lib/results/2026.json`. Lecture seule.

- Plannings : un dossard par personne, aucun numéro porté par deux personnes, aucun chevauchement
  entre numéros de duo et individuels (**V**). Neuf duos au planning, dont trois à un seul nom :
  n° 3 FARGUES Léo, n° 36 MATHIOT Maxime, n° 62 FARINA Gennaro.
- Exports du 28/10 : la base contient encore `Kevin Prospérité` (5 créneaux) et `Faysal Zari`
  (1 créneau) ; Richard ROCLE est inscrit dans un créneau duo avec Alexandre MAZET, alors qu'aucun
  duo MAZET n'existe au planning (**V**, à arbitrer : le n° 36 MATHIOT seul au planning est-il ce créneau ?).
- **Résultats publiés et plannings n'écrivent pas certains noms de la même façon**, pour le même
  numéro (**V**, à arbitrer par l'organisateur avant toute republication) :

| Dossard | Planning (jour J) | Résultats publiés |
|---|---|---|
| 52 | MARTINEZ Guillaume | MARTINNEZ Guillaume |
| 51 | ESPERANZA Lolita | ESPERANZA Loïta |
| 58 | VAZ-VIEIRA Chantal | VAZ VIEIRA Chantal |
| 19 | MARIA Zumbo | ZUMBO Maria (nom et prénom inversés) |
| 12, 16, 26, 56 | RIVIÈRE Romain, BRIANÇON Marine, FOURNIER Félix, CHENEVEZ Benoît | sans accent |

- Le résultat du duo n° 3 donne « FARGUES Léo – COTTA Yvan » : il complète le planning. La
  migration le **propose** (rapport), la complétion se fait dans le dashboard après vérification.

La migration retient le planning comme référence des dossards (document opérationnel issu de la
base) ; les résultats servent de complément et de contrôle. Aucun nom publié n'est modifié
automatiquement.
