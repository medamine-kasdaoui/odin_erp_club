# Configuration XAMPP - Guide rapide

## ✅ Configuration terminée !

Le backend est maintenant configuré pour utiliser **MySQL de XAMPP** au lieu de PostgreSQL.

---

## Étapes pour démarrer

### 1. Démarrer XAMPP

1. Ouvrez **XAMPP Control Panel**
2. Démarrez **Apache** (optionnel, pour phpMyAdmin)
3. Démarrez **MySQL** ✅ **IMPORTANT**

### 2. Créer la base de données

#### Option A : Via phpMyAdmin (Interface graphique)

1. Ouvrez votre navigateur : http://localhost/phpmyadmin
2. Cliquez sur "Nouvelle base de données" ou "New"
3. Nom : `odin_erp_club`
4. Interclassement : `utf8mb4_unicode_ci`
5. Cliquez "Créer"

#### Option B : Via ligne de commande

```bash
# Aller dans le dossier XAMPP MySQL
cd C:\xampp\mysql\bin

# Se connecter à MySQL
mysql -u root

# Créer la base de données
CREATE DATABASE odin_erp_club CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Vérifier
SHOW DATABASES;

# Quitter
EXIT;
```

### 3. Démarrer le serveur NestJS

```bash
cd c:\Users\majdo\OneDrive\Desktop\backend
npm run start:dev
```

**Vous devriez voir** :
```
🚀 Odin ERP Club API running on: http://localhost:3000/api/v1
```

Les tables `users` et `clubs` seront créées automatiquement ! ✨

---

## Vérification rapide

### Tester que l'API fonctionne

Ouvrez votre navigateur :
```
http://localhost:3000/api/v1/clubs
```

Vous devriez voir : `[]` (tableau vide, c'est normal)

### Vérifier les tables créées

Via phpMyAdmin :
1. http://localhost/phpmyadmin
2. Sélectionnez `odin_erp_club` dans la barre latérale
3. Vous devriez voir les tables : `users`, `clubs`

---

## Insérer des données de test

### Via phpMyAdmin

1. http://localhost/phpmyadmin
2. Sélectionnez `odin_erp_club`
3. Cliquez sur l'onglet "SQL"
4. Copiez-collez le contenu de `test-data-mysql.sql`
5. Cliquez "Exécuter"

### Via ligne de commande

```bash
cd C:\xampp\mysql\bin
mysql -u root odin_erp_club < c:\Users\majdo\OneDrive\Desktop\backend\test-data-mysql.sql
```

---

## Identifiants de test

Après avoir inséré les données de test :

**Admin du club** :
- Email : `admin@fcodintest.ma`
- Password : `Admin123`

**Club de test** :
- ID : `11111111-1111-1111-1111-111111111111`
- Nom : `FC Odin Test`

---

## Dépannage

### MySQL ne démarre pas dans XAMPP

- Vérifiez qu'aucun autre MySQL n'est en cours (Task Manager)
- Changez le port MySQL dans XAMPP Config (3306 → 3307)
- Redémarrez XAMPP en tant qu'administrateur

### "Cannot connect to database"

- Vérifiez que MySQL est démarré dans XAMPP
- Vérifiez `.env` : `DATABASE_PASSWORD=` (vide par défaut dans XAMPP)

### Les tables ne se créent pas

- Vérifiez que la base `odin_erp_club` existe
- Redémarrez le serveur NestJS
- Regardez les logs pour les erreurs SQL

---

## C'est tout ! 🎉

Le backend est prêt à être testé. Consultez **API_TESTS.md** pour tester tous les endpoints.
