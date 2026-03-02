# Odin ERP Club - Backend API

Backend NestJS pour l'application Odin ERP Club.

## 🚀 Installation

```bash
npm install
```

## ⚙️ Configuration

1. Créer la base de données PostgreSQL :
```sql
CREATE DATABASE odin_erp_club;
```

2. Configurer `.env` (déjà créé, modifier les valeurs) :
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=votre_mot_de_passe
DATABASE_NAME=odin_erp_club

JWT_SECRET=votre_secret_jwt
```

## 🏃 Démarrage

```bash
# Mode développement (avec auto-reload)
npm run start:dev

# Mode production
npm run build
npm run start:prod
```

Le serveur démarre sur `http://localhost:3000`

## 📚 API Endpoints

### Authentification

- `POST /api/v1/auth/register` - Inscription candidat
- `POST /api/v1/auth/login` - Connexion
- `GET /api/v1/auth/me` - Profil utilisateur (protégé)
- `GET /api/v1/auth/pending-users` - Liste candidats en attente (admin)
- `POST /api/v1/auth/approve/:userId` - Approuver candidat (admin)
- `POST /api/v1/auth/reject/:userId` - Rejeter candidat (admin)

### Clubs

- `GET /api/v1/clubs` - Liste des clubs
- `GET /api/v1/clubs/:id` - Détails d'un club

### Users

- `GET /api/v1/users` - Liste des utilisateurs (protégé)
- `GET /api/v1/users/:id` - Détails d'un utilisateur (protégé)

## 🔐 Authentification JWT

Les routes protégées nécessitent un header Authorization :
```
Authorization: Bearer <token>
```

## 📦 Structure du projet

```
src/
├── auth/          # Module d'authentification
├── users/         # Module utilisateurs
├── clubs/         # Module clubs
├── app.module.ts  # Module principal
└── main.ts        # Point d'entrée
```

## 🛠️ Technologies

- NestJS
- TypeORM
- PostgreSQL
- JWT
- Bcrypt
