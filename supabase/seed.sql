-- Demo flat for the pitch. Run AFTER schema.sql, in the Supabase SQL editor.
-- Safe to re-run: it deletes the demo flat (cascade) and recreates it.
--
-- Invite code: GWRST4  →  open /join/GWRST4 and tap "Alex" to become the presenter.
--
-- Story the data tells (matches the demo script in IDEA.md):
--   • 4 flatmates, ~3 weeks of history.
--   • Fairness (28 days): Sam 9 · Alex 6 · Priya 6 · Tom 3  → Tom gets the next task.
--   • Tom already bought out Sam's bathroom clean once (£5 buyout expense, Sam kept the points).
--   • Priya has an open £3 bounty on "Hoover the lounge" (raised from the £2 base).
--   • Alex has an open bathroom task: the live buyout moment.

do $$
declare
  f     uuid := '00000000-0000-4000-8000-000000000001';
  alex  uuid := '00000000-0000-4000-8000-0000000000a1';
  sam   uuid := '00000000-0000-4000-8000-0000000000a2';
  priya uuid := '00000000-0000-4000-8000-0000000000a3';
  tom   uuid := '00000000-0000-4000-8000-0000000000a4';
  c_bins uuid := gen_random_uuid();
  c_bath uuid := gen_random_uuid();
  c_hoov uuid := gen_random_uuid();
  c_roll uuid := gen_random_uuid();
  r_wifi uuid := gen_random_uuid();
  r_energy uuid := gen_random_uuid();
  t_old_bath uuid := gen_random_uuid();
  t_hoov uuid := gen_random_uuid();
  b_old uuid := gen_random_uuid();
  e uuid;
  d timestamptz := date_trunc('day', now()) + interval '18 hours'; -- "today, 6pm"
begin
  delete from flats where id = f or invite_code = 'GWRST4';

  insert into flats (id, name, invite_code, buyout_rate_pence, created_at)
  values (f, '14 Gower Street', 'GWRST4', 100, now() - interval '30 days');

  insert into members (id, flat_id, name, pay_handle, created_at) values
    (alex,  f, 'Alex',  'alexmonzo',     now() - interval '30 days'),
    (sam,   f, 'Sam',   'samj',          now() - interval '30 days' + interval '1 minute'),
    (priya, f, 'Priya', 'paypal:priyak', now() - interval '30 days' + interval '2 minutes'),
    (tom,   f, 'Tom',   null,            now() - interval '30 days' + interval '3 minutes');

  -- ─── Chores ───
  insert into chores (id, flat_id, title, weight, created_by, kind, interval_days, next_due_at, weight_proposed_at, created_at) values
    (c_bins, f, 'Take the bins out',   1, alex,  'recurring', 7,    d + interval '8 days',  now() - interval '28 days', now() - interval '28 days'),
    (c_bath, f, 'Bathroom deep clean', 5, sam,   'recurring', 14,   d + interval '17 days', now() - interval '28 days', now() - interval '28 days'),
    (c_hoov, f, 'Hoover the lounge',   2, priya, 'recurring', 7,    d + interval '9 days',  now() - interval '20 days', now() - interval '20 days'),
    (c_roll, f, 'Buy toilet roll',     1, tom,   'one_off',   null, null,                   now() - interval '1 day',   now() - interval '1 day');

  -- Completed history (drives fairness). points_credited_to = doer, except the buyout.
  insert into chore_tasks (chore_id, flat_id, assigned_to, due_at, status, completed_by, completed_at, points_credited_to, created_at) values
    -- bins (1pt), weekly
    (c_bins, f, tom,   d - interval '20 days', 'done', tom,   d - interval '20 days', tom,   d - interval '27 days'),
    (c_bins, f, alex,  d - interval '13 days', 'done', alex,  d - interval '13 days', alex,  d - interval '20 days'),
    (c_bins, f, priya, d - interval '6 days',  'done', priya, d - interval '6 days',  priya, d - interval '13 days'),
    -- hoover (2pt), weekly
    (c_hoov, f, alex,  d - interval '19 days', 'done', alex,  d - interval '19 days', alex,  d - interval '20 days'),
    (c_hoov, f, sam,   d - interval '12 days', 'done', sam,   d - interval '12 days', sam,   d - interval '19 days'),
    (c_hoov, f, tom,   d - interval '5 days',  'done', tom,   d - interval '5 days',  tom,   d - interval '12 days'),
    -- bathroom (5pt), fortnightly
    (c_bath, f, priya, d - interval '25 days', 'done', priya, d - interval '25 days', priya, d - interval '28 days');

  -- Bathroom 11 days ago: Sam's task, bought out by Tom. Tom did it, Sam keeps the points.
  insert into chore_tasks (id, chore_id, flat_id, assigned_to, due_at, status, completed_by, completed_at, points_credited_to, created_at)
  values (t_old_bath, c_bath, f, tom, d - interval '11 days', 'done', tom, d - interval '11 days', sam, d - interval '25 days');
  insert into bounties (id, flat_id, task_id, offered_by, amount_pence, status, accepted_by, created_at)
  values (b_old, f, t_old_bath, sam, 500, 'accepted', tom, d - interval '13 days');

  -- More history → Alex 6, Sam 9, Priya 6, Tom 3.
  insert into chore_tasks (chore_id, flat_id, assigned_to, due_at, status, completed_by, completed_at, points_credited_to, created_at) values
    (c_bins, f, alex, d - interval '9 days', 'done', alex, d - interval '9 days', alex, d - interval '10 days'),
    (c_hoov, f, alex, d - interval '2 days', 'done', alex, d - interval '2 days', alex, d - interval '3 days'),
    (c_roll, f, sam,  d - interval '15 days', 'done', sam, d - interval '15 days', sam, d - interval '16 days'),
    (c_bins, f, sam,  d - interval '16 days', 'done', sam, d - interval '16 days', sam, d - interval '17 days');

  -- Open tasks (one per active chore cycle).
  insert into chore_tasks (chore_id, flat_id, assigned_to, due_at, status, created_at) values
    (c_bins, f, alex,  d + interval '1 day',  'open', d - interval '6 days'),
    (c_bath, f, alex,  d + interval '3 days', 'open', d - interval '11 days'),
    (c_roll, f, sam,   d - interval '1 day',  'open', d - interval '1 day');
  insert into chore_tasks (id, chore_id, flat_id, assigned_to, due_at, status, created_at)
  values (t_hoov, c_hoov, f, priya, d + interval '2 days', 'open', d - interval '2 days');

  -- Priya raised her hoover bounty from the £2 base to £3.
  insert into bounties (flat_id, task_id, offered_by, amount_pence, status, created_at)
  values (f, t_hoov, priya, 300, 'open', now() - interval '2 hours');

  -- ─── Money ───
  insert into recurring_expenses (id, flat_id, payer_id, description, amount_pence, split_type, interval, next_due_at, created_at) values
    (r_wifi,   f, sam,   'Wi-Fi',  3200, 'equal', 'monthly', d + interval '28 days', now() - interval '30 days'),
    (r_energy, f, priya, 'Energy', 8400, 'equal', 'monthly', d + interval '20 days', now() - interval '30 days');

  -- Helper pattern: insert expense, then its shares (always summing to the total).
  insert into expenses (id, flat_id, payer_id, description, amount_pence, split_type, recurring_expense_id, due_at, created_at)
  values (gen_random_uuid(), f, priya, 'Energy · September', 8400, 'equal', r_energy, d - interval '10 days', d - interval '10 days') returning id into e;
  insert into expense_shares values (e, alex, 2100), (e, sam, 2100), (e, priya, 2100), (e, tom, 2100);

  insert into expenses (id, flat_id, payer_id, description, amount_pence, split_type, created_at)
  values (gen_random_uuid(), f, tom, 'Pizza night', 3600, 'equal', d - interval '8 days') returning id into e;
  insert into expense_shares values (e, alex, 900), (e, sam, 900), (e, priya, 900), (e, tom, 900);

  insert into expenses (id, flat_id, payer_id, description, amount_pence, split_type, created_at)
  values (gen_random_uuid(), f, priya, 'Cleaning supplies', 1150, 'percent', d - interval '5 days') returning id into e;
  insert into expense_shares values (e, alex, 345), (e, sam, 345), (e, priya, 230), (e, tom, 230);

  insert into expenses (id, flat_id, payer_id, description, amount_pence, split_type, recurring_expense_id, due_at, created_at)
  values (gen_random_uuid(), f, sam, 'Wi-Fi · October', 3200, 'equal', r_wifi, d - interval '2 days', d - interval '2 days') returning id into e;
  insert into expense_shares values (e, alex, 800), (e, sam, 800), (e, priya, 800), (e, tom, 800);

  insert into expenses (id, flat_id, payer_id, description, amount_pence, split_type, created_at)
  values (gen_random_uuid(), f, alex, 'Tesco big shop', 4260, 'equal', now() - interval '3 hours') returning id into e;
  insert into expense_shares values (e, alex, 1065), (e, sam, 1065), (e, priya, 1065), (e, tom, 1065);

  -- The buyout: paid by the doer (Tom), 100% owed by the offerer (Sam).
  insert into expenses (id, flat_id, payer_id, description, amount_pence, split_type, bounty_id, created_at)
  values (gen_random_uuid(), f, tom, 'Buyout: Bathroom deep clean', 500, 'amount', b_old, d - interval '13 days') returning id into e;
  insert into expense_shares values (e, sam, 500);

  -- Sam already paid Alex back a tenner.
  insert into settlements (flat_id, from_member, to_member, amount_pence, created_at)
  values (f, sam, alex, 1000, d - interval '4 days');
end $$;
