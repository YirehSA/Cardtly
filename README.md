# Cardtly — Next.js Rebuild

Digital business card platform. Next.js 15 + Supabase + Vercel.

## Setup

```bash
npm install
```

Copy `.env.local` and fill in your values:
```bash
cp .env.local .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server only, never expose)
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for dev, `https://cardtly.com` for prod

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
  login/              Sign in page
  signup/             Sign up + auto card creation
  dashboard/          Authenticated app
    layout.tsx        Sidebar + header shell
    page.tsx          Dashboard home
  card/[slug]/        Public card pages
  api/
    og/card/[slug]/   OG image generation
    vcf/[slug]/       vCard download
    webhooks/
      whop/           Whop payment webhook
      paystack/       PayStack payment webhook

components/
  card/               Public card renderer
  dashboard/          Sidebar, header
  auth/               Auth form components

lib/
  supabase/
    client.ts         Browser Supabase client
    server.ts         Server Supabase client
  plan.ts             Plan checks + feature gates
  utils.ts            cn() helper

types/
  database.ts         Full DB type definitions
```

## Deployment

Deploy to Vercel. Add all environment variables in the Vercel dashboard.

After deploying, update your Whop and PayStack webhook URLs to:
- `https://cardtly.com/api/webhooks/whop`
- `https://cardtly.com/api/webhooks/paystack`
