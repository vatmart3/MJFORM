-- Espace client MJ FORM : formations en ligne, progression, parrainage, ateliers.
-- À exécuter sur un projet Supabase dédié (SQL Editor ou `supabase db push`).
-- Écritures sensibles (achats, accès, récompenses) : uniquement par le webhook Stripe
-- (clé service_role) ou par un administrateur. RLS activé sur toutes les tables.

create extension if not exists pgcrypto with schema extensions;

-- ———————————————————————————————————————————————————————————————
-- Tables
-- ———————————————————————————————————————————————————————————————

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  company text not null default '',
  activity text not null default '',
  phone text not null default '',
  avatar_url text,
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  -- Code de parrainage utilisé à l'inscription (code du parrain)
  referred_by text,
  created_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (email);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'client')),
  primary key (user_id, role)
);

create table public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table public.formations (
  id text primary key default gen_random_uuid()::text,
  slug text not null unique,
  title text not null default 'Nouvelle formation',
  subtitle text not null default '',
  description text not null default '',
  level text not null default 'Initiation' check (level in ('Initiation', 'Intermédiaire', 'Avancé')),
  duration text not null default '3 h',
  -- Prix net en centimes (TVA non applicable)
  price_cents integer not null default 0 check (price_cents >= 0),
  benefits text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.modules (
  id text primary key default gen_random_uuid()::text,
  formation_id text not null references public.formations (id) on delete cascade,
  title text not null default '',
  position integer not null default 0
);
create index modules_formation_idx on public.modules (formation_id);

-- Plan des leçons : lisible par tous les clients connectés (même verrouillé)
create table public.lessons (
  id text primary key default gen_random_uuid()::text,
  module_id text not null references public.modules (id) on delete cascade,
  title text not null default 'Nouvelle leçon',
  kind text not null default 'text' check (kind in ('video', 'slides', 'text')),
  duration_min integer not null default 10 check (duration_min >= 0),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  completed_by_workshop boolean not null default false
);
create index lessons_module_idx on public.lessons (module_id);

-- Contenu protégé : seulement avec un accès à la formation.
-- video_path / slides_path / resources[].url : chemin dans le bucket « formations »
-- (<formation_id>/<fichier>), ou URL directe si la valeur commence par « / » ou « http ».
create table public.lesson_contents (
  lesson_id text primary key references public.lessons (id) on delete cascade,
  body text not null default '',
  video_path text,
  slides_path text,
  allow_download boolean not null default false,
  resources jsonb not null default '[]'::jsonb check (jsonb_typeof(resources) = 'array')
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  formation_id text not null references public.formations (id) on delete cascade,
  source text not null check (source in ('purchase', 'workshop', 'gift')),
  created_at timestamptz not null default now(),
  unique (user_id, formation_id)
);
create index enrollments_formation_idx on public.enrollments (formation_id);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null references public.lessons (id) on delete cascade,
  completed_at timestamptz,
  video_position integer not null default 0 check (video_position >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

-- Achats conservés après suppression d'un compte ou d'une formation (comptabilité)
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  formation_id text references public.formations (id) on delete set null,
  -- Intitulé au moment de l'achat (facture)
  label text not null default '',
  amount_cents integer not null check (amount_cents >= 0),
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  reward_id uuid,
  -- null : formation offerte à 100 %, sans passage par Stripe
  stripe_session_id text unique,
  stripe_invoice_id text,
  created_at timestamptz not null default now()
);
create index purchases_user_idx on public.purchases (user_id);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid references public.profiles (id) on delete set null,
  email text not null,
  status text not null default 'invited' check (status in ('invited', 'signed_up', 'purchased')),
  created_at timestamptz not null default now(),
  unique (referrer_id, email)
);
create index referrals_referee_idx on public.referrals (referee_id);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('percent', 'free')),
  percent integer not null check (percent between 1 and 100),
  label text not null default '',
  origin text not null check (origin in ('tier', 'referee')),
  expires_at timestamptz not null,
  used_at timestamptz,
  -- Coupon Stripe à usage unique, créé au premier passage en caisse
  stripe_coupon_id text,
  created_at timestamptz not null default now()
);
create index rewards_user_idx on public.rewards (user_id);

create table public.workshops (
  id text primary key default gen_random_uuid()::text,
  title text not null default 'Atelier MJ FORM',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default 'Sète',
  capacity integer not null default 8 check (capacity >= 0),
  booking_url text not null default '/#reserver',
  -- Identifiant de la session sur le site (src/data/sessions.ts), ex. 2026-12-04-fetes
  external_id text unique,
  created_at timestamptz not null default now()
);

create table public.workshop_bookings (
  id uuid primary key default gen_random_uuid(),
  workshop_id text not null references public.workshops (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  user_id uuid references public.profiles (id) on delete set null,
  -- Atelier réservé sur le site (plusieurs ateliers possibles à une même date)
  atelier text,
  -- Réservation payée sur le site : idempotence du webhook
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);
create index workshop_bookings_workshop_idx on public.workshop_bookings (workshop_id);

-- Une seule ligne de réglages
create table public.settings (
  id boolean primary key default true check (id),
  tiers jsonb not null check (jsonb_typeof(tiers) = 'array'),
  referee_percent integer not null check (referee_percent between 0 and 100),
  reward_validity_days integer not null check (reward_validity_days > 0)
);

insert into public.settings (id, tiers, referee_percent, reward_validity_days)
values (
  true,
  '[{"threshold":1,"kind":"percent","percent":10},{"threshold":3,"kind":"percent","percent":30},{"threshold":5,"kind":"free","percent":100}]',
  10,
  90
)
on conflict (id) do nothing;

-- ———————————————————————————————————————————————————————————————
-- Fonctions d'accès (utilisées par les politiques RLS)
-- ———————————————————————————————————————————————————————————————

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.has_access(p_formation_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments where user_id = auth.uid() and formation_id = p_formation_id
  )
$$;

create or replace function public.lesson_formation_id(p_lesson_id text)
returns text
language sql stable security definer set search_path = public
as $$
  select m.formation_id from public.lessons l join public.modules m on m.id = l.module_id where l.id = p_lesson_id
$$;

-- Leçon publiée d'une formation publiée
create or replace function public.lesson_is_public(p_lesson_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.formations f on f.id = m.formation_id
    where l.id = p_lesson_id and l.status = 'published' and f.status = 'published'
  )
$$;

-- ———————————————————————————————————————————————————————————————
-- RLS
-- ———————————————————————————————————————————————————————————————

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.referral_codes enable row level security;
alter table public.formations enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_contents enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.purchases enable row level security;
alter table public.referrals enable row level security;
alter table public.rewards enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_bookings enable row level security;
alter table public.settings enable row level security;

-- Administrateurs : accès complet (dans la limite des droits de colonnes ci-dessous)
create policy admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.user_roles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.referral_codes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.formations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.modules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.lesson_contents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.enrollments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.lesson_progress for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.purchases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.referrals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.rewards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.workshops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.workshop_bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Clients : leurs propres lignes
create policy own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy own_select on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.referral_codes for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.enrollments for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.purchases for select to authenticated using (user_id = (select auth.uid()));
create policy own_select on public.rewards for select to authenticated using (user_id = (select auth.uid()));
-- referrals : pas de lecture directe par le client (e-mails des filleuls), voir my_referrals()

create policy own_select on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()));
create policy own_insert on public.lesson_progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.lesson_is_public(lesson_id)
    and public.has_access(public.lesson_formation_id(lesson_id))
  );
create policy own_update on public.lesson_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Catalogue : formations publiées et leur plan (sans le contenu)
create policy published_select on public.formations for select to anon, authenticated using (status = 'published');
create policy published_select on public.modules for select to anon, authenticated
  using (exists (select 1 from public.formations f where f.id = formation_id and f.status = 'published'));
create policy published_select on public.lessons for select to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.modules m join public.formations f on f.id = m.formation_id
      where m.id = module_id and f.status = 'published'
    )
  );
-- Contenu : leçon publiée + accès à la formation
create policy enrolled_select on public.lesson_contents for select to authenticated
  using (public.lesson_is_public(lesson_id) and public.has_access(public.lesson_formation_id(lesson_id)));

create policy public_select on public.workshops for select to anon, authenticated using (true);
create policy public_select on public.settings for select to anon, authenticated using (true);

-- Droits de colonnes : un client ne modifie que ses informations personnelles
-- (jamais email, referred_by, created_at ; rôle et code sont dans d'autres tables).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name, company, activity, phone, avatar_url, notify_email, notify_sms)
  on public.profiles to authenticated;
-- Aucune écriture anonyme
revoke insert, update, delete on all tables in schema public from anon;

-- ———————————————————————————————————————————————————————————————
-- Inscription : profil, rôle, code de parrainage, parrainage
-- ———————————————————————————————————————————————————————————————

-- Code lisible, ex. CAMILLE-7K2 (même format que makeReferralCode)
create or replace function public.make_referral_code(p_first_name text)
returns text
language plpgsql volatile set search_path = public
as $$
declare
  v_base text;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_len int := 3;
  i int;
begin
  v_base := upper(left(regexp_replace(
    translate(coalesce(p_first_name, ''),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸ',
      'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUYY'),
    '[^a-zA-Z]', '', 'g'), 8));
  if v_base = '' then v_base := 'MJ'; end if;
  for attempt in 1..50 loop
    if attempt > 20 then v_len := 5; end if;
    v_code := v_base || '-';
    for i in 1..v_len loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes where code = v_code);
  end loop;
  return v_code;
end
$$;

-- Rattache un filleul à son parrain (code), crée ou met à jour la ligne de parrainage
create or replace function public.link_referral(p_user_id uuid, p_email text, p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_referrer uuid;
begin
  if v_code = '' then return false; end if;
  select user_id into v_referrer from public.referral_codes where code = v_code;
  if v_referrer is null or v_referrer = p_user_id then return false; end if;
  update public.profiles set referred_by = v_code where id = p_user_id and referred_by is null;
  if not found then return false; end if;
  insert into public.referrals (referrer_id, referee_id, email, status)
  values (v_referrer, p_user_id, lower(trim(p_email)), 'signed_up')
  on conflict (referrer_id, email) do update
    set referee_id = excluded.referee_id,
        status = case when public.referrals.status = 'invited' then 'signed_up' else public.referrals.status end;
  return true;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_email text := lower(coalesce(new.email, ''));
  v_full text := trim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', ''));
  v_first text;
  v_last text;
begin
  v_first := coalesce(nullif(trim(v_meta ->> 'first_name'), ''), nullif(trim(v_meta ->> 'given_name'), ''), nullif(split_part(v_full, ' ', 1), ''));
  if v_first is null then
    v_first := initcap(regexp_replace(split_part(v_email, '@', 1), '[._-].*$', ''));
  end if;
  v_last := coalesce(
    nullif(trim(v_meta ->> 'last_name'), ''),
    nullif(trim(v_meta ->> 'family_name'), ''),
    case when position(' ' in v_full) > 0 then trim(substr(v_full, position(' ' in v_full) + 1)) end,
    ''
  );

  insert into public.profiles (id, email, first_name, last_name, phone, avatar_url)
  values (
    new.id, v_email, v_first, v_last,
    coalesce(v_meta ->> 'phone', ''),
    nullif(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture'), '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'client');
  insert into public.referral_codes (user_id, code) values (new.id, public.make_referral_code(v_first));

  if coalesce(v_meta ->> 'ref', '') <> '' then
    perform public.link_referral(new.id, v_email, v_meta ->> 'ref');
  end if;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Connexion Google : le code parrain ne passe pas dans les métadonnées, il est
-- appliqué juste après la première connexion (compte de moins de 24 h, sans achat).
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then return false; end if;
  select email into v_email from public.profiles
  where id = v_uid and referred_by is null and created_at > now() - interval '24 hours';
  if v_email is null then return false; end if;
  if exists (select 1 from public.purchases where user_id = v_uid) then return false; end if;
  return public.link_referral(v_uid, v_email, p_code);
end
$$;

-- Chaque leçon a sa ligne de contenu (sinon elle paraîtrait verrouillée)
create or replace function public.handle_new_lesson()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.lesson_contents (lesson_id) values (new.id) on conflict do nothing;
  return new;
end
$$;

create trigger on_lesson_created
  after insert on public.lessons
  for each row execute function public.handle_new_lesson();

-- ———————————————————————————————————————————————————————————————
-- RPC lues par l'espace client
-- ———————————————————————————————————————————————————————————————

-- Nombre réel de clients ayant accès à chaque formation (preuve sociale)
create or replace function public.learners_count()
returns table (formation_id text, count integer)
language sql stable security definer set search_path = public
as $$
  select e.formation_id, count(*)::int from public.enrollments e group by e.formation_id
$$;

create or replace function public.workshops_with_seats()
returns table (
  id text, title text, starts_at timestamptz, ends_at timestamptz, location text,
  capacity integer, booking_url text, external_id text, seats_left integer
)
language sql stable security definer set search_path = public
as $$
  select w.id, w.title, w.starts_at, w.ends_at, w.location, w.capacity, w.booking_url, w.external_id,
         greatest(0, w.capacity - (select count(*) from public.workshop_bookings b where b.workshop_id = w.id))::int
  from public.workshops w
  order by w.starts_at
$$;

create or replace function public.next_workshop()
returns table (
  id text, title text, starts_at timestamptz, ends_at timestamptz, location text,
  capacity integer, booking_url text, external_id text, seats_left integer
)
language sql stable security definer set search_path = public
as $$
  select * from public.workshops_with_seats() w where w.starts_at > now() order by w.starts_at limit 1
$$;

-- Filleuls du client connecté : prénom + initiale, ou e-mail masqué (jamais l'e-mail en clair)
create or replace function public.my_referrals()
returns table (id uuid, label text, status text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.id,
    case
      when p.id is not null then trim(p.first_name || ' ' || coalesce(nullif(left(p.last_name, 1) || '.', '.'), ''))
      when position('@' in r.email) = 0 then r.email
      else left(split_part(r.email, '@', 1), 2)
        || repeat('•', greatest(1, length(split_part(r.email, '@', 1)) - 2))
        || '@' || split_part(r.email, '@', 2)
    end,
    r.status, r.created_at
  from public.referrals r
  left join public.profiles p on p.id = r.referee_id
  where r.referrer_id = auth.uid()
  order by r.created_at desc
$$;

-- Vue admin des clients (progression calculée en base)
create or replace function public.admin_clients()
returns table (
  profile jsonb, enrollments jsonb, progress jsonb, purchases jsonb,
  referrals_purchased integer, referrals_total integer
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select
    to_jsonb(p) || jsonb_build_object('referral_code', coalesce(rc.code, ''), 'role', 'client'),
    coalesce((
      select jsonb_agg(jsonb_build_object('formation_id', e.formation_id, 'source', e.source, 'created_at', e.created_at) order by e.created_at)
      from public.enrollments e where e.user_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_object_agg(x.formation_id, x.ratio)
      from (
        select e.formation_id,
          case when count(l.id) = 0 then 0
               else (count(lp.lesson_id)::numeric / count(l.id))::float8 end as ratio
        from public.enrollments e
        left join public.modules m on m.formation_id = e.formation_id
        left join public.lessons l on l.module_id = m.id and l.status = 'published'
        left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p.id and lp.completed_at is not null
        where e.user_id = p.id
        group by e.formation_id
      ) x
    ), '{}'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pu.id, 'formation_id', pu.formation_id, 'amount_cents', pu.amount_cents,
        'discount_percent', pu.discount_percent, 'created_at', pu.created_at) order by pu.created_at)
      from public.purchases pu where pu.user_id = p.id
    ), '[]'::jsonb),
    (select count(*)::int from public.referrals r where r.referrer_id = p.id and r.status = 'purchased'),
    (select count(*)::int from public.referrals r where r.referrer_id = p.id)
  from public.profiles p
  left join public.referral_codes rc on rc.user_id = p.id
  where not exists (select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = 'admin')
  order by p.created_at desc;
end
$$;

-- Nouvel ordre des modules ou des leçons (droits de l'appelant : réservé aux admins par RLS)
create or replace function public.admin_reorder(p_kind text, p_ids text[])
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind = 'module' then
    update public.modules m set position = x.ord - 1
    from unnest(p_ids) with ordinality as x(id, ord) where m.id = x.id;
  elsif p_kind = 'lesson' then
    update public.lessons l set position = x.ord - 1
    from unnest(p_ids) with ordinality as x(id, ord) where l.id = x.id;
  else
    raise exception 'bad-kind';
  end if;
end
$$;

-- ———————————————————————————————————————————————————————————————
-- Opérations serveur (clé service_role uniquement : webhook Stripe, api/espace)
-- ———————————————————————————————————————————————————————————————

-- Ouvre l'accès à une formation. Accès venu de l'atelier : leçons « atelier » validées d'office.
create or replace function public.grant_enrollment(p_user_id uuid, p_formation_id text, p_source text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_new boolean;
begin
  insert into public.enrollments (user_id, formation_id, source)
  values (p_user_id, p_formation_id, p_source)
  on conflict (user_id, formation_id) do nothing;
  v_new := found;
  if v_new and p_source = 'workshop' then
    insert into public.lesson_progress (user_id, lesson_id, completed_at)
    select p_user_id, l.id, now()
    from public.lessons l join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation_id and l.completed_by_workshop
    on conflict (user_id, lesson_id) do nothing;
  end if;
  return v_new;
end
$$;

-- Paiement validé : achat, accès, récompense consommée, parrainage et paliers du parrain.
-- Idempotent (stripe_session_id). Renvoie les récompenses de palier créées pour le parrain.
create or replace function public.fulfill_purchase(
  p_user_id uuid,
  p_formation_id text,
  p_amount_cents integer,
  p_discount_percent integer,
  p_reward_id uuid,
  p_stripe_session_id text,
  p_stripe_invoice_id text
)
returns table (reward_id uuid, reward_user_id uuid, reward_percent integer, reward_label text, reward_expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_purchase uuid;
  v_first boolean;
  v_user_exists boolean;
  v_referred_by text;
  v_referrer uuid;
  v_ref uuid;
  v_before int;
  v_settings public.settings;
  v_tier jsonb;
  v_threshold int;
  v_kind text;
  v_percent int;
  v_new public.rewards;
begin
  if p_stripe_session_id is not null
     and exists (select 1 from public.purchases where stripe_session_id = p_stripe_session_id) then
    return;
  end if;

  select exists (select 1 from public.profiles where id = p_user_id) into v_user_exists;
  if v_user_exists then
    -- Sérialise les achats d'un même client
    perform 1 from public.profiles where id = p_user_id for update;
  end if;
  v_first := not exists (select 1 from public.purchases where user_id = p_user_id);

  insert into public.purchases (user_id, formation_id, label, amount_cents, discount_percent, reward_id, stripe_session_id, stripe_invoice_id)
  values (
    case when v_user_exists then p_user_id end,
    p_formation_id,
    coalesce((select title from public.formations where id = p_formation_id), ''),
    p_amount_cents, coalesce(p_discount_percent, 0), p_reward_id, p_stripe_session_id, p_stripe_invoice_id
  )
  on conflict (stripe_session_id) do nothing
  returning id into v_purchase;
  -- Doublon concurrent, ou compte supprimé entre-temps : l'achat est tracé, rien d'autre à faire
  if v_purchase is null or not v_user_exists then return; end if;

  perform public.grant_enrollment(p_user_id, p_formation_id, 'purchase');

  if p_reward_id is not null then
    update public.rewards set used_at = now()
    where id = p_reward_id and user_id = p_user_id and used_at is null;
  end if;

  select referred_by into v_referred_by from public.profiles where id = p_user_id;
  if not v_first or v_referred_by is null then return; end if;

  select user_id into v_referrer from public.referral_codes where code = v_referred_by;
  if v_referrer is null then return; end if;
  -- Sérialise le décompte des filleuls du parrain
  perform 1 from public.profiles where id = v_referrer for update;

  select r.id into v_ref from public.referrals r
  where r.referrer_id = v_referrer and r.referee_id = p_user_id and r.status <> 'purchased';
  if v_ref is null then return; end if;

  select count(*) into v_before from public.referrals r where r.referrer_id = v_referrer and r.status = 'purchased';
  update public.referrals set status = 'purchased' where id = v_ref;

  select * into v_settings from public.settings limit 1;
  for v_tier in select * from jsonb_array_elements(coalesce(v_settings.tiers, '[]'::jsonb)) loop
    v_threshold := (v_tier ->> 'threshold')::int;
    if v_before < v_threshold and v_before + 1 >= v_threshold then
      v_kind := coalesce(v_tier ->> 'kind', 'percent');
      v_percent := case when v_kind = 'free' then 100 else (v_tier ->> 'percent')::int end;
      insert into public.rewards (user_id, kind, percent, label, origin, expires_at)
      values (
        v_referrer, v_kind, v_percent,
        case when v_kind = 'free' then 'une formation offerte' else '-' || v_percent || ' %' end
          || ' · ' || v_threshold || ' filleul' || case when v_threshold > 1 then 's' else '' end,
        'tier',
        now() + make_interval(days => coalesce(v_settings.reward_validity_days, 90))
      )
      returning * into v_new;
      reward_id := v_new.id;
      reward_user_id := v_new.user_id;
      reward_percent := v_new.percent;
      reward_label := v_new.label;
      reward_expires_at := v_new.expires_at;
      return next;
    end if;
  end loop;
end
$$;

-- Réservation payée sur le site (webhook Stripe) → inscrit à l'atelier correspondant
create or replace function public.record_site_booking(
  p_external_id text, p_name text, p_email text, p_phone text, p_atelier text, p_stripe_session_id text
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_workshop text;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  select id into v_workshop from public.workshops where external_id = p_external_id;
  if v_workshop is null then return false; end if;
  insert into public.workshop_bookings (workshop_id, name, email, phone, atelier, stripe_session_id, user_id)
  values (
    v_workshop, coalesce(p_name, ''), v_email, coalesce(p_phone, ''), p_atelier, p_stripe_session_id,
    (select id from public.profiles where email = v_email and v_email <> '' limit 1)
  )
  on conflict (stripe_session_id) do nothing;
  return found;
end
$$;

-- ———————————————————————————————————————————————————————————————
-- Droits d'exécution
-- ———————————————————————————————————————————————————————————————

revoke execute on function
  public.make_referral_code(text),
  public.link_referral(uuid, text, text),
  public.handle_new_user(),
  public.handle_user_email_change(),
  public.handle_new_lesson(),
  public.grant_enrollment(uuid, text, text),
  public.fulfill_purchase(uuid, text, integer, integer, uuid, text, text),
  public.record_site_booking(text, text, text, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.grant_enrollment(uuid, text, text),
  public.fulfill_purchase(uuid, text, integer, integer, uuid, text, text),
  public.record_site_booking(text, text, text, text, text, text)
to service_role;

revoke execute on function public.claim_referral(text), public.my_referrals(), public.admin_clients(), public.admin_reorder(text, text[])
from public, anon;
grant execute on function public.claim_referral(text), public.my_referrals(), public.admin_clients(), public.admin_reorder(text, text[])
to authenticated;

grant execute on function
  public.is_admin(), public.has_access(text), public.lesson_formation_id(text), public.lesson_is_public(text),
  public.learners_count(), public.workshops_with_seats(), public.next_workshop()
to anon, authenticated, service_role;

-- ———————————————————————————————————————————————————————————————
-- Stockage
-- ———————————————————————————————————————————————————————————————

-- Supports de cours privés : <formation_id>/<fichier>, lus via URL signée
insert into storage.buckets (id, name, public) values ('formations', 'formations', false)
on conflict (id) do nothing;
-- Photos de profil publiques : <user_id>/<fichier>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy formations_read on storage.objects for select to authenticated
  using (bucket_id = 'formations' and (public.is_admin() or public.has_access((storage.foldername(name))[1])));
create policy formations_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'formations' and public.is_admin());
create policy formations_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'formations' and public.is_admin()) with check (bucket_id = 'formations' and public.is_admin());
create policy formations_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'formations' and public.is_admin());

create policy avatars_own_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_own_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
