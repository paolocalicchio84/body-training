-- ============================================================
-- MyHealthyLife — Schema v14 (diario giornaliero)
-- Richiede 0001..0013 già applicate.
-- ============================================================

-- Una riga per (user, giorno): note libere + energia opzionale 1–5.
create table if not exists daily_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null,
  body text not null default '',
  energy integer check (energy is null or (energy between 1 and 5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, note_date)
);

create index if not exists daily_notes_user_date_idx
  on daily_notes(user_id, note_date desc);

drop trigger if exists daily_notes_touch on daily_notes;
create trigger daily_notes_touch before update on daily_notes
  for each row execute function public.touch_updated_at();

alter table daily_notes enable row level security;

drop policy if exists daily_notes_select_own on daily_notes;
create policy daily_notes_select_own on daily_notes
  for select using (auth.uid() = user_id);

drop policy if exists daily_notes_insert_own on daily_notes;
create policy daily_notes_insert_own on daily_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists daily_notes_update_own on daily_notes;
create policy daily_notes_update_own on daily_notes
  for update using (auth.uid() = user_id);

drop policy if exists daily_notes_delete_own on daily_notes;
create policy daily_notes_delete_own on daily_notes
  for delete using (auth.uid() = user_id);

-- ============================================================
-- FINE v14.
-- ============================================================
