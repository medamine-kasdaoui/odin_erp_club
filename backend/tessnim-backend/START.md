# Script de démarrage Backend

## Avant de lancer

✅ PostgreSQL installé et configuré
✅ Base de données `odin_erp_club` créée
✅ Fichier `.env` configuré avec vos credentials

## Commandes

# Démarrer en mode développement (auto-reload)
npm run start:dev

# Ou démarrer en mode normal
npm run start

## Que faire si ça ne démarre pas ?

### Erreur "Cannot connect to database"
- Vérifiez que PostgreSQL est démarré
- Vérifiez le mot de passe dans `.env`
- Vérifiez que la base `odin_erp_club` existe

### Erreur "Port 3000 already in use"
- Changez le port dans `.env` : `PORT=3001`
- Ou tuez le processus sur le port 3000

### Les tables ne se créent pas
- Vérifiez que `synchronize: true` dans `app.module.ts`
- Vérifiez les logs pour voir les erreurs SQL

## Vérifier que ça marche

Ouvrez votre navigateur :
http://localhost:3000/api/v1/clubs

Vous devriez voir un tableau vide `[]` ou vos clubs.

## Insérer des données de test

Si vous voulez des données de test :
```bash
psql -U postgres -d odin_erp_club -f test-data.sql
```

Ou via pgAdmin : ouvrez le query tool et copiez-collez le contenu de `test-data.sql`
