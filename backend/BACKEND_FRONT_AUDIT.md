# Audit backend/front - PIM Nettoyage

Date: 2026-04-29

Objectif: nettoyer le backend NestJS sans toucher au front Flutter, en gardant un seul backend fonctionnel avec les endpoints deja consommes par l'application mobile/web.

## Consolidation appliquee

Cette consolidation a ete appliquee cote backend uniquement.

- `categories` a ete recupere depuis `ODIN_Club_backend/src/categories` vers `src/categories`.
- `teams` a ete recupere depuis `ODIN_Club_backend/src/teams` vers `src/teams`.
- `CategoriesModule` et `TeamsModule` ont ete branches dans `src/app.module.ts`.
- Les aliases front suivants ont ete ajoutes dans `src/auth`: `/auth/me`, `/auth/pending-users`, `/auth/approve/:userId`, `/auth/reject/:userId`.
- L'alias `/notifications/read-all` a ete ajoute.
- Les routes legacy attendues par Flutter ont ete ajoutees sur events: `/events/calendar`, `/events/:id/status`, `/events/:id/participants`.
- Les routes legacy attendues par Flutter ont ete ajoutees sur players: `/players/:id/status`, `/players/:id/history`, `/players/:id/assign-team`, `/players/:id/analyses`.
- Un module `src/staff` a ete cree car aucun duplicat backend ne contenait `staff` ou `coaches`.
- `src/staff` expose aussi `/coaches` pour les appels existants du front.
- Les copies backend completes ont ete deplacees dans `_archive_backend_sources`:
  - `integration_originals`
  - `root_backup`
  - `ODIN_Club_backend`
  - `PIM_backend--main`

Verification apres consolidation:

- `npm run build`: OK
- Verification automatique des 21 routes front prioritaires manquantes: 0 manquante
- Verification elargie des appels API concrets du front: 152 appels detectes, 0 route concrete manquante dans le `src` principal.
- Les 3 residus detectes sont les wrappers generiques `${AppConstants.baseUrl}$endpoint` dans `lib/erp/core/api_service.dart`; ce ne sont pas des routes reelles.
- `player_value_ai/player_value_api.dart` reste un service separe sur le port 8002 (`/predict-player-value`). Il n'est pas une route NestJS du port 3000.
- Audit supplementaire des archives: 7 `src` archives compares au front, aucune route utilisee par Flutter n'existe uniquement dans l'archive. Donc rien d'utilise par le front n'a ete oublie dans les `src` archives.
- Modele AI scouting core verifie: routes NestJS dans `src/ai`, modele Python recupere dans `ModeleAIpython`, et `PythonProcessService` pointe maintenant vers `ModeleAIpython` au lieu de l'ancien chemin archive `ODIN_Club_backend/ModeleAIpython`.
- Verification finale sans archive visible: `_archive_backend_sources` a ete renomme temporairement, puis `npm run build` a reussi. Le dossier a ensuite ete restaure. Le backend principal ne depend donc pas de l'archive pour compiler.
- Nettoyage final: `_archive_backend_sources` a ete supprime apres verification, puis `npm run build` a de nouveau reussi.
- Doublons internes supprimes: `src/player` et `src/user` etaient d'anciens modules non importes par `AppModule`. La seule reference utile restante (`UserRole` dans le decorateur/guard roles) a ete remplacee par l'enum actif `Role` depuis `src/common/enums/role.enum.ts`, puis `src/player` et `src/user` ont ete supprimes. `npm run build` reussit apres suppression.
- Test front-like joueurs/roles: les payloads reels Flutter ont ete rejoues contre le backend. Le formulaire ERP joueur envoyait `preferredFoot`, `contractStartDate` et `contractEndDate`; ces champs ont ete ajoutes au DTO/schema `players` pour eviter le rejet par `forbidNonWhitelisted`. La serialization `players` expose maintenant aussi `id` en plus de `_id`, ce qui correspond au modele Flutter ERP. Tests OK pour creation/update joueur ERP, creation joueur AI scouting, inscription responsable, et inscription membre avec roles `JOUEUR`, `STAFF_TECHNIQUE`, `STAFF_MEDICAL`, `FINANCIER`. Les donnees de test ont ete supprimees.
- Autres modeles IA verifies hors archive:
  - `player_value_ai`: present a la racine avec `main.py`, `player_value_model.pkl`, `player_value_scaler.pkl`; utilise par `PythonProcessService` via `PLAYER_VALUE_AI_MODEL_DIR` ou `player_value_ai` par defaut.
  - `finance_ai_ml`: present a la racine avec `main.py`; utilise par `PythonProcessService` via `FINANCE_AI_MODEL_DIR` ou `finance_ai_ml` par defaut.
  - `football_video_analysis`: present a la racine avec `__main__.py`; utilise par `AnalysisService` depuis le workspace racine.
  - `medical_ai`: present a la racine avec `medical_ai.py`; service configure par `MEDICAL_AI_SCRIPT`, sans chemin archive.
  - `vision_ai`: present a la racine avec `predict_image.py`; service configure par les variables `MEDICAL_*_AI_SCRIPT/MODEL`, sans chemin archive.

Les dossiers `finance_ai_ml`, `football_video_analysis`, `medical_ai`, `player_value_ai`, `vision_ai` et `learning_assets` n'ont pas ete archives, car ils sont des services/assets references ou potentiellement appeles par le backend actif.

## Conclusion courte

Le backend a garder comme base est:

`PIM_backend--chams2`

Son `src` racine compile correctement avec `npm run build` et correspond a la configuration Flutter principale:

`AppConfig.apiBaseUrl = http://10.0.2.2:3000/api`

Il ne faut pas garder les autres backends comme racines actives. Ils doivent servir uniquement de sources de recuperation ponctuelle, puis etre archives/supprimes apres verification.

## Verification effectuee

- Front Flutter non modifie.
- Installation backend effectuee avec `npm ci`.
- Build backend racine: OK avec `npm run build`.
- `npm ci` signale 30 vulnerabilites npm, dont 10 high. Aucun `npm audit fix` n'a ete lance pour eviter de changer les versions automatiquement pendant l'audit.

## Structure trouvee

Backends / copies detectes:

| Emplacement | TS | Controllers | Modules | Avis |
| --- | ---: | ---: | ---: | --- |
| `src` | 277 | 37 presents, 34 actifs approx. | 41 | Base a garder |
| `ODIN_Club_backend/src` | 265 | 29 | 38 | Source utile pour `categories`, `teams`, anciens `events` |
| `root_backup/src` | 250 | 31 | 39 | Backup tres proche du `src` actuel |
| `integration_originals/99ae/src` | 177 | 21 | 28 | Archive integration |
| `integration_originals/99ae/ODIN_Club_backend/src` | 214 | 26 | 34 | Archive integration |
| `integration_originals/amine-v2/src` | 177 | 21 | 28 | Archive integration |
| `integration_originals/amine-v2/ODIN_Club_backend/src` | 131 | 15 | 20 | Archive integration |
| `integration_originals/mahdiii/src` | 191 | 23 | 30 | Archive integration |

Les controllers presents mais non actifs dans le `src` racine semblent etre:

- `src/user/user.controller.ts`
- `src/player/player.controller.ts`
- `src/sports-performance/players/players.controller.ts`

Ils doublonnent avec des modules actifs ou ne sont pas importes. A nettoyer apres avoir confirme les dependances.

## Endpoints front bien couverts par le backend racine

Exemples importants couverts:

- Auth: `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`
- Users: `/users`, `/users/profile`, `/users/pending`, `/users/:userId/approve`, `/users/:userId/reject`
- AI: `/ai/dashboard/players`, `/ai/predict-player-value`, `/ai/player-analysis/:id`, `/ai/finance-insights`
- Analysis upload/video: `/uploads`, `/analysis/color-presets`, `/analysis/jobs`, `/analysis/jobs/:id/result`
- Chat: `/chat/users`, `/chat/conversations`, `/chat/messages/:id`
- Notifications: `/notifications`, `/notifications/:id/read`, `/notifications/mark-read`
- Chemistry: `/chemistry/*`
- Learning: `/courses`, `/learning/dashboard/player/:id`, `/progress/update`, `/quiz/*`
- Sports performance: `/events`, `/events/:id`, `/events/:eventId/players`, `/test-types`, `/event-players/:id/test-results`, `/exercises`, `/cognitive-lab/*`, `/sports-performance/nutrition-lab/*`
- Season/tactics/squad: `/season-plans/*`, `/tactics/analyze`, `/squad/season/:season`

## Endpoints Flutter manquants ou incompatibles

Ces appels existent cote Flutter et ne doivent pas etre casses. Comme le front ne doit pas etre modifie, il faut ajouter/recuperer les endpoints cote backend.

| Endpoint attendu par Flutter | Etat backend racine | Source / action conseillee |
| --- | --- | --- |
| `/auth/me` | Manquant | Ajouter alias vers `/users/me` ou profil courant |
| `/auth/pending-users` | Manquant | Ajouter alias vers `/users/pending` |
| `/auth/approve/:userId` | Manquant | Ajouter alias vers `/users/:userId/approve` |
| `/auth/reject/:userId` | Manquant | Ajouter alias vers `/users/:userId/reject` |
| `/categories`, `/categories/:id` | Manquant | Recuperer module depuis `ODIN_Club_backend/src/categories` |
| `/teams`, `/teams/:id` | Manquant | Recuperer module depuis `ODIN_Club_backend/src/teams` |
| `/staff`, `/staff/:id` | Manquant | Aucun module trouve; creer module ou mapper vers users/staff roles |
| `/coaches`, `/coaches/:id` | Manquant | Aucun module trouve; creer module ou mapper vers users/staff technique |
| `/events/calendar` | Manquant dans racine | Recuperer logique depuis `ODIN_Club_backend/src/events` |
| `/events/:id/status` | Manquant dans racine | Recuperer/ajouter patch status |
| `/events/:eventId/participants` | Manquant dans racine | Recuperer/ajouter participants legacy |
| `/players/:id/status` | Manquant | Ajouter champ/status endpoint dans `players` |
| `/players/:playerId/history` | Manquant | Ajouter historique ou stub coherent |
| `/players/:playerId/assign-team` | Manquant | Ajouter association equipe |
| `/players/:id/analyses` | Manquant | Relier a analyses existantes ou AI reports |
| `/notifications/read-all` | Incompatible | Backend a `/notifications/mark-read`; ajouter alias `read-all` |

Endpoint separe:

- `player_value_ai/player_value_api.dart` appelle `http://10.0.2.2:8002/predict-player-value`.
- Ce n'est pas le backend NestJS port 3000. Il faut soit garder un microservice port 8002, soit ajouter un proxy NestJS compatible si on veut vraiment unifier tout dans un seul backend.

## Duplications / mauvaises pratiques observees

- Plusieurs dossiers `src` complets dans le repo. C'est la plus grosse source de confusion.
- Plusieurs `package.json` dans des copies de backend.
- `src/user` et `src/users` coexistent. Le module actif semble etre `src/users`; `src/user` ressemble a une ancienne version.
- `src/player` et `src/players` coexistent. Le module actif semble etre `src/players`; `src/player` ressemble a une ancienne version.
- `src/sports-performance/players` contient un controller `@Controller('api/players')`, ce qui ferait `/api/api/players` avec le prefix global. En plus, il ne semble pas actif dans `SportsPerformanceModule`.
- `ODIN_Club_backend/src` contient `common 2`, signe de copie manuelle.
- Le front utilise plusieurs services API differents (`lib/services/api_service.dart`, `lib/erp/core/api_service.dart`, services sports, learning, user_management). Comme on ne touche pas au front, le backend doit rester compatible avec ces variantes.

## Plan de nettoyage recommande

1. Garder uniquement le backend racine comme projet actif.
   - `package.json`
   - `nest-cli.json`
   - `tsconfig*.json`
   - `src`
   - `test`
   - scripts seed utiles

2. Creer un dossier d'archive temporaire hors runtime, par exemple `_archive_backend_sources`, et y deplacer:
   - `integration_originals`
   - `root_backup`
   - `PIM_backend--main`
   - les dossiers IA/prototypes non importes par Nest si non utilises
   - `ODIN_Club_backend` seulement apres avoir recupere `categories`, `teams`, et morceaux `events`

3. Recuperer les modules manquants utiles depuis `ODIN_Club_backend/src`.
   - `categories`
   - `teams`
   - endpoints legacy `events/calendar`, `events/:id/status`, `events/:id/participants`

4. Ajouter des aliases backend pour compatibilite front sans changer Flutter.
   - `/auth/me`
   - `/auth/pending-users`
   - `/auth/approve/:userId`
   - `/auth/reject/:userId`
   - `/notifications/read-all`

5. Unifier les doublons internes.
   - Supprimer/archiver `src/user` apres confirmation que `src/users` couvre tout.
   - Supprimer/archiver `src/player` apres confirmation que `src/players` couvre tout.
   - Supprimer/archiver `src/sports-performance/players` ou corriger son prefix si le module devient necessaire.

6. Ajouter les modules manquants non trouves.
   - `staff`
   - `coaches`
   - endpoints players legacy: status, history, assign-team, analyses

7. Verifier apres chaque etape.
   - `npm run build`
   - tests backend si disponibles
   - demarrage local sur port 3000
   - smoke test des endpoints consommes par Flutter

## Proposition de cible finale

Structure backend cible:

```text
PIM_backend--chams2
  src/
    ai/
    analysis/
    auth/
    categories/
    chat/
    chemistry/
    clubs/
    common/
    events/
    finance/
    learning/
    medical/
    notifications/
    players/
    staff/
    teams/
    users/
    ...
  test/
  package.json
  nest-cli.json
  tsconfig.json
```

Tout ce qui est backup, integration ou prototype doit etre hors compilation et hors chemin mental du backend actif.
