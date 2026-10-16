import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', workers:1, timeout:60000,
  use:{baseURL:'http://localhost:3100',viewport:{width:390,height:844},screenshot:'only-on-failure'},
  webServer:[
    {command:'node tests/browser-server.mjs',url:'http://127.0.0.1:54329/health',reuseExistingServer:false},
    {command:'npm run dev -- --port 3100',url:'http://localhost:3100',reuseExistingServer:false,
      env:{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54329',NEXT_PUBLIC_SUPABASE_KEY:'test-only-key'}}
  ]
});
