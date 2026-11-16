-- Sessions à publier. Heure de Paris. Ajustez puis exécutez dans l'éditeur SQL de Supabase.
-- Session de lancement : L'IA au comptoir, vendredi 4 décembre 2026, 18 h 30, 49 € au lieu de 149 €.
insert into public.sessions (atelier_id, starts_at, capacity, price_override_cents) values
  ('ia-comptoir', '2026-12-04 18:30:00 Europe/Paris', 8, 4900);

-- Exemples de sessions régulières (vendredi 18 h 30 / lundi 19 h) — décommentez et adaptez :
-- insert into public.sessions (atelier_id, starts_at, capacity) values
--   ('google-avis',      '2026-12-07 19:00:00 Europe/Paris', 8),
--   ('reseaux',          '2026-12-11 18:30:00 Europe/Paris', 8),
--   ('zero-paperasse',   '2026-12-14 19:00:00 Europe/Paris', 8),
--   ('maitriser-claude', '2026-12-18 18:30:00 Europe/Paris', 8);
