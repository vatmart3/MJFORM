-- MJ FORM — réservations
-- Places restantes RÉELLES : capacité − (réservations payées + paiements en cours non expirés).

create table if not exists public.ateliers (
  id text primary key,
  level text not null check (level in ('n1', 'n2')),
  name text not null,
  price_cents integer not null check (price_cents > 0),
  is_pack boolean not null default false
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  atelier_id text not null references public.ateliers (id),
  starts_at timestamptz not null,
  capacity integer not null default 8 check (capacity between 1 and 20),
  -- Prix spécial pour cette session uniquement (ex. session de lancement), en centimes
  price_override_cents integer check (price_override_cents is null or price_override_cents > 0),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists sessions_starts_at_idx on public.sessions (starts_at);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id),
  atelier_id text not null references public.ateliers (id),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled', 'refunded')),
  amount_cents integer not null,
  stripe_checkout_id text unique,
  customer_email text,
  customer_name text,
  customer_phone text,
  -- Une place en attente de paiement est retenue jusqu'à expiration du paiement Stripe
  hold_until timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists bookings_session_idx on public.bookings (session_id, status);

-- Aucun accès direct depuis le navigateur : RLS activé, aucune politique pour anon.
alter table public.ateliers enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;

-- Lecture publique et minimale des disponibilités (aucune donnée client exposée)
create or replace function public.session_availability()
returns table (
  session_id uuid,
  atelier_id text,
  starts_at timestamptz,
  capacity integer,
  seats_left integer,
  price_override_cents integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.atelier_id,
    s.starts_at,
    s.capacity,
    (s.capacity - coalesce((
      select count(*)::int from public.bookings b
      where b.session_id = s.id
        and (b.status = 'paid' or (b.status = 'pending' and b.hold_until > now()))
    ), 0))::int as seats_left,
    s.price_override_cents
  from public.sessions s
  where s.published and s.starts_at > now()
  order by s.starts_at
$$;

revoke all on function public.session_availability() from public;
grant execute on function public.session_availability() to anon, authenticated;

-- Réservation atomique d'une place (appelée par la fonction create-checkout, rôle service)
create or replace function public.hold_seat(p_session_id uuid, p_atelier_id text, p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_taken int;
  v_id uuid;
begin
  select capacity into v_capacity from public.sessions
  where id = p_session_id and published and starts_at > now()
  for update;
  if v_capacity is null then
    raise exception 'session-unavailable';
  end if;
  select count(*) into v_taken from public.bookings
  where session_id = p_session_id
    and (status = 'paid' or (status = 'pending' and hold_until > now()));
  if v_taken >= v_capacity then
    raise exception 'full';
  end if;
  insert into public.bookings (session_id, atelier_id, amount_cents, hold_until)
  values (p_session_id, p_atelier_id, p_amount_cents, now() + interval '31 minutes')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.hold_seat(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.hold_seat(uuid, text, integer) to service_role;

-- Catalogue (mêmes valeurs que src/data/ateliers.ts)
insert into public.ateliers (id, level, name, price_cents, is_pack) values
  ('ia-comptoir',         'n1', 'L’IA au comptoir',                14900, false),
  ('google-avis',         'n1', 'Google et avis',                  12900, false),
  ('reseaux',             'n1', 'Réseaux sociaux',                 14900, false),
  ('zero-paperasse',      'n1', 'Zéro paperasse',                  14900, false),
  ('pack-n1',             'n1', 'Pack Démarrer',                   44900, true),
  ('maitriser-claude',    'n2', 'Maîtriser Claude',                17900, false),
  ('agent-ia',            'n2', 'Créer son agent IA',              34900, false),
  ('automatiser',         'n2', 'Automatiser son activité',        34900, false),
  ('solution-sans-coder', 'n2', 'Créer sa solution IA sans coder', 39000, false),
  ('pack-n2',             'n2', 'Pack Passer à l’IA',              99000, true)
on conflict (id) do update set
  level = excluded.level, name = excluded.name, price_cents = excluded.price_cents, is_pack = excluded.is_pack;
