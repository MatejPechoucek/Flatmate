-- Flatmate app schema. Paste into the Supabase SQL editor and run once.
-- Money is always integer pence. Security is permissive (anyone with the anon key
-- can read/write); tighten RLS before real use.

create extension if not exists pgcrypto;

-- ─── Core ────────────────────────────────────────────────────────────────────

create table flats (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  invite_code       text not null unique,
  buyout_rate_pence int  not null default 100,
  created_at        timestamptz not null default now()
);

create table members (
  id         uuid primary key default gen_random_uuid(),
  flat_id    uuid not null references flats(id) on delete cascade,
  name       text not null,
  pay_handle text,                     -- monzo.me / paypal.me username
  created_at timestamptz not null default now()
);

-- ─── Split ───────────────────────────────────────────────────────────────────

create table recurring_expenses (
  id           uuid primary key default gen_random_uuid(),
  flat_id      uuid not null references flats(id) on delete cascade,
  payer_id     uuid not null references members(id) on delete cascade,
  description  text not null,
  amount_pence int  not null check (amount_pence > 0),
  split_type   text not null default 'equal' check (split_type in ('equal', 'amount', 'percent')),
  split_config jsonb not null default '{}',  -- { member_id: pence | percent }
  interval     text not null check (interval in ('weekly', 'monthly')),
  next_due_at  timestamptz not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table expenses (
  id                   uuid primary key default gen_random_uuid(),
  flat_id              uuid not null references flats(id) on delete cascade,
  payer_id             uuid not null references members(id) on delete cascade,
  description          text not null,
  amount_pence         int  not null check (amount_pence > 0),
  split_type           text not null default 'equal' check (split_type in ('equal', 'amount', 'percent')),
  recurring_expense_id uuid references recurring_expenses(id) on delete set null,
  bounty_id            uuid,  -- set when the expense was created by a chore buyout
  due_at               timestamptz,
  created_at           timestamptz not null default now(),
  unique (recurring_expense_id, due_at)
);

-- Final pence owed by each member, whatever the split mode.
create table expense_shares (
  expense_id   uuid not null references expenses(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  amount_pence int  not null check (amount_pence >= 0),
  primary key (expense_id, member_id)
);

create table settlements (
  id           uuid primary key default gen_random_uuid(),
  flat_id      uuid not null references flats(id) on delete cascade,
  from_member  uuid not null references members(id) on delete cascade,
  to_member    uuid not null references members(id) on delete cascade,
  amount_pence int  not null check (amount_pence > 0),
  created_at   timestamptz not null default now()
);

-- ─── Chores ──────────────────────────────────────────────────────────────────

create table chores (
  id                 uuid primary key default gen_random_uuid(),
  flat_id            uuid not null references flats(id) on delete cascade,
  title              text not null,
  weight             int  not null check (weight between 1 and 5),
  created_by         uuid references members(id) on delete set null,
  kind               text not null check (kind in ('recurring', 'one_off')),
  interval_days      int,
  next_due_at        timestamptz,
  weight_proposed_at timestamptz not null default now(),
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create table weight_objections (
  id              uuid primary key default gen_random_uuid(),
  chore_id        uuid not null references chores(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  proposed_weight int  not null check (proposed_weight between 1 and 5),
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table weight_votes (
  objection_id uuid not null references weight_objections(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  weight       int  not null check (weight between 1 and 5),
  primary key (objection_id, member_id)
);

create table chore_tasks (
  id                 uuid primary key default gen_random_uuid(),
  chore_id           uuid not null references chores(id) on delete cascade,
  flat_id            uuid not null references flats(id) on delete cascade,
  assigned_to        uuid references members(id) on delete set null,
  due_at             timestamptz,
  status             text not null default 'open' check (status in ('open', 'done')),
  completed_by       uuid references members(id) on delete set null,
  completed_at       timestamptz,
  points_credited_to uuid references members(id) on delete set null, -- payer in a buyout, else the doer
  created_at         timestamptz not null default now(),
  unique (chore_id, due_at)
);

create table bounties (
  id           uuid primary key default gen_random_uuid(),
  flat_id      uuid not null references flats(id) on delete cascade,
  task_id      uuid not null references chore_tasks(id) on delete cascade,
  offered_by   uuid not null references members(id) on delete cascade,
  amount_pence int  not null check (amount_pence > 0),
  status       text not null default 'open' check (status in ('open', 'accepted', 'cancelled')),
  accepted_by  uuid references members(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table expenses
  add constraint expenses_bounty_fk foreign key (bounty_id) references bounties(id) on delete set null;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index on members (flat_id);
create index on expenses (flat_id);
create index on settlements (flat_id);
create index on recurring_expenses (flat_id);
create index on chores (flat_id);
create index on chore_tasks (flat_id);
create index on bounties (flat_id);

-- ─── Access (hackathon-permissive) + Realtime ────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'flats', 'members', 'recurring_expenses', 'expenses', 'expense_shares', 'settlements',
    'chores', 'weight_objections', 'weight_votes', 'chore_tasks', 'bounties'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "open access" on %I for all using (true) with check (true)', t);
    execute format('grant all on %I to anon, authenticated', t);
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;
