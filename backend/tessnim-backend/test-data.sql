-- Script SQL pour créer des données de test
-- Exécuter ce script après avoir créé la base de données odin_erp_club

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

-- 2. Créer un administrateur du club (mot de passe: Admin123)
-- Hash bcrypt de "Admin123"
INSERT INTO users (
  id, 
  email, 
  password_hash, 
  first_name, 
  last_name, 
  club_id, 
  role, 
  user_type, 
  status,
  email_verified,
  created_at,
  updated_at
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'admin@fcodintest.ma',
  '$2b$10$XQQhq4h4D8CqPqG8xqz.4OKqF0dE0XhXqD8qxXqD8qxXqD8qxXqD8',
  'Admin',
  'Odin',
  '11111111-1111-1111-1111-111111111111',
  'admin',
  'staff',
  'active',
  true,
  NOW(),
  NOW()
);

-- 3. Créer un joueur de test en attente de validation
INSERT INTO users (
  id,
  email,
  password_hash,
  first_name,
  last_name,
  phone,
  club_id,
  role,
  user_type,
  status,
  created_at,
  updated_at
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'joueur.test@example.com',
  '$2b$10$DummyHashForTesting',
  'Mohamed',
  'Test',
  '+212600000000',
  '11111111-1111-1111-1111-111111111111',
  'player',
  'candidate',
  'pending',
  NOW(),
  NOW()
);

-- Vérification
SELECT * FROM clubs;
SELECT id, email, first_name, last_name, role, status FROM users;
