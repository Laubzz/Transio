-- Lien d'abonnement privé (Google Agenda, Apple Calendrier…) au plan d'un utilisateur.
create table public.calendar_feeds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

create policy "Lecture de son propre lien d'agenda" on public.calendar_feeds
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Création de son propre lien d'agenda" on public.calendar_feeds
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Suppression de son propre lien d'agenda" on public.calendar_feeds
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Lecture du plan par l'agenda abonné : seul le jeton secret donne accès, à un seul état.
-- Volontairement appelable par anon (alerte « security definer » attendue).
create function public.calendar_state(feed_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.state
  from public.calendar_feeds f
  join public.user_state s on s.user_id = f.user_id
  where f.token = feed_token
    and length(feed_token) = 32;
$$;

revoke all on function public.calendar_state(text) from public;
grant execute on function public.calendar_state(text) to anon;
comment on function public.calendar_state(text) is
  'Volontairement appelable par anon : accès limité au plan associé à un jeton secret de 32 caractères (lien d''abonnement d''agenda).';
