# World Pizza Trophy – Roadmap Technique & Setup

## 🏗 1. Choix du stack
- Frontend : Next.js (App Router, Typescript, shadcn/ui, TailwindCSS)
- Backend : Firebase (Auth, Firestore, Cloud Functions, Storage)
- Paiements : Stripe Checkout
- Upload photos : Firebase Storage + Cloud Functions
- Emails transactionnels : Resend ou Firebase Extensions
- Déploiement : Vercel

---

## 🚀 2. Objectifs MVP (phase 1)
1. Landing page vitrine (FR / EN)
2. Compte utilisateur (Auth)
3. Formulaire d’inscription
4. Sélection d’une ou plusieurs catégories
5. Réservation créneau horaire (slot booking)
6. Paiement Stripe obligatoire pour valider la réservation
7. Dashboard utilisateur
8. Dashboard admin (secured)
9. Data en temps réel (Firebase)

---

## 📅 3. Sprint Plan
### Sprint 1 – Setup & Base
- Init repo Next.js
- Setup Tailwind + shadcn/ui
- Setup Firebase SDK + env config
- Structure dossiers (domain-driven)

### Sprint 2 – Auth & Profil
- Firebase Auth + middleware
- Page profil + completion champ
- Formulaire catégories

### Sprint 3 – Slots booking
- Modèle Firestore collections
- UI sélecteur créneau (calendar style)
- Vérrouillage transactionnel Firestore

### Sprint 4 – Stripe Integration
- Checkout Session
- Webhooks validation
- Liaison paiement <-> réservation

### Sprint 5 – Admin Panel
- Roles via Custom Claims
- CRUD participants + slots
- Export CSV + stats

### Sprint 6 – Photos & shop (Phase 2)
- Upload photos par admin
- Marketplace (tag par candidat)
- Paiement + délivrance via cloud link

---

## 📂 4. Structure du dossier
