-- Chores: weight snapshots, fairness/assignment, completion, buyouts and catch-up.
-- schema.sql already includes all of this; this migration upgrades a database that
-- was created before the chore functions existed. Safe to run more than once.

begin;

alter table chore_tasks add column if not exists weight_snapshot integer;

-- Legacy history can only use the weight currently on the chore; new tasks always snapshot.
update chore_tasks t set weight_snapshot = c.weight
from chores c where c.id = t.chore_id and t.weight_snapshot is null;

alter table chore_tasks alter column weight_snapshot set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_weight_range' and conrelid = 'public.chore_tasks'::regclass
  ) then
    alter table public.chore_tasks
      add constraint task_weight_range check (weight_snapshot between 1 and 5);
  end if;
end $$;

create unique index if not exists expenses_one_bounty on expenses (bounty_id) where bounty_id is not null;
create unique index if not exists bounties_one_live_offer on bounties (task_id) where status in ('open', 'accepted');
create index if not exists chore_tasks_fairness on chore_tasks (flat_id, points_credited_to, completed_at) where status = 'done';
create index if not exists chore_tasks_physical_history on chore_tasks (chore_id, completed_by, completed_at) where status = 'done';
create index if not exists chores_due on chores (flat_id, next_due_at) where active and kind = 'recurring';

create or replace function public.require_chore_member(p_flat_id uuid, p_member_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.members where id=p_member_id and flat_id=p_flat_id) then
    raise exception 'Member does not belong to this flat' using errcode='42501';
  end if;
end $$;

create or replace function public.chore_fairness(p_flat_id uuid)
returns table(member_id uuid, fairness_score bigint)
language sql stable set search_path = '' as $$
  select m.id, coalesce(sum(t.weight_snapshot),0)::bigint
  from public.members m left join public.chore_tasks t
    on t.points_credited_to=m.id and t.flat_id=m.flat_id and t.status='done'
    and t.completed_at > now() - interval '28 days' and t.completed_at <= now()
  where m.flat_id=p_flat_id group by m.id
$$;

create or replace function public.choose_chore_assignee(p_flat_id uuid, p_chore_id uuid) returns uuid
language sql volatile set search_path = '' as $$
  select f.member_id from public.chore_fairness(p_flat_id) f
  left join lateral (
    select max(t.completed_at) as last_done from public.chore_tasks t
    where t.chore_id=p_chore_id and t.flat_id=p_flat_id and t.completed_by=f.member_id and t.status='done'
  ) h on true
  order by f.fairness_score, h.last_done asc nulls first, random() limit 1
$$;

create or replace function public.generate_chore_tasks(p_chore_id uuid) returns uuid[]
language plpgsql set search_path = '' as $$
declare c public.chores%rowtype; v_task uuid; v_ids uuid[] := '{}';
begin
  select * into strict c from public.chores where id=p_chore_id for update;
  if c.kind <> 'recurring' or not c.active then return v_ids; end if;
  if c.interval_days is null or c.interval_days < 1 or c.next_due_at is null or not isfinite(c.next_due_at) then
    raise exception 'Invalid recurring schedule';
  end if;
  while c.next_due_at <= now() loop
    insert into public.chore_tasks(chore_id,flat_id,assigned_to,due_at,weight_snapshot)
    values(c.id,c.flat_id,public.choose_chore_assignee(c.flat_id,c.id),c.next_due_at,c.weight)
    on conflict (chore_id,due_at) do nothing returning id into v_task;
    if v_task is not null then v_ids := array_append(v_ids,v_task); end if;
    c.next_due_at := c.next_due_at + c.interval_days * interval '24 hours';
  end loop;
  update public.chores set next_due_at=c.next_due_at where id=c.id;
  return v_ids;
end $$;

create or replace function public.create_chore(p_flat_id uuid, p_member_id uuid, p_title text, p_weight integer,
  p_kind text, p_interval_days integer default null, p_due_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_chore uuid; v_task uuid; v_tasks uuid[] := '{}';
begin
  perform public.require_chore_member(p_flat_id,p_member_id);
  perform 1 from public.flats where id=p_flat_id for update;
  if p_title is null or length(trim(p_title)) not between 1 and 200 or p_weight is null or p_weight not between 1 and 5 then
    raise exception 'A title and integer weight from 1 to 5 are required';
  end if;
  if p_kind is null or p_kind not in ('one_off','recurring') then raise exception 'Invalid chore kind'; end if;
  if p_kind='recurring' and (p_interval_days is null or p_interval_days < 1 or p_due_at is null) then
    raise exception 'Recurring chores need a positive interval and first due date';
  end if;
  if p_due_at is not null and not isfinite(p_due_at) then raise exception 'Due date must be finite'; end if;
  if p_kind='one_off' and p_interval_days is not null then raise exception 'One-off chores cannot have an interval'; end if;
  insert into public.chores(flat_id,title,weight,created_by,kind,interval_days,next_due_at)
    values(p_flat_id,trim(p_title),p_weight,p_member_id,p_kind,p_interval_days,case when p_kind='recurring' then p_due_at end)
    returning id into v_chore;
  if p_kind='one_off' then
    insert into public.chore_tasks(chore_id,flat_id,assigned_to,due_at,weight_snapshot)
      values(v_chore,p_flat_id,public.choose_chore_assignee(p_flat_id,v_chore),p_due_at,p_weight) returning id into v_task;
    v_tasks := array[v_task];
  else v_tasks := public.generate_chore_tasks(v_chore);
  end if;
  return jsonb_build_object('flat_id',p_flat_id,'chore_id',v_chore,'task_ids',v_tasks,'chore',(select to_jsonb(c) from public.chores c where c.id=v_chore));
end $$;

create or replace function public.catch_up_chores(p_flat_id uuid, p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record; v_tasks uuid[] := '{}';
begin
  perform public.require_chore_member(p_flat_id,p_member_id);
  perform 1 from public.flats where id=p_flat_id for update;
  for c in select id from public.chores where flat_id=p_flat_id and active and kind='recurring' and next_due_at<=now() order by next_due_at,id loop
    v_tasks := v_tasks || public.generate_chore_tasks(c.id);
  end loop;
  return jsonb_build_object('flat_id',p_flat_id,'task_ids',v_tasks);
end $$;

create or replace function public.lock_chore_task(p_task_id uuid, p_member_id uuid) returns public.chore_tasks
language plpgsql set search_path = '' as $$
declare t public.chore_tasks%rowtype;
begin
  select * into t from public.chore_tasks where id=p_task_id;
  if not found then raise exception 'Task not found'; end if;
  perform public.require_chore_member(t.flat_id,p_member_id);
  perform 1 from public.flats where id=t.flat_id for update;
  select * into strict t from public.chore_tasks where id=p_task_id for update;
  return t;
end $$;

create or replace function public.complete_chore_task(p_task_id uuid, p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.chore_tasks%rowtype; b public.bounties%rowtype;
begin
  t := public.lock_chore_task(p_task_id,p_member_id);
  if t.assigned_to is distinct from p_member_id then raise exception 'Only the current assignee can complete this task'; end if;
  select * into b from public.bounties where task_id=t.id and status in ('open','accepted') for update;
  if t.status='open' then
    if b.status='open' then update public.bounties set status='cancelled' where id=b.id; end if;
    update public.chore_tasks set status='done',completed_by=p_member_id,completed_at=now(),
      points_credited_to=case when b.status='accepted' then b.offered_by else p_member_id end where id=t.id;
  end if;
  return jsonb_build_object('flat_id',t.flat_id,'task_ids',array[t.id],'bounty_id',b.id);
end $$;

create or replace function public.offer_bounty(p_task_id uuid, p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.chore_tasks%rowtype; b public.bounties%rowtype; v_amount integer;
begin
  t := public.lock_chore_task(p_task_id,p_member_id);
  if t.status <> 'open' then raise exception 'Task is not open'; end if;
  if t.assigned_to is distinct from p_member_id then raise exception 'Only the current assignee can offer a bounty'; end if;
  select * into b from public.bounties where task_id=t.id and status in ('open','accepted') for update;
  if b.status='accepted' then raise exception 'Task has already been bought out'; end if;
  if b.id is null then
    select t.weight_snapshot * buyout_rate_pence into v_amount from public.flats where id=t.flat_id;
    if v_amount is null or v_amount <= 0 then raise exception 'Buyout rate must be positive'; end if;
    insert into public.bounties(flat_id,task_id,offered_by,amount_pence) values(t.flat_id,t.id,p_member_id,v_amount) returning * into b;
  end if;
  return jsonb_build_object('flat_id',t.flat_id,'task_ids',array[t.id],'bounty_id',b.id,'bounty',to_jsonb(b));
end $$;

create or replace function public.cancel_bounty(p_bounty_id uuid, p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.chore_tasks%rowtype; b public.bounties%rowtype; v_task uuid;
begin
  select task_id into v_task from public.bounties where id=p_bounty_id;
  if not found then raise exception 'Bounty not found'; end if;
  t := public.lock_chore_task(v_task,p_member_id);
  select * into strict b from public.bounties where id=p_bounty_id for update;
  if b.offered_by <> p_member_id then raise exception 'Only the offerer can cancel'; end if;
  if b.status='accepted' then raise exception 'An accepted bounty cannot be cancelled'; end if;
  update public.bounties set status='cancelled' where id=b.id and status='open';
  return jsonb_build_object('flat_id',t.flat_id,'task_ids',array[t.id],'bounty_id',b.id);
end $$;

create or replace function public.accept_bounty(p_bounty_id uuid, p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.chore_tasks%rowtype; b public.bounties%rowtype; v_task uuid; v_expense uuid; v_title text;
begin
  select task_id into v_task from public.bounties where id=p_bounty_id;
  if not found then raise exception 'Bounty not found'; end if;
  t := public.lock_chore_task(v_task,p_member_id);
  select * into strict b from public.bounties where id=p_bounty_id for update;
  if b.offered_by=p_member_id then raise exception 'You cannot accept your own offer'; end if;
  if b.status='accepted' and b.accepted_by=p_member_id then
    select id into strict v_expense from public.expenses where bounty_id=b.id;
  else
    if b.status <> 'open' or t.status <> 'open' then raise exception 'Bounty and task must be open'; end if;
    if t.assigned_to is distinct from b.offered_by then raise exception 'Offerer is no longer the assignee'; end if;
    perform public.require_chore_member(t.flat_id,b.offered_by);
    select title into strict v_title from public.chores where id=t.chore_id;
    update public.chore_tasks set assigned_to=p_member_id where id=t.id;
    update public.bounties set status='accepted',accepted_by=p_member_id where id=b.id;
    insert into public.expenses(flat_id,payer_id,description,amount_pence,split_type,bounty_id,created_by)
      values(t.flat_id,p_member_id,'Buyout: ' || v_title,b.amount_pence,'amount',b.id,p_member_id) returning id into v_expense;
    insert into public.expense_shares(expense_id,member_id,amount_pence) values(v_expense,b.offered_by,b.amount_pence);
  end if;
  return jsonb_build_object('flat_id',t.flat_id,'task_ids',array[t.id],'bounty_id',b.id,'expense_id',v_expense);
end $$;

create or replace function public.get_chore_assignee(p_flat_id uuid, p_member_id uuid, p_chore_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_chore_member(p_flat_id,p_member_id);
  if not exists(select 1 from public.chores where id=p_chore_id and flat_id=p_flat_id) then raise exception 'Chore not found'; end if;
  return public.choose_chore_assignee(p_flat_id,p_chore_id);
end $$;

create or replace function public.get_chore_board(p_flat_id uuid, p_member_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_chore_member(p_flat_id,p_member_id);
  return jsonb_build_object(
    'flat',(select jsonb_build_object('id',id,'name',name,'buyout_rate_pence',buyout_rate_pence) from public.flats where id=p_flat_id),
    'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'fairness_score',f.fairness_score) order by m.created_at,m.id)
      from public.members m join public.chore_fairness(p_flat_id) f on f.member_id=m.id),'[]'::jsonb),
    'chores',coalesce((select jsonb_agg(to_jsonb(c) order by c.title) from public.chores c where c.flat_id=p_flat_id),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(t) || jsonb_build_object('title',c.title) order by (t.status='done'),t.due_at nulls last,t.id)
      from public.chore_tasks t join public.chores c on c.id=t.chore_id where t.flat_id=p_flat_id),'[]'::jsonb),
    'bounties',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.bounties b
      join public.chore_tasks t on t.id=b.task_id where t.flat_id=p_flat_id and b.status in ('open','accepted')),'[]'::jsonb)
  );
end $$;

-- Clients read chore tables; only the RPCs above may change them.
do $$
declare t text;
begin
  foreach t in array array['chores', 'chore_tasks', 'bounties'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open access" on %I', t);
    execute format('drop policy if exists "chore demo read" on %I', t);
    execute format('create policy "chore demo read" on %I for select using (true)', t);
    execute format('grant select on %I to anon, authenticated', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on %I from anon, authenticated', t);
  end loop;
end $$;

revoke all on function
  public.require_chore_member(uuid, uuid),
  public.chore_fairness(uuid),
  public.choose_chore_assignee(uuid, uuid),
  public.generate_chore_tasks(uuid),
  public.lock_chore_task(uuid, uuid)
from public, anon, authenticated;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chores', 'chore_tasks', 'bounties'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

commit;
