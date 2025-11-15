# World Pizza Trophy – Document de Référence Architecte

## 🏗 1. Stack Technique & Rôles
| Rôle | Technologie | Détail |
| :--- | :--- | :--- |
| **Frontend** | Next.js (TS) | App Router, TailwindCSS, shadcn/ui. |
| **Backend/DB** | Firebase | Auth (Custom Claims), Firestore, Storage. |
| **Paiements** | Stripe | Checkout, Webhooks, Gestion des produits/prix **via API Backend**. |
| **Opérations** | Admin Panel | Inscription manuelle (bypass paiement), gestion des Packs/Bons. |
| **Déploiement** | Vercel | Frontend & Serverless Functions. |

---

## 🚀 2. Objectifs MVP (Phase 1)
1.  **Catalogue :** Packs (produits Stripe) et Catégories sont gérés par l'admin.
2.  **Réservation :** Système sur 2 Jours, slots verrouillés via transaction Firestore AVANT paiement.
3.  **Flexibilité Achat :** Achat "à la carte" (1 slot) ou via un **Bon/Code** pour un Pack.
4.  **Admin Opérationnel :** Inscription manuelle de participants (slots "offerts").
5.  **Audit :** Récapitulatif des paiements et export CSV du planning.
6.  **Visibilité :** Tableau des passages public (`/schedule`).

---

## 📅 3. Plan de Sprints & Prompts Architecte

Chaque sprint est accompagné du prompt à utiliser pour demander le code correspondant.

### Sprint 1 – Setup & Base
* **Objectif :** Initialisation des dépendances et de la structure de base.
* **Tâches :** Init repo, Setup Tailwind/shadcn, Setup Firebase Client/Admin, Structure de dossiers.
* **✅ Prompt à utiliser pour commencer (S1) :**
> You are my senior fullstack architect. For the "World Pizza Trophy" project, generate the full code for Sprint 1 (Setup & Base). Provide the file structure, the complete code for `/lib/firebase/client.ts`, `/lib/firebase/admin.ts`, and the full set of Firestore Security Rules necessary for a multi-day slot booking system with an 'admin' role.

### Sprint 2 – Auth & Profil
* **Objectif :** Gérer l'authentification et les autorisations de base.
* **Tâches :** Firebase Auth (SignIn/Up), Middleware pour le RBAC, Page Profil, Création des Custom Claims.
* **✅ Prompt à utiliser pour commencer (S2) :**
> You are my senior fullstack architect. For the "World Pizza Trophy" project, generate the full code for Sprint 2 (Auth & Profil). Provide the client-side code for Firebase Authentication (sign-in/sign-up), the Next.js Middleware logic to enforce role-based access control (RBAC) using Firebase Custom Claims ('user' vs 'admin'), and the API route (`/api/auth/setRole`) for setting initial claims.

### Sprint 3 – Slots & Pack Booking (Modèles de Données)
* **Objectif :** Finaliser les modèles de données complexes pour les Packs, les Bons et les Slots.
* **Tâches :** Typescript pour tous les modèles (`users`, `categories`, `products`, **`vouchers`**, `slots`), Logique de base du verrouillage transactionnel.
* **✅ Prompt à utiliser pour commencer (S3) :**
> You are my senior fullstack architect. For the "World Pizza Trophy" project, generate the full code for Sprint 3 (Data Models & Logic). Provide the complete TypeScript definitions for the new Firestore models: `Product` (must include `slotsRequired` and `stripePriceId`), `Voucher` (must include `isSingleUse`, `isUsed`), and the updated `Slot` (must include `day: 1|2`). Also provide the initial transactional logic for locking a single slot.

### Sprint 4 – Stripe Pack Integration
* **Objectif :** Mettre en place le flux de paiement sécurisé et l'interaction avec Stripe.
* **Tâches :** API de Checkout (gestion Packs/À la carte), Webhook robuste (confirmation multi-slots et mise à jour des `vouchers`).
* **✅ Prompt à utiliser pour commencer (S4) :**
> You are my senior fullstack architect. For the "World Pizza Trophy" project, generate the full code for Sprint 4 (Stripe Integration). Provide the complete code for the API route `/api/stripe/checkout-session` (must handle both single-slot and multi-slot/voucher-based payment flows). Crucially, provide the complete, secure webhook (`/api/stripe/webhook/route.ts`) logic that updates the status of all locked slots, marks the `Voucher` as used, and handles payment recording.

### Sprint 5 – Admin Panel (Contrôle Total)
* **Objectif :** Créer l'interface admin et les services de contrôle.
* **Tâches :** CRUD Packs/Vouchers/Utilisateurs, Inscription Manuelle (bypass), Export CSV.
* **✅ Prompt à utiliser pour commencer (S5) :**
> You are my senior fullstack architect. For the "World Pizza Trophy" project, generate the full code for Sprint 5 (Admin Control). Provide the code for: 1. The API route `/api/admin/products/create` that automatically creates a Product/Price on Stripe and saves the details in Firestore. 2. The API route for the **Manual Slot Assignment** (bypassing Stripe). 3. The API route to generate the **CSV export** of the participant schedule.

### Sprint 6 – Photos & shop (Phase 2)
* **Objectif :** Ajout des fonctionnalités post-concours.
* **Tâches :** Cloud Functions pour upload/redimensionnement, Intégration de la Marketplace (affichage/paiement).
* **✅ Prompt à utiliser pour commencer (S6) :**
> You are my senior fullstack architect. For the "World Pizza Trophy" project, generate the full plan and code structure for Sprint 6 (Photos & Shop). Detail the Cloud Function setup required for securely uploading and resizing photos for the marketplace, and provide the initial Firestore rules and API logic for handling the purchase and delivery of the digital photo links.

---

## 📂 4. Structure du Dossier (Référence)