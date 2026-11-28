-- R0-08 load users: copies of the demo teacher (same password, `sigrak-demo-2026`),
-- members of the same invented school. Local and staging-like databases only;
-- never run against production. Needs `node ace db:seed` first.
--   psql "postgres://sigrak:sigrak@127.0.0.1:5432/sigrak" -v count=300 -f spikes/k6/seed-load-users.sql
\set ON_ERROR_STOP on
\if :{?count}
\else
  \set count 300
\endif

BEGIN;

INSERT INTO users (name, email, password, nip, created_at, updated_at)
SELECT format('Guru Uji Beban %s', n), format('beban%s@sd-contoh.test', lpad(n::text, 3, '0')),
       t.password, NULL, now(), now()
FROM generate_series(1, :count) AS n
CROSS JOIN (SELECT password FROM users WHERE lower(email) = 'guru@sd-contoh.test') AS t
ON CONFLICT DO NOTHING;

INSERT INTO school_memberships (public_id, school_id, user_id, role, status, started_on, created_at, updated_at)
SELECT gen_random_uuid(), s.id, u.id, 'teacher', 'active', DATE '2026-07-01', now(), now()
FROM users u
CROSS JOIN (SELECT id FROM schools WHERE name = 'SD Negeri Contoh 1') AS s
WHERE u.email LIKE 'beban%@sd-contoh.test'
ON CONFLICT DO NOTHING;

COMMIT;

SELECT count(*) AS load_users FROM users WHERE email LIKE 'beban%@sd-contoh.test';
