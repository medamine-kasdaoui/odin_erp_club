# Démarrage rapide Backend — Odin ERP Club

## ✅ Modules implémentés

| Module | Statut | Endpoints |
|--------|--------|-----------|
| **Module 1 : Authentification** | ✅ Complet | `/api/v1/auth`, `/api/v1/users`, `/api/v1/clubs` |
| **Module 2 : Gestion des Effectifs** | ✅ Complet | `/api/v1/players`, `/api/v1/staff`, `/api/v1/teams`, `/api/v1/categories` |
| **Module 6 : Planification & Événements** | ✅ Complet | `/api/v1/events`, `/api/v1/notifications` |

---

## 🚀 Démarrer le serveur

### Prérequis

1. **XAMPP** : Démarrer MySQL dans le Control Panel
2. **Base de données** : `odin_erp_club` doit exister
   - phpMyAdmin → http://localhost/phpmyadmin → Créer DB

### Commandes

```bash
cd c:\Users\majdo\OneDrive\Desktop\backend

# Mode développement (auto-reload)
npm run start:dev

# Build production
npm run build
```

Le serveur démarre sur : `http://localhost:3000/api/v1`

---

## 📊 Structure de la base de données

Les tables sont créées **automatiquement** au premier démarrage (`synchronize: true`).

| Table | Description |
|-------|-------------|
| `clubs` | Clubs de football |
| `users` | Utilisateurs du système |
| `categories` | Catégories d'âge (U15, U17, Seniors...) |
| `teams` | Équipes par club |
| `players` | Joueurs |
| `player_history` | Historique des changements (statut, transfert...) |
| `staff_members` | Staff technique et médical |

---

## 🔌 API Endpoints

### Authentification
```
POST /api/v1/auth/register      — Inscription candidat
POST /api/v1/auth/login         — Connexion
GET  /api/v1/auth/me            — Mon profil (JWT requis)
GET  /api/v1/auth/pending-users — Candidats en attente (JWT)
POST /api/v1/auth/approve/:id   — Approuver candidat (JWT)
POST /api/v1/auth/reject/:id    — Rejeter candidat (JWT)
```

### Module 2 — Gestion des Effectifs (JWT requis pour tous)
```
# Joueurs
GET    /api/v1/players                      — Liste (filtres: status, teamId, position, page, limit)
GET    /api/v1/players/:id                  — Détails
POST   /api/v1/players                      — Créer
PUT    /api/v1/players/:id                  — Modifier
DELETE /api/v1/players/:id                  — Supprimer
PATCH  /api/v1/players/:id/status           — Changer statut
GET    /api/v1/players/:id/history          — Historique
POST   /api/v1/players/:id/assign-team      — Affecter à une équipe

# Staff
GET    /api/v1/staff                        — Liste (filtres: role, teamId, status)
GET    /api/v1/staff/:id                    — Détails
POST   /api/v1/staff                        — Créer
PUT    /api/v1/staff/:id                    — Modifier
DELETE /api/v1/staff/:id                    — Supprimer

# Équipes
GET    /api/v1/teams                        — Liste des équipes du club
POST   /api/v1/teams                        — Créer une équipe
DELETE /api/v1/teams/:id                    — Supprimer

# Catégories
GET    /api/v1/categories                   — Liste (U15, U17, Seniors...)
POST   /api/v1/categories                   — Créer
DELETE /api/v1/categories/:id               — Supprimer
```

---

## 🧪 Test rapide (Postman)

**1. Login pour obtenir le token :**
```json
POST /api/v1/auth/login
{ "email": "...", "password": "..." }
```

**2. Créer une catégorie :**
```json
POST /api/v1/categories
Authorization: Bearer <token>
{ "name": "Seniors" }
```

**3. Créer une équipe :**
```json
POST /api/v1/teams
Authorization: Bearer <token>
{ "name": "Équipe première" }
```

**4. Créer un joueur :**
```json
POST /api/v1/players
Authorization: Bearer <token>
{
  "firstName": "Mohamed",
  "lastName": "Salah",
  "dateOfBirth": "2000-01-15",
  "position": "Attaquant",
  "jerseyNumber": 11
}
```

**5. Changer le statut (blessure) :**
```json
PATCH /api/v1/players/:id/status
Authorization: Bearer <token>
{
  "status": "injured",
  "description": "Blessure à la cheville",
  "returnDate": "2026-03-15"
}
```

> Le clubId est automatiquement extrait du token JWT, pas besoin de le spécifier.

---

## 📋 Prochaine étape : Module 6 — Planification & Événements
