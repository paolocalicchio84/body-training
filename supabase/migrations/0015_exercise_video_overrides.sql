-- ============================================================
-- MyHealthyLife — Schema v15 (override demo video per utente)
-- I seed globali (user_id null) non sono aggiornabili via RLS:
-- ogni utente salva il proprio video_url in questa tabella.
-- ============================================================

create table if not exists exercise_video_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercise_catalog(id) on delete cascade,
  video_url text,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index if not exists exercise_video_overrides_user_idx
  on exercise_video_overrides(user_id);

drop trigger if exists exercise_video_overrides_touch on exercise_video_overrides;
create trigger exercise_video_overrides_touch before update on exercise_video_overrides
  for each row execute function public.touch_updated_at();

alter table exercise_video_overrides enable row level security;

drop policy if exists exercise_video_overrides_select_own on exercise_video_overrides;
create policy exercise_video_overrides_select_own on exercise_video_overrides
  for select using (auth.uid() = user_id);

drop policy if exists exercise_video_overrides_insert_own on exercise_video_overrides;
create policy exercise_video_overrides_insert_own on exercise_video_overrides
  for insert with check (auth.uid() = user_id);

drop policy if exists exercise_video_overrides_update_own on exercise_video_overrides;
create policy exercise_video_overrides_update_own on exercise_video_overrides
  for update using (auth.uid() = user_id);

drop policy if exists exercise_video_overrides_delete_own on exercise_video_overrides;
create policy exercise_video_overrides_delete_own on exercise_video_overrides
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v15.
-- ============================================================
