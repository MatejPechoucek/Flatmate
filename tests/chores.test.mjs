import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Load the baseline schema plus every migration, in order. Migrations are
// idempotent, so this is the same path a fresh Supabase project would take.
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
async function migrationFiles() {
  return (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
}
async function loadSchema(client) {
  await client.query(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  for (const file of await migrationFiles()) {
    await client.query(await readFile(new URL(file, migrationsDir), 'utf8'));
  }
}

// Tests use a disposable real PostgreSQL database, never the app database.
const database = `chores_test_${process.pid}`;
const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL || 'postgresql:///postgres?host=/tmp' });
let db;
const createdRoles = [];

const connections = [];
async function connect() {
  const client = new pg.Client({ ...admin.connectionParameters, database });
  await client.connect(); connections.push(client); return client;
}
before(async () => {
  await admin.connect();
  for (const role of ['anon','authenticated']) {
    if (!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount) {
      await admin.query(`create role ${role} nologin`); createdRoles.push(role);
    }
  }
  await admin.query(`CREATE DATABASE ${database}`);
  db = await connect();
  await db.query('create publication supabase_realtime');
  await loadSchema(db);
});
after(async () => {
  await Promise.all(connections.map(c => c.end()));
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  for (const role of createdRoles) await admin.query(`drop role ${role}`);
  await admin.end();
});
async function rpc(name, args, client = db) {
  const values = Object.values(args);
  const { rows } = await client.query(`select public.${name}(${Object.keys(args).map((key, i) => `${key} => $${i + 1}`).join(',')}) as result`, values);
  return rows[0].result;
}
async function flat() {
  const id = randomUUID();
  await db.query('insert into flats(id,name,invite_code) values($1,$2,$3)', [id, 'Test flat', id]);
  const members = [randomUUID(), randomUUID(), randomUUID()];
  for (let i = 0; i < members.length; i++) await db.query('insert into members(id,flat_id,name) values($1,$2,$3)', [members[i], id, ['Alex','Sam','Jo'][i]]);
  return { id, members };
}
async function create(f, weight = 5, extra = {}) {
  return rpc('create_chore', { p_flat_id: f.id, p_member_id: f.members[0], p_title: 'Bathroom', p_weight: weight, p_kind: 'one_off', ...extra });
}
async function task(id) { return (await db.query('select * from chore_tasks where id=$1', [id])).rows[0]; }
async function offer(f) {
  const result = await create(f);
  const t = await task(result.task_ids[0]);
  const b = await rpc('offer_bounty', {p_task_id:t.id, p_member_id:t.assigned_to});
  return {t, b, doer:f.members.find(id => id !== t.assigned_to)};
}
async function history(f, choreId, memberId, weight, age, credited = memberId) {
  await db.query(`insert into chore_tasks(chore_id,flat_id,assigned_to,status,weight_snapshot,completed_by,points_credited_to,completed_at)
    values($1,$2,$3,'done',$4,$3,$5,now() - $6::interval)`, [choreId,f.id,memberId,weight,credited,age]);
}

test('creation snapshots weight; only assignee completes, exactly once, and next assignment uses completed scores', async () => {
  const f = await flat(); const c = await create(f); const t = await task(c.task_ids[0]);
  assert.equal(t.weight_snapshot, 5);
  await assert.rejects(rpc('complete_chore_task', {p_task_id:t.id,p_member_id:f.members.find(id => id !== t.assigned_to)}), /assignee/i);
  await db.query('update chores set weight=1 where id=$1', [c.chore_id]);
  await rpc('complete_chore_task', {p_task_id:t.id,p_member_id:t.assigned_to});
  await rpc('complete_chore_task', {p_task_id:t.id,p_member_id:t.assigned_to});
  const board = await rpc('get_chore_board', {p_flat_id:f.id,p_member_id:f.members[0]});
  assert.equal(board.members.find(m=>m.id===t.assigned_to).fairness_score, 5);
  const next = await create(f);
  assert.notEqual((await task(next.task_ids[0])).assigned_to, t.assigned_to);
});

test('fairness excludes exact cutoff and older history, and counts credited member rather than physical doer', async () => {
  const f = await flat(); const c = await create(f, 1);
  await db.query('begin');
  try {
    await history(f,c.chore_id,f.members[0],5,'28 days');
    await history(f,c.chore_id,f.members[0],5,'29 days');
    await history(f,c.chore_id,f.members[0],3,'27 days',f.members[1]);
    const board = await rpc('get_chore_board', {p_flat_id:f.id,p_member_id:f.members[0]});
    assert.deepEqual(f.members.map(id=>board.members.find(m=>m.id===id).fairness_score), [0,3,0]);
  } finally { await db.query('rollback'); }
});

test('same-chore tie breaks by least recent physical doer, never first, and random among remaining ties', async () => {
  const f = await flat(); const c = await create(f,1);
  await history(f,c.chore_id,f.members[0],1,'30 days');
  await history(f,c.chore_id,f.members[1],1,'40 days',f.members[0]);
  assert.equal(await rpc('choose_chore_assignee', {p_flat_id:f.id,p_chore_id:c.chore_id}), f.members[2]);
  await history(f,c.chore_id,f.members[2],1,'35 days');
  assert.equal(await rpc('choose_chore_assignee', {p_flat_id:f.id,p_chore_id:c.chore_id}), f.members[1]);
  await db.query('delete from chore_tasks where chore_id=$1 and status=\'done\'', [c.chore_id]);
  await db.query('select setseed(0.42)');
  const winners = new Set();
  for(let i=0;i<40;i++) winners.add(await rpc('choose_chore_assignee', {p_flat_id:f.id,p_chore_id:c.chore_id}));
  assert.equal(winners.size,3);
});

test('£5 acceptance creates one debt from offerer to doer; fairness changes only on completion', async () => {
  const f = await flat(); const {t,b,doer} = await offer(f);
  await assert.rejects(rpc('accept_bounty',{p_bounty_id:b.bounty_id,p_member_id:t.assigned_to}), /own/i);
  await db.query('update flats set buyout_rate_pence=200 where id=$1',[f.id]);
  const accepted = await rpc('accept_bounty',{p_bounty_id:b.bounty_id,p_member_id:doer});
  const retry = await rpc('accept_bounty',{p_bounty_id:b.bounty_id,p_member_id:doer});
  assert.equal(accepted.expense_id,retry.expense_id);
  const ledger = (await db.query('select e.payer_id,e.amount_pence,s.member_id,s.amount_pence as share from expenses e join expense_shares s on s.expense_id=e.id where e.bounty_id=$1',[b.bounty_id])).rows;
  assert.deepEqual(ledger,[{payer_id:doer,amount_pence:500,member_id:t.assigned_to,share:500}]);
  let board = await rpc('get_chore_board',{p_flat_id:f.id,p_member_id:doer});
  assert.equal(board.members.reduce((sum,m)=>sum+m.fairness_score,0),0);
  await assert.rejects(rpc('cancel_bounty',{p_bounty_id:b.bounty_id,p_member_id:t.assigned_to}),/accepted/i);
  await assert.rejects(rpc('offer_bounty',{p_task_id:t.id,p_member_id:doer}),/bought out/i);
  await rpc('complete_chore_task',{p_task_id:t.id,p_member_id:doer});
  assert.equal((await task(t.id)).completed_by,doer);
  board = await rpc('get_chore_board',{p_flat_id:f.id,p_member_id:doer});
  assert.equal(board.members.find(m=>m.id===t.assigned_to).fairness_score,5);
  assert.equal(board.members.find(m=>m.id===doer).fairness_score,0);
});

test('completion cancels open offer and prevents acceptance; cancellation permits a fresh offer', async () => {
  const f = await flat(); const {t,b,doer} = await offer(f);
  await rpc('cancel_bounty',{p_bounty_id:b.bounty_id,p_member_id:t.assigned_to});
  const b2 = await rpc('offer_bounty',{p_task_id:t.id,p_member_id:t.assigned_to});
  assert.notEqual(b.bounty_id,b2.bounty_id);
  await rpc('complete_chore_task',{p_task_id:t.id,p_member_id:t.assigned_to});
  await assert.rejects(rpc('accept_bounty',{p_bounty_id:b2.bounty_id,p_member_id:doer}),/open/i);
  assert.equal((await db.query('select status from bounties where id=$1',[b2.bounty_id])).rows[0].status,'cancelled');
});

test('invalid membership, weights, intervals and dates fail without partial writes', async () => {
  const f = await flat(); const other = await flat();
  for(const extra of [{p_member_id:other.members[0]},{p_weight:0},{p_weight:6},{p_title:' '},{p_kind:'recurring',p_interval_days:0,p_due_at:new Date()},{p_kind:'recurring',p_interval_days:7}]) {
    await assert.rejects(create(f,5,extra));
  }
  assert.equal((await db.query('select count(*)::int as n from chores where flat_id=$1',[f.id])).rows[0].n,0);
  const {t,b} = await offer(f);
  for (const [name,args] of [['complete_chore_task',{p_task_id:t.id}],['offer_bounty',{p_task_id:t.id}],['accept_bounty',{p_bounty_id:b.bounty_id}],['cancel_bounty',{p_bounty_id:b.bounty_id}],['catch_up_chores',{p_flat_id:f.id}],['get_chore_board',{p_flat_id:f.id}]]) {
    await assert.rejects(rpc(name,{...args,p_member_id:other.members[0]}),/member/i);
    await assert.rejects(rpc(name,{...args,p_member_id:null}),/member/i);
  }
});

test('recurrence waits until due, catches up fixed schedule once, and completion never advances it', async () => {
  const f = await flat();
  const future = await create(f,2,{p_kind:'recurring',p_interval_days:7,p_due_at:'2099-01-01T09:00:00Z'});
  assert.deepEqual(future.task_ids,[]);
  const past = new Date(Date.now()-15*86400000);
  const c = await create(f,2,{p_kind:'recurring',p_interval_days:7,p_due_at:past});
  assert.equal(c.task_ids.length,3);
  const scheduled = (await db.query('select next_due_at from chores where id=$1',[c.chore_id])).rows[0].next_due_at;
  const t = await task(c.task_ids[0]);
  await rpc('complete_chore_task',{p_task_id:t.id,p_member_id:t.assigned_to});
  assert.deepEqual((await db.query('select next_due_at from chores where id=$1',[c.chore_id])).rows[0].next_due_at,scheduled);
  const c1 = await connect(); const c2 = await connect();
  await Promise.all([c1,c2].map(client=>rpc('catch_up_chores',{p_flat_id:f.id,p_member_id:f.members[0]},client)));
  assert.equal((await db.query('select count(*)::int as n from chore_tasks where chore_id=$1',[c.chore_id])).rows[0].n,3);
});

test('simultaneous acceptance gives exactly one winner and ledger entry', async () => {
  const f = await flat(); const {t,b} = await offer(f);
  const clients = await Promise.all([connect(),connect()]);
  const outcomes = await Promise.allSettled(f.members.filter(id=>id!==t.assigned_to).map((id,i)=>rpc('accept_bounty',{p_bounty_id:b.bounty_id,p_member_id:id},clients[i])));
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
  assert.equal((await db.query('select count(*)::int as n from expenses where bounty_id=$1',[b.bounty_id])).rows[0].n,1);
});

test('acceptance versus completion/cancellation serializes to a consistent outcome', async () => {
  for(const action of ['complete_chore_task','cancel_bounty']) {
    const f = await flat(); const {t,b,doer} = await offer(f);
    const clients = await Promise.all([connect(),connect()]);
    const args = action==='complete_chore_task'?{p_task_id:t.id}:{p_bounty_id:b.bounty_id};
    const results = await Promise.allSettled([
      rpc('accept_bounty',{p_bounty_id:b.bounty_id,p_member_id:doer},clients[0]),
      rpc(action,{...args,p_member_id:t.assigned_to},clients[1])
    ]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const state = (await db.query('select status from bounties where id=$1',[b.bounty_id])).rows[0].status;
    assert.equal((await task(t.id)).assigned_to,state==='accepted'?doer:t.assigned_to);
    assert.equal((await db.query('select count(*)::int as n from expenses where bounty_id=$1',[b.bounty_id])).rows[0].n,state==='accepted'?1:0);
  }
});

test('failed ledger insertion rolls back bounty acceptance and reassignment', async () => {
  const f = await flat(); const {t,b,doer} = await offer(f);
  await db.query(`create function reject_test_share() returns trigger language plpgsql as $$ begin raise exception 'ledger unavailable'; end $$;
    create trigger reject_test_share before insert on expense_shares for each row execute function reject_test_share()`);
  try {
    await assert.rejects(rpc('accept_bounty',{p_bounty_id:b.bounty_id,p_member_id:doer}),/ledger unavailable/);
    assert.equal((await task(t.id)).assigned_to,t.assigned_to);
    assert.equal((await db.query('select status from bounties where id=$1',[b.bounty_id])).rows[0].status,'open');
    assert.equal((await db.query('select count(*)::int as n from expenses where bounty_id=$1',[b.bounty_id])).rows[0].n,0);
  } finally { await db.query('drop trigger reject_test_share on expense_shares; drop function reject_test_share()'); }
});

test('simultaneous completion credits once and simultaneous catch-up creates each newly due occurrence once', async () => {
  const f = await flat();
  const c = await create(f,3,{p_kind:'recurring',p_interval_days:7,p_due_at:'2099-01-01T09:00:00Z'});
  const firstDue = new Date(Date.now() - 15 * 86400000);
  await db.query("update chores set next_due_at=$2 where id=$1",[c.chore_id, firstDue]);
  const clients=await Promise.all([connect(),connect()]);
  await Promise.all(clients.map(client=>rpc('catch_up_chores',{p_flat_id:f.id,p_member_id:f.members[0]},client)));
  const tasks=(await db.query('select * from chore_tasks where chore_id=$1 order by due_at',[c.chore_id])).rows;
  assert.equal(tasks.length,3);
  assert.deepEqual(tasks.map(t=>t.due_at.toISOString()),[
    firstDue.toISOString(),
    new Date(firstDue.getTime()+604800000).toISOString(),
    new Date(firstDue.getTime()+1209600000).toISOString(),
  ]);
  const nextDue=(await db.query('select next_due_at from chores where id=$1',[c.chore_id])).rows[0].next_due_at;
  assert.equal(nextDue.toISOString(),new Date(firstDue.getTime()+1814400000).toISOString());
  await Promise.all(clients.map(client=>rpc('complete_chore_task',{p_task_id:tasks[0].id,p_member_id:tasks[0].assigned_to},client)));
  const board=await rpc('get_chore_board',{p_flat_id:f.id,p_member_id:f.members[0]});
  assert.equal(board.members.reduce((sum,m)=>sum+m.fairness_score,0),3);
});

test('demo browser role can call public RPCs but cannot bypass chore state or call private helpers', async () => {
  const f=await flat(); const c=await create(f); const t=await task(c.task_ids[0]);
  await db.query('set role anon');
  try {
    await assert.rejects(db.query("update chore_tasks set status='done' where id=$1",[t.id]),/permission denied/i);
    await assert.rejects(rpc('choose_chore_assignee',{p_flat_id:f.id,p_chore_id:c.chore_id}),/permission denied/i);
    await rpc('complete_chore_task',{p_task_id:t.id,p_member_id:t.assigned_to});
    const board=await rpc('get_chore_board',{p_flat_id:f.id,p_member_id:t.assigned_to});
    assert.equal(board.members.find(m=>m.id===t.assigned_to).fairness_score,5);
  } finally { await db.query('reset role'); }
});
