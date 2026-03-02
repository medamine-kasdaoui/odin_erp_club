-- Script SQL pour MySQL/XAMPP
-- Créer des données de test pour Odin ERP Club

-- Sélectionner la base de données
USE odin_erp_club;

-- 1. Créer un club de test
INSERT INTO clubs (id, name, status, city, country, email, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'FC Odin Test',
  'active',
  'Casablanca',
  'MAR',
  'contact@fcodintest.ma',
  NOW(),
  NOW()
);

-- 2. Créer un administrateur du club
-- Mot de passe: password123
-- Hash bcrypt généré: $2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.
INSERT INTO users (
  id, email, password_hash, first_name, last_name, club_id, role, user_type, status, email_verified, created_at, updated_at
)
VALUES 
-- ADMIN
(
  '22222222-2222-2222-2222-222222222222', 'admin@club.fr', '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.', 
  'Admin', 'Odin', '11111111-1111-1111-1111-111111111111', 'admin', 'staff', 'active', 1, NOW(), NOW()
),
-- COACH
(
  '33333333-3333-3333-3333-333333333333', 'coach@club.fr', '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.', 
  'Head', 'Coach', '11111111-1111-1111-1111-111111111111', 'coach', 'staff', 'active', 1, NOW(), NOW()
),
-- PLAYER
(
  '44444444-4444-4444-4444-444444444444', 'player@club.fr', '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.', 
  'Yassine', 'Joueur', '11111111-1111-1111-1111-111111111111', 'player', 'player', 'active', 1, NOW(), NOW()
),
-- MEDICAL
(
  '55555555-5555-5555-5555-555555555555', 'medecin@club.fr', '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.', 
  'Doc', 'Medical', '11111111-1111-1111-1111-111111111111', 'medical', 'staff', 'active', 1, NOW(), NOW()
),
-- ACCOUNTANT
(
  '66666666-6666-6666-6666-666666666666', 'finance@club.fr', '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.', 
  'Finance', 'Odin', '11111111-1111-1111-1111-111111111111', 'accountant', 'staff', 'active', 1, NOW(), NOW()
),
-- SCOUT
(
  '77777777-7777-7777-7777-777777777777', 'scout@club.fr', '$2b$10$88Wn8HQh1yk1z.pmG9Vv1OT761oJDVpDZ775JfOCCvA32jfGNzp4.', 
  'Tech', 'Scout', '11111111-1111-1111-1111-111111111111', 'scout', 'staff', 'active', 1, NOW(), NOW()
);

-- Vérification
SELECT 'Clubs créés:' as Info;
SELECT * FROM clubs;

SELECT 'Utilisateurs créés:' as Info;
SELECT id, email, first_name, last_name, role, status FROM users;

-- 4. Créer une équipe de test
INSERT INTO categories (id, club_id, name, age_min, age_max, created_at)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Seniors', 18, 40, NOW());

INSERT INTO teams (id, club_id, name, category_id, created_at)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Équipe A', '44444444-4444-4444-4444-444444444444', NOW());

-- 5. Créer des joueurs de test
INSERT INTO players (
  id, club_id, team_id, category_id, first_name, last_name, date_of_birth, nationality, position, preferred_foot, jersey_number, height, weight, status, ai_score, stats, is_prospect, salary, medical_notes, created_at, updated_at
)
VALUES (
  '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
  'Yassine', 'Bounou', '1991-04-05', 'MAR', 'Gardien', 'Droit', 1, 195, 88, 'active', 91, '{"matches": 35, "clean_sheets": 15, "saves": 98}', false, 120000, 'RAS', NOW(), NOW()
),
(
  '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
  'Achraf', 'Hakimi', '1998-11-04', 'MAR', 'Défenseur', 'Droit', 2, 181, 73, 'active', 88, '{"matches": 30, "goals": 4, "assists": 8}', false, 150000, 'Blessure cheville en 2024', NOW(), NOW()
);

-- 6. Créer des événements de test
INSERT INTO events (
  id, club_id, team_id, event_type, title, description, start_date, end_date, all_day, location, status, home_score, away_score, visibility, created_at, updated_at
)
VALUES (
  '88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
  'match', 'Match de championnat vs FC Atlas', 'Match important pour la montée',
  DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY) + INTERVAL 2 HOUR, false, 'Stade Mohammed V', 'scheduled', null, null, 'public', NOW(), NOW()
),
(
  '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555',
  'match', 'Match amical vs USM', 'Victoire écrasante',
  DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY) + INTERVAL 2 HOUR, false, 'Complexe d''entraînement', 'completed', 3, 0, 'public', NOW(), NOW()
);

SELECT 'Configuration terminée! Vous pouvez maintenant tester l''API.' as Resultat;
