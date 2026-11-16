-- Contenu de départ de l'espace client : les 3 formations de démonstration (src/app/data/seed.ts)
-- et les ateliers du site (src/data/sessions.ts). Reprend exactement les données de seed.ts.
-- Rejouable : les lignes existantes ne sont pas modifiées (on conflict do nothing).
--
-- Vidéos et supports : une valeur qui commence par « / » ou « http » est une URL directe
-- (fichiers publics du site) ; toute autre valeur est un chemin dans le bucket privé
-- « formations » (<formation_id>/<fichier>), servi par URL signée valable 1 h.
-- Remplacez ces fichiers de démonstration depuis l'admin (téléversement) avant la mise en ligne.

begin;

-- ——— Formations ———
insert into public.formations (id, slug, title, subtitle, description, level, duration, price_cents, benefits, status, position) values
  ('f-initiation', 'initiation-ia', 'Atelier d’initiation IA', 'Les bons réflexes avec ChatGPT et Claude', 'L’atelier de 3 heures en présentiel à Sète, puis tout ce qu’il faut pour continuer chez vous : les supports, les consignes prêtes à copier et des exercices sur vos vrais comptes.', 'Initiation', '3 h', 4900, array['Répondre à vos avis Google en quelques minutes', 'Préparer un mois de publications en une matinée', 'Rédiger devis et e-mails sans y passer la soirée']::text[], 'published', 0),
  ('f-claude', 'maitriser-claude', 'Maîtriser Claude', 'Projets, documents et consignes durables', 'Configurez Claude une fois pour toutes avec vos tarifs, vos horaires et votre ton. Il répond ensuite comme quelqu’un qui connaît votre commerce.', 'Intermédiaire', '3 h', 17900, array['Un assistant qui connaît vos tarifs et vos produits', 'Des réponses à votre ton, sans tout réexpliquer', 'Une bibliothèque de demandes prêtes pour votre métier']::text[], 'published', 1),
  ('f-agents', 'agents-ia', 'Créer ses agents IA', 'Un assistant qui répond à vos clients', 'Construisez un agent nourri de vos informations, testez-le sur de vraies questions, puis branchez-le sur votre site ou votre messagerie.', 'Avancé', '6 h', 34900, array['Un agent qui répond aux questions fréquentes, même à 23 h', 'Les réservations et demandes notées sans vous', 'Testé sur les vraies questions de vos clients']::text[], 'published', 2)
on conflict (id) do nothing;

-- ——— Modules ———
insert into public.modules (id, formation_id, title, position) values
  ('m-init-1', 'f-initiation', 'L’atelier', 0),
  ('m-init-2', 'f-initiation', 'Les bons réflexes', 1),
  ('m-init-3', 'f-initiation', 'Passer à l’action', 2),
  ('m-claude-1', 'f-claude', 'Prendre en main Claude', 0),
  ('m-claude-2', 'f-claude', 'Travailler avec vos documents', 1),
  ('m-claude-3', 'f-claude', 'Vos consignes permanentes', 2),
  ('m-agents-1', 'f-agents', 'Comprendre les agents', 0),
  ('m-agents-2', 'f-agents', 'Construire votre premier agent', 1),
  ('m-agents-3', 'f-agents', 'Le brancher à votre commerce', 2)
on conflict (id) do nothing;

-- ——— Leçons (plan) ———
insert into public.lessons (id, module_id, title, kind, duration_min, position, status, completed_by_workshop) values
  ('l-init-1', 'm-init-1', 'Votre atelier en présentiel', 'text', 180, 0, 'published', true),
  ('l-init-2', 'm-init-2', 'L’IA pour votre commerce, en une minute', 'video', 1, 0, 'published', false),
  ('l-init-3', 'm-init-2', 'Le support de l’atelier', 'slides', 10, 1, 'published', false),
  ('l-init-4', 'm-init-2', 'Vos 10 consignes prêtes à copier', 'text', 15, 2, 'published', false),
  ('l-init-5', 'm-init-3', 'Répondre à tous vos avis en 10 minutes', 'text', 15, 0, 'published', false),
  ('l-init-6', 'm-init-3', 'Préparer un mois de publications', 'text', 20, 1, 'published', false),
  ('l-claude-1', 'm-claude-1', 'Claude ou ChatGPT : lequel pour quoi ?', 'text', 10, 0, 'published', false),
  ('l-claude-2', 'm-claude-1', 'Vos premiers projets', 'video', 12, 1, 'published', false),
  ('l-claude-3', 'm-claude-2', 'Donner vos tarifs, horaires et produits', 'text', 15, 0, 'published', false),
  ('l-claude-4', 'm-claude-2', 'Le support : projets et consignes', 'slides', 10, 1, 'published', false),
  ('l-claude-5', 'm-claude-3', 'Écrire des consignes à votre ton', 'text', 15, 0, 'published', false),
  ('l-claude-6', 'm-claude-3', 'Bibliothèque de demandes métier', 'text', 20, 1, 'published', false),
  ('l-agents-1', 'm-agents-1', 'Ce qu’un agent peut faire, et ne doit pas faire', 'text', 15, 0, 'published', false),
  ('l-agents-2', 'm-agents-1', 'Exemple : l’agent d’un restaurant', 'video', 8, 1, 'published', false),
  ('l-agents-3', 'm-agents-2', 'Rassembler ses connaissances', 'text', 30, 0, 'published', false),
  ('l-agents-4', 'm-agents-2', 'Le tester sur 20 vraies questions', 'text', 40, 1, 'published', false),
  ('l-agents-5', 'm-agents-3', 'Le support : mise en ligne', 'slides', 10, 0, 'published', false),
  ('l-agents-6', 'm-agents-3', 'Suivre et améliorer son agent', 'text', 20, 1, 'published', false)
on conflict (id) do nothing;

-- ——— Contenu des leçons (protégé) ———
-- La ligne vide est créée par le déclencheur on_lesson_created : on la complète.
insert into public.lesson_contents (lesson_id, body, video_path, slides_path, allow_download, resources) values
  ('l-init-1', '## Ce que vous avez fait pendant l’atelier

Trois heures, votre téléphone, vos vrais comptes. Cette leçon est validée d’office : vous l’avez suivie en présentiel.

- ChatGPT et Claude installés et réglés sur votre téléphone
- Vos premiers avis Google répondus
- Vos premières publications préparées

## La suite

Les leçons suivantes reprennent chaque point, à votre rythme. Comptez **15 minutes par leçon**.', null, null, false, '[]'::jsonb),
  ('l-init-2', '## À retenir

L’IA prépare, **vous validez**. Rien ne part sans votre relecture.

Regardez la vidéo, puis passez au support de l’atelier.', '/video/mjform-presentation-720.mp4', null, false, '[]'::jsonb),
  ('l-init-3', 'Le support complet de l’atelier, à feuilleter en plein écran.

Utilisez les **flèches du clavier** ou **faites glisser** sur téléphone. Vous pouvez le télécharger.', null, '/espace-demo/support-demo.pdf', true, '[]'::jsonb),
  ('l-init-4', '## Comment s’en servir

Copiez une consigne, collez-la dans ChatGPT ou Claude, remplacez ce qui est entre crochets.

1. **Avis Google** : « Réponds à cet avis client à mon ton, chaleureux et bref : [avis]. »
2. **Publication** : « Écris une publication Instagram pour annoncer [nouveauté], 3 lignes, une question à la fin. »
3. **Devis** : « Transforme ces notes en devis clair : [notes]. »
4. **E-mail** : « Réponds poliment à ce client qui demande [demande]. »
5. **Horaires** : « Rédige le message d’horaires des fêtes pour ma fiche Google : [horaires]. »

La fiche complète est dans les ressources.', null, null, false, '[{"id":"r-init-1","name":"Fiche « 10 consignes »","url":"/espace-demo/support-demo.pdf","size":"120 Ko"}]'::jsonb),
  ('l-init-5', '## La méthode

1. Ouvrez votre fiche Google, onglet **Avis**.
2. Copiez les avis sans réponse, un par un.
3. Demandez une réponse **à votre ton**, puis relisez.

## Les pièges

- Ne jamais publier sans relire
- Répondre aussi aux avis négatifs, calmement et sans se justifier', null, null, false, '[]'::jsonb),
  ('l-init-6', '## En une séance

Listez 4 sujets : un produit, une coulisse, un avis client, une info pratique.

Demandez 4 publications, une par semaine, puis programmez-les. **20 minutes par semaine suffisent ensuite.**', null, null, false, '[]'::jsonb),
  ('l-claude-1', '## En bref

Les deux savent écrire. Claude excelle sur les **longs documents** et les **consignes durables**. Gardez celui que vous ouvrez le plus facilement.', null, null, false, '[]'::jsonb),
  ('l-claude-2', 'Créez un projet par usage : avis, publications, devis.', '/video/mjform-presentation-720.mp4', null, false, '[]'::jsonb),
  ('l-claude-3', '## Les documents à préparer

- Votre carte ou vos tarifs
- Vos horaires, y compris exceptionnels
- Trois exemples de messages que vous aimez', null, null, false, '[]'::jsonb),
  ('l-claude-4', 'Le support complet, en plein écran.', null, '/espace-demo/support-demo.pdf', false, '[]'::jsonb),
  ('l-claude-5', 'Décrivez votre ton en trois mots, avec un exemple de phrase.', null, null, false, '[]'::jsonb),
  ('l-claude-6', 'Vingt demandes classées par usage, à copier.', null, null, false, '[]'::jsonb),
  ('l-agents-1', 'Un agent répond à partir de ce que vous lui donnez. Il ne doit jamais inventer un prix ni une disponibilité.', null, null, false, '[]'::jsonb),
  ('l-agents-2', 'Un agent en conditions réelles.', '/video/mjform-presentation-720.mp4', null, false, '[]'::jsonb),
  ('l-agents-3', 'Horaires, tarifs, produits, questions fréquentes : un seul document clair.', null, null, false, '[]'::jsonb),
  ('l-agents-4', 'Notez chaque réponse : juste, à corriger, à interdire.', null, null, false, '[]'::jsonb),
  ('l-agents-5', 'Les options de mise en ligne, pas à pas.', null, '/espace-demo/support-demo.pdf', true, '[]'::jsonb),
  ('l-agents-6', 'Relisez les conversations chaque semaine pendant un mois.', null, null, false, '[]'::jsonb)
on conflict (lesson_id) do update set
  body = excluded.body, video_path = excluded.video_path, slides_path = excluded.slides_path,
  allow_download = excluded.allow_download, resources = excluded.resources
where public.lesson_contents.body = '' and public.lesson_contents.video_path is null and public.lesson_contents.slides_path is null;

-- ——— Ateliers (sessions du site) ———
insert into public.workshops (id, external_id, title, starts_at, ends_at, location, capacity, booking_url) values
  ('w-2026-12-04-fetes', '2026-12-04-fetes', 'Atelier spécial fêtes', '2026-12-04T18:30:00+01:00', '2026-12-04T21:30:00+01:00', 'Sète', 8, '/?pilote'),
  ('w-2027-01-15', '2027-01-15', 'Atelier MJ FORM', '2027-01-15T18:30:00+01:00', null, 'Sète', 8, '/#reserver'),
  ('w-2027-01-25', '2027-01-25', 'Atelier MJ FORM', '2027-01-25T19:00:00+01:00', null, 'Sète', 8, '/#reserver')
on conflict (id) do nothing;

-- ——— Ateliers du site qui ouvrent chaque formation (achat présentiel ou en ligne) ———
-- Nécessite la migration 20261120000000_formats.sql. Les packs ouvrent toutes les formations de leur niveau.
update public.formations set site_ateliers = array['fetes', 'ia-comptoir', 'google-avis', 'reseaux', 'zero-paperasse', 'pack-n1']
  where id = 'f-initiation' and site_ateliers = '{}';
update public.formations set site_ateliers = array['maitriser-claude', 'pack-n2']
  where id = 'f-claude' and site_ateliers = '{}';
update public.formations set site_ateliers = array['agent-ia', 'automatiser', 'solution-sans-coder', 'pack-n2']
  where id = 'f-agents' and site_ateliers = '{}';

commit;

-- ———————————————————————————————————————————————————————————————
-- FACULTATIF · Comptes de démonstration (mêmes identifiants que le mode démo)
--   client@demo.mjform.fr / demo1234  (cliente « Camille », accès à l'atelier d'initiation)
--   admin@demo.mjform.fr  / admin1234 (administrateur)
-- Désactivé par défaut. Pour les créer (projet de test UNIQUEMENT, jamais en production :
-- les mots de passe sont publics), exécuter dans la même session SQL :
--   set mjform.demo_users = 'on';
-- puis ce fichier. Supprimer ensuite ces comptes : Authentication → Users.
-- ———————————————————————————————————————————————————————————————
do $$
declare
  v_client uuid := '00000000-0000-4000-a000-00000000c001';
  v_admin uuid := '00000000-0000-4000-a000-00000000a001';
  v_user record;
begin
  if coalesce(current_setting('mjform.demo_users', true), '') <> 'on' then
    raise notice 'Comptes de démonstration ignorés (set mjform.demo_users = ''on'' pour les créer).';
    return;
  end if;

  for v_user in
    select * from (values
      (v_client, 'client@demo.mjform.fr', 'demo1234', '{"first_name":"Camille","last_name":"Martin"}'::jsonb),
      (v_admin, 'admin@demo.mjform.fr', 'admin1234', '{"first_name":"Jérémy","last_name":"Vatuone"}'::jsonb)
    ) as t(id, email, password, meta)
  loop
    if not exists (select 1 from auth.users where id = v_user.id or email = v_user.email) then
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated', v_user.email,
        extensions.crypt(v_user.password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, v_user.meta, now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), v_user.id, v_user.id::text,
        jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;

  -- Profil de démonstration, code de parrainage et accès « atelier » (leçon 1 validée d'office)
  update public.profiles set company = 'Boulangerie du Port', activity = 'Boulangerie', phone = '06 00 00 00 00' where id = v_client;
  update public.referral_codes set code = 'CAMILLE-7K2' where user_id = v_client
    and not exists (select 1 from public.referral_codes where code = 'CAMILLE-7K2');
  perform public.grant_enrollment(v_client, 'f-initiation', 'workshop');

  update public.profiles set company = 'MJ FORM', activity = 'Formateur' where id = v_admin;
  insert into public.user_roles (user_id, role) values (v_admin, 'admin') on conflict do nothing;
end
$$;

-- ———————————————————————————————————————————————————————————————
-- Premier administrateur (compte réel) : se connecter une première fois sur /espace/
-- (lien magique ou Google), puis exécuter en remplaçant l'e-mail :
--
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from public.profiles where email = lower('prenom@exemple.fr')
--   on conflict do nothing;
--
-- Retirer le rôle : delete from public.user_roles where role = 'admin' and user_id = '<uuid>';
-- ———————————————————————————————————————————————————————————————
