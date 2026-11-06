-- État de l'app Transio par utilisateur (plan, retours, bilans, activités importées), en JSON.
create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "Lecture de son propre état" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Création de son propre état" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Mise à jour de son propre état" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Suppression de son propre état" on public.user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Jetons Strava, utilisés uniquement par les routes serveur de l'app.
create table public.strava_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.strava_tokens enable row level security;

create policy "Lecture de ses propres jetons Strava" on public.strava_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Création de ses propres jetons Strava" on public.strava_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Mise à jour de ses propres jetons Strava" on public.strava_tokens
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Suppression de ses propres jetons Strava" on public.strava_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);
