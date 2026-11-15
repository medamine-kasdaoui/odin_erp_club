# ODIN ⚽ — AI-Powered Football Club Management

**One app to run a professional football club: players, staff, training, medical follow-up, scouting, finance and communication, with machine learning at the core.**

ODIN is a full club ERP built with **Flutter**, **NestJS**, **MongoDB** and a set of **Python AI services**. Coaches, medical staff, managers and players each get their own space. The app predicts injury risk, estimates recovery time, recognises injuries and gym equipment from photos, values players, analyses match videos and suggests tactics.

```text
odin_erp_club/
├── mobile/    Flutter app (Android, iOS, web, desktop) + admin web
└── backend/   NestJS API, MongoDB, real-time features and all AI services
```

---

## 🧠 The AI inside ODIN

ODIN contains **eight AI components**. Some are trained machine-learning models, others use large language models.

| # | AI component | What it does | Technology | Folder |
| --- | --- | --- | --- | --- |
| 1 | **Injury risk and recovery** | Predicts a player's injury risk, the most likely injury type and the days needed to recover, then builds a rehab plan | scikit-learn Random Forests (400 trees), SMOTE, probability calibration | `backend/ai-pipeline` |
| 2 | **Injury photo classifier** | Recognises a visible injury in a photo: abrasion, bruise, burn, cut or normal skin | TensorFlow / Keras CNN, exported to TFLite | `backend/cam injury` |
| 3 | **Gym equipment recogniser** | Recognises 8 gym machines from a photo to guide rehab and training exercises | TensorFlow / Keras with MobileNetV2 transfer learning | `backend/cam gym` |
| 4 | **Scouting and player profiles** | Groups players into playing styles, finds similar players, scores potential, rates squad chemistry, suggests formations and builds training microcycles | FastAPI, K-Means clustering, Random Forest | `backend/ModeleAIpython` |
| 5 | **Player market value** | Estimates a player's transfer value from their profile and stats | FastAPI, Random Forest regressor | `backend/player_value_ai` |
| 6 | **Finance analysis** | Forecasts revenue and spending, measures financial risk and the ROI of transfers | FastAPI, pandas, NumPy | `backend/finance_ai_ml` |
| 7 | **Match video analysis** | Detects players and the ball, tracks them, splits teams by shirt colour and detects passes, shots, contacts and likely offsides | Ultralytics YOLO, OpenCV | `backend/football_video_analysis` |
| 8 | **AI coaches (LLM)** | Generates training drills from each player's weaknesses and match load, gives player insights, and runs an English coach for foreign players | Google Gemini | `backend/src/sports-performance`, `backend/src/learning` |

### 1. Injury risk and recovery (`ai-pipeline`)

The pipeline runs in five steps:

1. `01_export_players.py` exports players from MongoDB.
2. `02_generate_training_data.py` builds a training set of **88,000 player situations**. Each row has the player's age, fitness, fatigue, minutes played, training load and injury history. It also says whether an injury happened, which type (hamstring strain, ankle sprain, knee ligament, muscle fatigue) and how many days of recovery.
3. `03_train_model.py` trains a **calibrated Random Forest classifier** that outputs a real risk percentage. It uses SMOTE to balance the rare injury cases. It also trains a **Random Forest regressor** that predicts recovery days.
4. `05_train_injury_type_model.py` trains a second classifier for the **type** of injury.
5. `medical_ai.py` / `04_predict.py` load the models and give a risk, a type, a recovery time, and a **rehab and prevention plan** from `rehab_recommendation_engine.py`. A warning is added when the player has a high chance of re-injury.

The NestJS `medical` module runs this Python code for each player, and the app shows the result as an injury heatmap, a recovery calendar and a wearable dashboard (heart rate, HRV).

### 2 & 3. Computer vision (`cam injury`, `cam gym`, `vision_ai`)

Both models take 224×224 images and come with their training datasets:

| Model | Dataset | Classes |
| --- | --- | --- |
| Injury classifier | `cam injury/dataset` (~840 images) | abrasion, bruise, burn, cut, normal |
| Gym equipment | `cam gym/dataset` (~790 images) | bench press, dumbbells, elliptical machine, lat pulldown, leg press, recumbent bike, shoulder press machine, smith machine |

The trained models are included as `.keras` and `.tflite` files. The medical staff take a photo in the app, the backend runs `vision_ai` on it and returns the predicted class with its confidence.

### 4. Scouting AI (`ModeleAIpython`)

A FastAPI service that uses each player's physical and technical stats (speed, endurance, distance covered and more):

- **K-Means** sorts players into 3 playing-style profiles.
- A **Random Forest** predicts a player's potential.
- `/similar` finds players who play like a given player.
- `/chemistry/insights` rates how well two players or a whole squad fit together.
- `/tactics/suggest-formation` proposes a formation for the available squad.
- `/development-plan` and `/generate-microcycles` build personal development and training plans.
- `/train` retrains the model from the club's own data.

### 7. Match video analysis

An offline, CPU-only pipeline. YOLO detects the players and the ball, a light tracker keeps each player's ID, and HSV colour on the shirt decides the team. It then splits possession and detects passes (completed or not), shots, contacts and likely offsides. The output is a JSON file with events and team stats, streamed to the Flutter app as live progress.

---

## 📱 Main features

| Area | What's inside |
| --- | --- |
| **Club and users** | Multi-club accounts, roles and permissions, sign up with email verification and OTP, Google login, admin approval, admin web dashboard |
| **Squad** | Player profiles, staff, teams, categories, real-squad seed data, API-Football import |
| **Sports performance** | Training events, exercises, physical tests and scoring, reports, AI-generated drills |
| **Cognitive lab** | Reaction, memory and focus sessions, with each player's baseline and a squad overview of the day |
| **Nutrition lab** | BMR, calories, macros (proteins, carbs) and hydration targets per player |
| **Medical** | Injury risk analysis, injury photo recognition, heatmap, recovery calendar, wearable tracking |
| **Tactics** | Squad chemistry matrix and graph, formation suggestions, match simulation with injured players excluded |
| **Season planning** | Season plans and training microcycles |
| **Scouting** | AI player insights, comparisons, recruitment campaigns, report import |
| **Finance** | Budgets, payroll, revenue and expense tracking, AI forecasts, risk and ROI |
| **Travel** | Trip planning for away matches |
| **Communication** | Real-time chat, notifications, audio and video calls (WebRTC, Agora, Socket.IO with Redis) |
| **Gamification** | Points for player actions and a leaderboard |
| **Learning** | English lessons and an AI English coach for players |

---

## 🛠️ Tech stack

| Part | Technology |
| --- | --- |
| Mobile app | Flutter, Riverpod and Provider, GoRouter, Dio, fl_chart, table_calendar, flutter_webrtc, socket_io_client |
| Backend | NestJS 10, TypeScript, Mongoose, Passport (JWT, Google OAuth), Swagger, schedulers |
| Database | MongoDB |
| Real time | Socket.IO with a Redis adapter, WebRTC, Agora |
| Notifications | Firebase Admin, Nodemailer |
| Machine learning | Python, scikit-learn, imbalanced-learn, TensorFlow / Keras, TFLite, FastAPI |
| Computer vision | Ultralytics YOLO, OpenCV |
| LLM | Google Gemini |
| Football data | API-Football |

```text
Flutter app ──► NestJS API ──► MongoDB
                   │
                   ├── Python processes: injury risk, injury and gym image recognition
                   ├── FastAPI services: scouting (8000), player value (8002), finance (8200)
                   ├── Video analysis CLI (YOLO)
                   └── Google Gemini: drills, insights, English coach
```

---

## 📦 Large model files (GitHub Release)

Two trained model files are too big for normal GitHub storage, so they're attached to the repository's **[Releases](../../releases)**:

| File | Size | Put it in |
| --- | --- | --- |
| `injury_model.pkl.gz` | ~0.7 GB (4.8 GB unzipped) | `backend/ai-pipeline/` then run `gunzip injury_model.pkl.gz` |
| `injury_model.h5` | 128 MB | `backend/cam injury/` (Keras H5 version of the injury classifier) |

You can also rebuild the injury models yourself in a few minutes:

```bash
cd backend/ai-pipeline
pip install pandas numpy scikit-learn imbalanced-learn joblib
python 03_train_model.py              # injury_model.pkl + recovery_model.pkl
python 05_train_injury_type_model.py  # injury_type_model.pkl
```

---

## 🚀 Run it locally

### 1. Backend

Requirements: Node.js, MongoDB and Python 3.

```bash
cd backend
npm install
```

Create `backend/.env` with at least:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/odin_club
JWT_SECRET=change-me

GOOGLE_API_KEY=            # Gemini (drills, insights, English coach)
API_FOOTBALL_KEY=          # optional, real player import
GOOGLE_CLIENT_ID=          # optional, Google login
GOOGLE_CALLBACK_URL=

AI_SERVICE_URL=http://localhost:8000
FINANCE_AI_URL=http://localhost:8200
```

Email (SMTP), Firebase and Agora keys are only needed for those features. See `backend/EMAIL_SETUP.md` and `backend/SETUP_GUIDE.md`.

```bash
npm run start:dev
```

The API docs are at http://localhost:3000/docs.

### 2. AI services

Each Python service has its own `requirements.txt`:

```bash
cd backend/ModeleAIpython && pip install -r requirements.txt && python main.py   # port 8000
cd backend/player_value_ai && pip install -r requirements.txt && ./run.sh        # port 8002
cd backend/finance_ai_ml   && pip install -r requirements.txt && ./run.sh        # port 8200
```

To retrain the vision models with the included datasets:

```bash
pip install tensorflow
python "backend/cam injury/train_model.py"
python "backend/cam gym/train_gym_model.py"
```

Video analysis: see `backend/football_video_analysis/README.md`.

### 3. Mobile app

```bash
cd mobile
flutter pub get
flutter run
```

The app's server addresses are in `mobile/lib/config/app_config.dart`. `10.0.2.2` points to your computer from the Android emulator. Use your computer's local IP on a real phone.

---

## 👥 Team

University project (PIM) built as a team at ESPRIT:

- Mahdi Nattour
- Mohamed Chamseddine Bejaoui
- Rayhana Briki
- Tesnim Ben Othmaine
- Med Amine Kasdaoui
