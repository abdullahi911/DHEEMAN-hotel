# Dheeman Management

Next.js, Tailwind CSS, and Supabase starter for the Dheeman Restaurant Management dashboard.

## Features

- Manage restaurant expenses as cash purchases or debt.
- Track inventory stock, used quantity, remaining quantity, stocked date, and finished date.
- Automatically add inventory usage to reports when stock is used.
- Record daily sales/revenue.
- View daily profit and loss from sales, cash expenses, debt, and inventory usage.
- Save data in the browser with `localStorage` until Supabase tables are connected.
- Supabase table schema is available in `supabase/schema.sql`.

## Supabase

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run everything in `supabase/schema.sql`.
4. Open the website, go to the Supabase panel, and paste:
   - Project URL
   - Anon public key
5. Click `Connect Supabase`.

The schema enables RLS and adds anon policies for this local restaurant app.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and add your Supabase project values.

3. Run the app:

```bash
npm run dev
```

Open http://localhost:3000.
