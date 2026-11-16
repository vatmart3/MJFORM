-- Formats « En présentiel » et « En ligne »
-- • formations.site_ateliers : ateliers du site (src/data/ateliers.ts) qui donnent accès à la formation
-- • enrollments : format, date de fin d'accès (en ligne : 12 mois), session réservée (présentiel),
--   paiement Stripe d'origine (pour déduire le montant lors du passage au présentiel)

alter table public.formations
  add column if not exists site_ateliers text[] not null default '{}';

alter table public.enrollments
  add column if not exists format text check (format in ('presentiel', 'online')),
  add column if not exists expires_at timestamptz,
  add column if not exists site_atelier text,
  add column if not exists session_external_id text,
  add column if not exists session_label text,
  add column if not exists session_address text,
  add column if not exists stripe_session_id text,
  add column if not exists amount_cents integer check (amount_cents is null or amount_cents >= 0);

-- Un accès « en ligne » expiré ne donne plus accès au contenu (RLS, stockage)
create or replace function public.has_access(p_formation_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and formation_id = p_formation_id
      and (expires_at is null or expires_at > now())
  )
$$;

-- Achat sur le site (webhook Stripe, rôle service) : droits selon le format.
-- Présentiel : accès sans limite + date et adresse de la session. En ligne : accès 12 mois.
-- Le présentiel l'emporte toujours ; un nouvel achat en ligne prolonge l'accès.
-- Renvoie le nombre de formations ouvertes, ou -1 si aucun compte n'a cet e-mail (à inviter d'abord).
create or replace function public.grant_site_purchase(
  p_email text,
  p_atelier text,
  p_format text,
  p_session_external_id text,
  p_session_label text,
  p_session_address text,
  p_amount_cents integer,
  p_stripe_session_id text
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid;
  v_count integer := 0;
  v_formation text;
begin
  if p_format not in ('presentiel', 'online') then
    raise exception 'format invalide : %', p_format;
  end if;
  select id into v_user from public.profiles where email = lower(trim(coalesce(p_email, '')));
  if v_user is null then
    return -1;
  end if;
  for v_formation in select id from public.formations where p_atelier = any (site_ateliers) loop
    insert into public.enrollments (
      user_id, formation_id, source, format, expires_at, site_atelier,
      session_external_id, session_label, session_address, stripe_session_id, amount_cents
    )
    values (
      v_user, v_formation, 'purchase', p_format,
      case when p_format = 'online' then now() + interval '12 months' end,
      p_atelier, p_session_external_id, p_session_label, p_session_address, p_stripe_session_id, p_amount_cents
    )
    on conflict (user_id, formation_id) do update set
      format = case
        when excluded.format = 'presentiel' or public.enrollments.format = 'presentiel' then 'presentiel'
        else 'online'
      end,
      expires_at = case
        when excluded.format = 'presentiel' then null
        -- accès déjà illimité (atelier, offert, présentiel) : on n'ajoute pas de limite
        when public.enrollments.expires_at is null and coalesce(public.enrollments.format, '') <> 'online' then null
        -- même paiement rejoué par Stripe : rien ne change
        when public.enrollments.stripe_session_id = excluded.stripe_session_id then public.enrollments.expires_at
        else greatest(coalesce(public.enrollments.expires_at, now()), now()) + interval '12 months'
      end,
      site_atelier = excluded.site_atelier,
      session_external_id = coalesce(excluded.session_external_id, public.enrollments.session_external_id),
      session_label = coalesce(excluded.session_label, public.enrollments.session_label),
      session_address = coalesce(excluded.session_address, public.enrollments.session_address),
      stripe_session_id = excluded.stripe_session_id,
      amount_cents = excluded.amount_cents;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

revoke execute on function public.grant_site_purchase(text, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.grant_site_purchase(text, text, text, text, text, text, integer, text) to service_role;
