\set ON_ERROR_STOP on

SELECT id AS admin_id FROM users WHERE email_normalized = 'e2e-superadmin@oes.test' \gset

INSERT INTO editions (id, year, name, status, revision, created_by, updated_at, updated_by)
VALUES ('91000000-0000-4000-8000-000000000001', 2026, 'OES 2026', 'OPEN', 1, :'admin_id', now(), :'admin_id');

INSERT INTO events (id, code, name, active)
VALUES ('92000000-0000-4000-8000-000000000001', 'UNIVERSITARIOS', 'Universitarios', true);

INSERT INTO sports (id, code, name, active)
VALUES ('93000000-0000-4000-8000-000000000001', 'HANDBALL', 'Handball', true);

INSERT INTO modalities (id, code, name, active)
VALUES ('94000000-0000-4000-8000-000000000001', 'FEMALE', 'Femenino', true);

INSERT INTO event_sport_modalities (event_id, sport_id, modality_id, active)
VALUES ('92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', true);

INSERT INTO institutions (id, event_id, code, name, normalized_name, active, revision, created_by, updated_at, updated_by) VALUES
('95000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', 'FIL', 'Facultad de Filosofía UNA', 'facultad de filosofia una', true, 1, :'admin_id', now(), :'admin_id'),
('95000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'AGR', 'Facultad de Ciencias Agrarias UNA', 'facultad de ciencias agrarias una', true, 1, :'admin_id', now(), :'admin_id'),
('95000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', 'DER', 'Facultad de Derecho y Ciencias Sociales UNA', 'facultad de derecho y ciencias sociales una', true, 1, :'admin_id', now(), :'admin_id'),
('95000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001', 'CS', 'Facultad de Ciencias Veterinarias UNA', 'facultad de ciencias veterinarias una', true, 1, :'admin_id', now(), :'admin_id'),
('95000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000001', 'UTCD', 'UTCD San Ignacio', 'utcd san ignacio', true, 1, :'admin_id', now(), :'admin_id');

INSERT INTO competitions (id, edition_id, event_id, sport_id, modality_id, status, format_code, revision, created_by, updated_at, updated_by)
VALUES ('96000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'DRAFT', 'KNOCKOUT', 7, :'admin_id', now(), :'admin_id');

INSERT INTO competition_participants (id, competition_id, event_id, institution_id, display_name, status, enabled_at, enabled_by, revision) VALUES
('97000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'Facultad de Filosofía UNA', 'ENABLED', now(), :'admin_id', 1),
('97000000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000002', 'Facultad de Ciencias Agrarias UNA', 'ENABLED', now(), :'admin_id', 1),
('97000000-0000-4000-8000-000000000003', '96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000003', 'Facultad de Derecho y Ciencias Sociales UNA', 'ENABLED', now(), :'admin_id', 1),
('97000000-0000-4000-8000-000000000004', '96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000004', 'Facultad de Ciencias Veterinarias UNA', 'ENABLED', now(), :'admin_id', 1),
('97000000-0000-4000-8000-000000000005', '96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000005', 'UTCD San Ignacio', 'ENABLED', now(), :'admin_id', 1);

INSERT INTO competition_rule_sets (id, competition_id, schema_version, revision_number, result_profile, profile_config, knockout_resolution_code, status, canonical_hash, frozen_at, frozen_by, revision, created_by, updated_at, updated_by)
VALUES (
  '98000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  1,
  1,
  'SCORE_BASED',
  '{"allowDraws":false,"profile":"SCORE_BASED"}'::jsonb,
  'HIGHER_SCORE',
  'FROZEN',
  '1203a0340ebe68c8cf458e5e9ce18ce52da205176dd5c7bde417286d3dfc77c2',
  now(),
  :'admin_id',
  2,
  :'admin_id',
  now(),
  :'admin_id'
);

INSERT INTO rule_set_outcomes (rule_set_id, outcome_code, table_points, description) VALUES
('98000000-0000-4000-8000-000000000001', 'WIN', 3, 'Victoria'),
('98000000-0000-4000-8000-000000000001', 'LOSS', 0, 'Derrota');

INSERT INTO rule_set_metrics (rule_set_id, metric_code, enabled) VALUES
('98000000-0000-4000-8000-000000000001', 'PLAYED', true),
('98000000-0000-4000-8000-000000000001', 'WINS', true),
('98000000-0000-4000-8000-000000000001', 'LOSSES', true),
('98000000-0000-4000-8000-000000000001', 'TABLE_POINTS', true),
('98000000-0000-4000-8000-000000000001', 'SCORE_FOR', true),
('98000000-0000-4000-8000-000000000001', 'SCORE_AGAINST', true),
('98000000-0000-4000-8000-000000000001', 'SCORE_DIFFERENCE', true);

INSERT INTO rule_set_tiebreaks (rule_set_id, position, criterion_code, config) VALUES
('98000000-0000-4000-8000-000000000001', 1, 'TABLE_POINTS', NULL),
('98000000-0000-4000-8000-000000000001', 2, 'WINS', NULL),
('98000000-0000-4000-8000-000000000001', 3, 'HEAD_TO_HEAD_TABLE_POINTS', NULL),
('98000000-0000-4000-8000-000000000001', 4, 'SCORE_DIFFERENCE', NULL),
('98000000-0000-4000-8000-000000000001', 5, 'SCORE_FOR', NULL);
