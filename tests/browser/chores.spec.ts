import { test, expect } from '@playwright/test';
test('two members create, complete and buy out chores; refresh and reload preserve changes',async({browser})=>{
  const alexContext=await browser.newContext({viewport:{width:390,height:844}});
  const samContext=await browser.newContext({viewport:{width:390,height:844}});
  for(const [context,member] of [[alexContext,'2'],[samContext,'3']] as const){
    await context.addInitScript(({member})=>localStorage.setItem('flatmate:member:00000000-0000-4000-8000-000000000001',`00000000-0000-4000-8000-00000000000${member}`),{member});
  }
  const alex=await alexContext.newPage(),sam=await samContext.newPage();
  alex.on('pageerror',e=>console.error('Browser error:',e));
  alex.on('requestfailed',r=>console.error('Failed request:',r.url(),r.failure()));
  await Promise.all([alex.goto('/flat/00000000-0000-4000-8000-000000000001/chores'),sam.goto('/flat/00000000-0000-4000-8000-000000000001/chores')]);
  await expect(alex.getByRole('heading',{name:'Chores',exact:true})).toBeVisible({timeout:20000});
  const bins=alex.getByRole('article',{name:'Bins task',exact:true});
  await expect(bins.getByText('Overdue',{exact:false})).toBeVisible();
  await bins.getByRole('button',{name:'Mark done'}).click();
  await expect(alex.getByLabel('Alex fairness score')).toHaveText('1 pt');
  await expect(sam.getByLabel('Alex fairness score')).toHaveText('1 pt',{timeout:20000});
  await alex.getByRole('button',{name:'Add chore',exact:true}).click();
  await alex.getByLabel('Chore title').fill('Kitchen');
  await alex.getByRole('button',{name:'2 points',exact:true}).click();
  await alex.getByRole('button',{name:'Create chore'}).click();
  await sam.getByRole('button',{name:'My tasks',exact:false}).click();
  const kitchen=sam.getByRole('article',{name:'Kitchen task',exact:true});
  await expect(kitchen).toBeVisible({timeout:20000});
  await expect(kitchen.getByText('Assigned to Sam')).toBeVisible();
  const bathroom=alex.getByRole('article',{name:'Bathroom task',exact:true});
  await bathroom.getByRole('button',{name:'Offer £5.00 bounty'}).click();
  await sam.getByRole('button',{name:'Accept for £5.00'}).click({timeout:20000});
  await expect(sam.getByText('£5.00 buyout recorded: Alex → Sam')).toBeVisible();
  await sam.getByRole('button',{name:'All tasks',exact:false}).click();
  const samBathroom=sam.getByRole('article',{name:'Bathroom task',exact:true});
  await samBathroom.getByRole('button',{name:'Mark done'}).click();
  await expect(sam.getByLabel('Alex fairness score')).toHaveText('6 pts');
  await expect(sam.getByLabel('Sam fairness score')).toHaveText('0 pts');
  await alex.reload();
  await expect(alex.getByLabel('Alex fairness score')).toHaveText('6 pts');
  await alex.getByRole('button',{name:'Add chore',exact:true}).click();
  await alex.getByLabel('Chore title').fill('Future bins');
  await alex.getByRole('button',{name:'Recurring',exact:true}).click();
  await alex.getByLabel('First due date').fill('2099-01-01T09:00');
  await alex.getByRole('button',{name:'Create chore'}).click();
  await expect(alex.getByText(/Future bins · every 7 days/)).toBeVisible();
  expect(await alex.getByRole('article',{name:'Future bins task',exact:true}).count()).toBe(0);
  const overflow=await alex.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  await alex.screenshot({path:'test-results/chores-mobile.png',fullPage:true});
  await alex.setViewportSize({width:1440,height:1000});
  await alex.screenshot({path:'test-results/chores-desktop.png',fullPage:true});
  await alexContext.close();await samContext.close();
});


test('a failed initial load can be retried without leaving a stale error', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('flatmate:member:00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'));
  let failing = true;
  await page.route('**/rest/v1/rpc/get_chore_board', async route => {
    if (!failing) return route.continue();
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Temporary test outage'})});
  });
  await page.goto('/flat/00000000-0000-4000-8000-000000000001/chores');
  await expect(page.getByText('Temporary test outage',{exact:false})).toBeVisible();
  failing = false;
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Chores',exact:true})).toBeVisible();
  await expect(page.getByText('Temporary test outage',{exact:false})).toHaveCount(0);
});

test('a failed create keeps form values and retry creates exactly one task', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('flatmate:member:00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'));
  let attempts = 0;
  await page.route('**/rest/v1/rpc/create_chore', async route => {
    attempts++;
    if (attempts > 1) return route.continue();
    await route.fulfill({status:400, contentType:'application/json', body:JSON.stringify({message:'Could not save test chore'})});
  });
  await page.goto('/flat/00000000-0000-4000-8000-000000000001/chores');
  await page.getByRole('button', {name:'Add chore', exact:true}).click();
  await page.getByLabel('Chore title').fill('Retry kitchen');
  await page.getByRole('button', {name:'4 points', exact:true}).click();
  await page.getByRole('button', {name:'Create chore', exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Could not save test chore'}).first()).toBeVisible();
  await expect(page.getByLabel('Chore title')).toHaveValue('Retry kitchen');
  await expect(page.getByRole('button', {name:'4 points', exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button', {name:'Create chore', exact:true}).click();
  await expect(page.getByLabel('Chore title')).toHaveCount(0);
  // Next.js keeps a route-announcer alert outside the application content.
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', {name:'All tasks', exact:false}).click();
  await expect(page.getByRole('article', {name:'Retry kitchen task', exact:true})).toHaveCount(1);
  expect(attempts).toBe(2);
  await page.reload();
  await page.getByRole('button', {name:'All tasks', exact:false}).click();
  await expect(page.getByRole('article', {name:'Retry kitchen task', exact:true})).toHaveCount(1);
});

test('only the assignee sees task actions and cancelling an offer restores the offer button', async ({browser, request}) => {
  const flatId = '00000000-0000-4000-8000-000000000001';
  const alexId = '00000000-0000-4000-8000-000000000002';
  const samId = '00000000-0000-4000-8000-000000000003';
  // Create this test's own task; assignment may change with prior completion history.
  const created = await request.post('http://127.0.0.1:54329/rest/v1/rpc/create_chore', {
    data:{p_flat_id:flatId, p_member_id:alexId, p_title:'Cancel test chore', p_weight:3, p_kind:'one_off'},
  });
  expect(created.ok()).toBe(true);
  const {task_ids:taskIds} = await created.json();
  const response = await request.post('http://127.0.0.1:54329/rest/v1/rpc/get_chore_board', {
    data:{p_flat_id:flatId, p_member_id:alexId},
  });
  expect(response.ok()).toBe(true);
  const board = await response.json();
  const assignee = board.tasks.find((t: {id:string}) => t.id === taskIds[0]).assigned_to;
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  try {
    for (const [context, memberId] of [[ownerContext, assignee], [otherContext, assignee === alexId ? samId : alexId]] as const) {
      await context.addInitScript(({flatId, memberId}) => localStorage.setItem(`flatmate:member:${flatId}`, memberId), {flatId, memberId});
    }
    const owner = await ownerContext.newPage();
    const other = await otherContext.newPage();
    await Promise.all([owner.goto(`/flat/${flatId}/chores`), other.goto(`/flat/${flatId}/chores`)]);
    await other.getByRole('button', {name:'All tasks', exact:false}).click();
    const ownerTask = owner.getByRole('article', {name:'Cancel test chore task', exact:true});
    const otherTask = other.getByRole('article', {name:'Cancel test chore task', exact:true});
    await expect(otherTask).toBeVisible();
    await expect(otherTask.getByRole('button')).toHaveCount(0);
    await ownerTask.getByRole('button', {name:'Offer £3.00 bounty'}).click();
    await expect(owner.getByRole('button', {name:'Cancel offer', exact:true})).toBeVisible();
    await expect(owner.getByRole('button', {name:'Accept for £3.00'})).toHaveCount(0);
    await other.getByRole('button', {name:'Refresh', exact:true}).click();
    await expect(other.getByRole('button', {name:'Accept for £3.00'})).toBeVisible();
    await expect(other.getByRole('button', {name:'Cancel offer', exact:true})).toHaveCount(0);
    await owner.getByRole('button', {name:'Cancel offer', exact:true}).click();
    await expect(ownerTask.getByRole('button', {name:'Offer £3.00 bounty'})).toBeVisible();
    await other.getByRole('button', {name:'Refresh', exact:true}).click();
    await expect(other.getByRole('button', {name:'Accept for £3.00'})).toHaveCount(0);
    await ownerTask.getByRole('button', {name:'Offer £3.00 bounty'}).click();
    await expect(owner.getByRole('button', {name:'Cancel offer', exact:true})).toBeVisible();
    await owner.getByRole('button', {name:'Cancel offer', exact:true}).click();
  } finally {
    await ownerContext.close();
    await otherContext.close();
  }
});
