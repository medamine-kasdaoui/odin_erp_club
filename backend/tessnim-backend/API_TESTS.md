# Tests API - Postman/Thunder Client

Collection de tests pour l'API Odin ERP Club

## Variables

- `baseUrl`: http://localhost:3000/api/v1
- `clubId`: 11111111-1111-1111-1111-111111111111
- `token`: (sera rempli après login)

---

## 1. Vérifier que le serveur fonctionne

```http
GET http://localhost:3000/api/v1/clubs
```

**Réponse attendue** : Liste des clubs (peut être vide)

---

## 2. Inscription d'un nouveau joueur

```http
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json

{
  "email": "nouveau.joueur@example.com",
  "firstName": "Achraf",
  "lastName": "Hakimi",
  "phone": "+212611111111",
  "role": "player",
  "clubId": "11111111-1111-1111-1111-111111111111"
}
```

**Réponse attendue** :
```json
{
  "success": true,
  "message": "Inscription effectuée. En attente de validation par le responsable du club.",
  "userId": "uuid-generated"
}
```

---

## 3. Connexion Admin (pour approuver)

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@fcodintest.ma",
  "password": "Admin123"
}
```

**Réponse attendue** :
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "22222222-2222-2222-2222-222222222222",
    "email": "admin@fcodintest.ma",
    "firstName": "Admin",
    "lastName": "Odin",
    "role": "admin",
    "clubId": "11111111-1111-1111-1111-111111111111"
  }
}
```

⚠️ **Sauvegardez le accessToken pour les requêtes suivantes**

---

## 4. Voir les utilisateurs en attente

```http
GET http://localhost:3000/api/v1/auth/pending-users
Authorization: Bearer {{token}}
```

**Réponse attendue** : Liste des utilisateurs avec `status: "pending"`

---

## 5. Approuver un utilisateur

Remplacez `USER_ID` par l'ID du joueur en attente :

```http
POST http://localhost:3000/api/v1/auth/approve/USER_ID
Authorization: Bearer {{token}}
Content-Type: application/json

{}
```

**Réponse attendue** :
```json
{
  "success": true,
  "message": "Utilisateur approuvé et identifiants envoyés",
  "credentials": {
    "email": "nouveau.joueur@example.com",
    "password": "ABC123DEF456"
  }
}
```

⚠️ **Notez le mot de passe généré**

---

## 6. Connexion du joueur approuvé

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "nouveau.joueur@example.com",
  "password": "ABC123DEF456"
}
```

**Réponse attendue** : Token + profil utilisateur

---

## 7. Voir son profil

```http
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer {{token_du_joueur}}
```

---

## 8. Lister tous les utilisateurs

```http
GET http://localhost:3000/api/v1/users
Authorization: Bearer {{token}}
```

---

## Tests de sécurité

### Tentative de connexion avec mauvais mot de passe

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@fcodintest.ma",
  "password": "WrongPassword"
}
```

**Réponse attendue** : 401 Unauthorized

### Tentative d'accès sans token

```http
GET http://localhost:3000/api/v1/auth/me
```

**Réponse attendue** : 401 Unauthorized

### Tentative de connexion avec compte pending

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json

{
  "email": "joueur.test@example.com",
  "password": "anypassword"
}
```

**Réponse attendue** : 401 "Votre compte est en attente de validation"

---

## Collection Postman

Pour importer dans Postman, créez une collection avec ces requêtes.

## Thunder Client (VS Code)

1. Installer l'extension Thunder Client
2. Créer une nouvelle collection
3. Ajouter ces requêtes une par une
