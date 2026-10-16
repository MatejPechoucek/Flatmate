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
