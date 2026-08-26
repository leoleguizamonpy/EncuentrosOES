\set ON_ERROR_STOP on

DELETE FROM general_championship_contributions
WHERE championship_id = '99000000-0000-4000-8000-000000000001';
DELETE FROM general_championship_scoring_rules
WHERE championship_id = '99000000-0000-4000-8000-000000000001';
DELETE FROM general_championships
WHERE id = '99000000-0000-4000-8000-000000000001';

INSERT INTO general_championships (
  id, edition_id, event_id, name, status, revision, created_by, updated_by
)
SELECT
  '99000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'Campeonato General Universitarios 2026',
  'ACTIVE',
  8,
  id,
  id
FROM users
WHERE email = 'e2e-superadmin@oes.test';

INSERT INTO general_championship_scoring_rules (championship_id, placement, label, points) VALUES
  ('99000000-0000-4000-8000-000000000001', 1, 'Campeón', 100),
  ('99000000-0000-4000-8000-000000000001', 2, 'Subcampeón', 70),
  ('99000000-0000-4000-8000-000000000001', 3, 'Tercer lugar', 50),
  ('99000000-0000-4000-8000-000000000001', 4, 'Cuarto lugar', 25);

INSERT INTO general_championship_contributions (
  id, championship_id, institution_id, source_type, source_competition_id,
  source_placement, title, description, points, automatic, status,
  recorded_by, confirmed_at, confirmed_by
)
SELECT
  '99100000-0000-4000-8000-000000000001',
  '99000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  'COMPETITION_PLACEMENT',
  '96000000-0000-4000-8000-000000000001',
  1,
  'Handball · Femenino — Campeón',
  'Aporte deportivo oficial confirmado para la evidencia visual del Campeonato General.',
  100,
  true,
  'CONFIRMED',
  id,
  CURRENT_TIMESTAMP,
  id
FROM users WHERE email = 'e2e-superadmin@oes.test';

INSERT INTO general_championship_contributions (
  id, championship_id, institution_id, source_type, title, description,
  points, automatic, status, recorded_by, confirmed_at, confirmed_by
)
SELECT
  '99100000-0000-4000-8000-000000000002',
  '99000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  'SPECIAL',
  'OES Experience',
  'Actividad institucional adicional oficialmente computable para el Campeonato General.',
  70,
  false,
  'CONFIRMED',
  id,
  CURRENT_TIMESTAMP,
  id
FROM users WHERE email = 'e2e-superadmin@oes.test';

INSERT INTO general_championship_contributions (
  id, championship_id, institution_id, source_type, title, description,
  points, automatic, status, recorded_by, confirmed_at, confirmed_by
)
SELECT
  '99100000-0000-4000-8000-000000000003',
  '99000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000002',
  'SPECIAL',
  'Reconocimiento deportivo',
  'Aporte confirmado de una actividad transversal de la edición.',
  120,
  false,
  'CONFIRMED',
  id,
  CURRENT_TIMESTAMP,
  id
FROM users WHERE email = 'e2e-superadmin@oes.test';

INSERT INTO general_championship_contributions (
  id, championship_id, institution_id, source_type, title, description,
  points, automatic, status, recorded_by
)
SELECT
  '99100000-0000-4000-8000-000000000004',
  '99000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  'SPECIAL',
  'Mejor Hinchada',
  'Reconocimiento todavía pendiente de una segunda autoridad; no debe modificar el total.',
  50,
  false,
  'PENDING_CONFIRMATION',
  id
FROM users WHERE email = 'e2e-superadmin@oes.test';
