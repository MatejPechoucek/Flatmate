// Test-only RPC HTTP adapter: real SQL transactions, no simulated application state.
// This does not test Supabase's PostgREST or Realtime transport.
import http from 'node:http';
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
const database=`chores_browser_${process.pid}`;
const admin=new pg.Client({connectionString:process.env.TEST_DATABASE_URL || 'postgresql:///postgres?host=/tmp'});
await admin.connect();
const createdRoles=[];
for(const role of ['anon','authenticated']){if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount){await admin.query(`create role ${role} nologin`);createdRoles.push(role);}}
await admin.query(`create database ${database}`);
const pool=new pg.Pool({...admin.connectionParameters,database});
await pool.query('create publication supabase_realtime');
await pool.query(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
const migrationsDir=new URL('../supabase/migrations/',import.meta.url);
for(const file of (await readdir(migrationsDir)).filter(f=>f.endsWith('.sql')).sort()){
  await pool.query(await readFile(new URL(file,migrationsDir),'utf8'));
}
await pool.query(`
insert into flats(id,name,invite_code) values ('00000000-0000-4000-8000-000000000001','Maple House','maple');
insert into members(id,flat_id,name) values
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Alex'),
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Sam');
insert into chores(id,flat_id,title,weight,created_by,kind) values
 ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Bins',1,'00000000-0000-4000-8000-000000000002','one_off'),
 ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Bathroom',5,'00000000-0000-4000-8000-000000000002','one_off');
insert into chore_tasks(chore_id,flat_id,assigned_to,weight_snapshot,due_at) values
 ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',1,now()-interval '1 day'),
 ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',5,null);
`);
const allowed = new Set(['get_chore_board','create_chore','catch_up_chores','offer_bounty','cancel_bounty','accept_bounty','complete_chore_task']);
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');
  if(req.method==='OPTIONS') {res.end();return;}
  if(req.url==='/health'){res.end('ok');return;}
  const url=new URL(req.url,'http://localhost');
  const table=url.pathname.split('/').pop();
  if(req.method==='GET' && ['flats','members'].includes(table)){
    const key=table==='flats'?'id':'flat_id';
    const id=url.searchParams.get(key)?.replace(/^eq\./,'');
    const {rows}=await pool.query(`select * from public.${table} where ${key}=$1 order by created_at`,[id]);
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(table==='flats'?rows[0]:rows));return;
  }
  const name=url.pathname.split('/').pop();
  if(!allowed.has(name)){res.writeHead(404);res.end();return;}
  try{
    let body=''; for await(const chunk of req) body+=chunk;
    const args=JSON.parse(body);
    const keys=Object.keys(args);
    if(keys.some(k=>!/^p_[a-z_]+$/.test(k))) throw new Error('Invalid parameter');
    const {rows}=await pool.query(`select public.${name}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as result`,Object.values(args));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(rows[0].result));
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.message,code:e.code}));}
});
server.listen(54329,'127.0.0.1');
async function stop(){server.close();await pool.end();await admin.query(`drop database ${database}`);for(const role of createdRoles) await admin.query(`drop role ${role}`);await admin.end();process.exit();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
