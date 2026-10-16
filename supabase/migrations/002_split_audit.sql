-- Split: creator tracking, soft delete and edit/delete audit log.
-- Only needed if you ran schema.sql BEFORE this change (schema.sql already includes it).
-- Safe to run more than once.

alter table expenses add column if not exists created_by uuid references members(id) on delete set null;
alter table expenses add column if not exists edited_at  timestamptz;
alter table expenses add column if not exists deleted_at timestamptz;

create table if not exists expense_changes (
  id         uuid primary key default gen_random_uuid(),
  flat_id    uuid not null references flats(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  changed_by uuid not null references members(id) on delete cascade,
  kind       text not null check (kind in ('edit', 'delete')),
  before     jsonb not null,
  after      jsonb,
  created_at timestamptz not null default now()
);

create table if not exists expense_change_dismissals (
  change_id uuid not null references expense_changes(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (change_id, member_id)
);

create index if not exists expense_changes_flat_id_idx on expense_changes (flat_id);

do $$
declare t text;
begin
  foreach t in array array['expense_changes', 'expense_change_dismissals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open access" on %I', t);
    execute format('create policy "open access" on %I for all using (true) with check (true)', t);
    execute format('grant all on %I to anon, authenticated', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
