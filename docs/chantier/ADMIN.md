# Guide d'administration

Le tableau de bord est réservé aux comptes administrateurs : chaque action est revérifiée par le
serveur et inscrite dans l'historique (auteur, date, avant, après, motif).

## Corriger le nom d'un participant (Participants)

1. Tableau de bord → **Participants** → ligne du participant → **Nom**.
2. Saisir le NOM et le prénom exacts, et un motif (« saisie fautive confirmée »).
3. L'aperçu montre l'affichage final (« PROSPER Kévin ») et ce qui sera mis à jour : créneaux, places
   repas, équipes. Dossard, inscriptions et paiements ne changent pas. Les factures et Stripe ne sont
   jamais modifiés.
4. Si un autre administrateur a modifié la fiche entre-temps, la correction est refusée : rechargez.

**Historique** (icône horloge) : toutes les modifications de la fiche.
**Retirer** : sort le participant des listes sans rien effacer (ex. retiré du planning).
**Doublons possibles** : affichés en haut de page, jamais fusionnés automatiquement.

Les créneaux réservés avant ce système apparaissent dans un encadré orange : ils seront corrigeables
après la migration de l'édition.

## Dossards

**Dossard** sur une ligne de participant ou d'équipe. Un numéro est unique dans l'édition, individuels
et équipes confondus. Un numéro déjà porté est refusé : retirez-le d'abord à son porteur (champ vide).

## Équipes Pizza Due

Section **Équipes** : statut complète / incomplète. **Équipiers** permet de choisir les membres, ou de
créer l'équipier manquant (« Créer et ajouter à l'équipe »). Le créneau, le paiement et le dossard de
l'équipe ne changent pas : il n'y a jamais de second passage.

## Repas

Tableau de bord → **Repas**.

- **Commandes** : une carte par paiement, avec l'acheteur, la date, la référence Stripe, la facture et
  les places numérotées. Une place sans nom reste « à compléter ». Pour une commande ancienne, utilisez
  « Créer les places pour compléter les noms et pointer », puis **Nom** sur chaque place.
- **Feuille de pointage** : une ligne par place payée, avec une case à cocher. Elle s'imprime
  (**Imprimer**) ou s'exporte en CSV. Les commandes remboursées ou non payées n'y figurent pas.
- **Points à vérifier** : places sans nom, commandes remboursées, sessions Stripe enregistrées deux fois
  (comptées une seule fois, jamais supprimées).

## Règlements (Catégories → Règlement)

1. Rédiger le texte dans les quatre langues : FR (référence, obligatoire), EN, ES, IT. Format :
   « ## » pour un intertitre, « - » pour une liste, une ligne vide pour un nouveau paragraphe. Aucun
   HTML n'est interprété.
2. **Aperçu**. Les langues manquantes sont signalées : le Booking affichera alors le texte français en
   l'annonçant au candidat.
3. **Enregistrer le brouillon** : il n'est pas visible des candidats.
4. **Publier la version N** : les nouvelles réservations devront l'accepter. Les acceptations passées
   restent liées à leur version.

**Préremplir depuis le site** reprend le règlement actuel de la page Règlement, comme base à relire.

Paramètres de l'édition → **Exiger l'acceptation du règlement de chaque catégorie** : sans règlement
publié, une catégorie n'est alors plus réservable. Les inscriptions déjà confirmées ne sont pas
touchées.

## Éditions (Paramètres → Éditions)

- **Préparer une nouvelle édition à partir de celle-ci** :
  - indiquer le nom, l'année et les dates ;
  - choisir, pour chaque journée, sa nouvelle date (vide = pas de créneaux) ;
  - relire ce qui est copié et ce qui ne l'est jamais.

  L'édition est créée **en brouillon**, avec les prix « repris — à vérifier » et les règlements à
  republier.
- **Comparer avec une autre édition** : diagnostic, avec une checklist, puis réparation sélective.
  Celle-ci ajoute les catégories manquantes (inactives, prix à vérifier) et corrige les packs liés à
  l'autre édition. Elle n'écrase jamais rien.
- **Statut** : Brouillon → Inscriptions ouvertes → Inscriptions closes → Terminé → Archivé. Archiver
  ferme les ventes et retire l'édition du Booking. Historique, factures, exports et résultats sont
  conservés, et les paiements tardifs et les remboursements continuent d'être traités.

## Résultats

Tableau de bord → **Résultats** (édition close ou terminée).

1. Importer une feuille CSV (Rang ; Dossard ; Nom ; Points ; Statut) ou, pour 2026, les classements
   publiés. Tout arrive **en brouillon**.
2. Ouvrir la catégorie. Seuls les rapprochements par dossard sont automatiques. Un nom différent, un
   dossard inconnu ou un nom ambigu sont **bloquants** jusqu'à confirmation.
3. **Valider**, relire l'aperçu du podium, puis **Publier**. Une correction ultérieure crée une
   nouvelle version, et l'ancienne est conservée.
4. **Exports** : classement complet, podium et top 10 (s'il y a au moins dix classés), avec les noms
   corrigés.
