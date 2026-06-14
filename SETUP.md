# Off the Clock — setup guide

This is a small web app for your group's weekly screen time challenge. Follow these steps in order. None of it requires coding — just clicking through some setup screens.

Total time: roughly 30–45 minutes the first time.

---

## Part 1 — Create your Supabase project (database + image storage)

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**.
   - Name: anything, e.g. `off-the-clock`
   - Database password: generate one and save it somewhere (you likely won't need it again, but keep it).
   - Region: pick one close to you.
3. Wait ~1-2 minutes for the project to finish setting up.

### Create the database table

4. In the left sidebar, click **SQL Editor**.
5. Click **New query**, paste this in, and click **Run**:

```sql
create table group_state (
  id integer primary key,
  limit_hours numeric not null default 7,
  penalty_text text not null default '5 km run',
  current_week text not null,
  members jsonb not null default '{}'::jsonb,
  penalties_owed jsonb not null default '[]'::jsonb
);

alter table group_state enable row level security;

create policy "Allow all access"
on group_state
for all
using (true)
with check (true);
```

> Note: this makes the table fully open (anyone with your URL can read/write). That's fine for a small trusted friend group, but don't put anything sensitive in it.

### Create storage bucket for screenshots

6. In the left sidebar, click **Storage**.
7. Click **New bucket**.
   - Name: `screenshots`
   - Toggle **Public bucket** to ON (so images can be viewed via a link).
8. Click **Create bucket**.

### Get your API keys

9. In the left sidebar, click **Settings** (gear icon) → **API**.
10. You'll need two values from this page:
    - **Project URL** (looks like `https://xxxxx.supabase.co`)
    - **anon public** key (a long string under "Project API keys")

Keep this tab open — you'll paste these into the code next.

---

## Part 2 — Add your keys to the project

1. In the project folder, find the file `.env.local.example`.
2. Make a copy of it named `.env.local` (same folder, just remove `.example`).
3. Open `.env.local` and replace the placeholder values with your real Supabase URL and anon key from step 10 above:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

4. Save the file.

---

## Part 3 — Push to GitHub

1. Go to [github.com](https://github.com) and click **New repository**.
   - Name: `off-the-clock` (or whatever you like)
   - Keep it **Private** if you'd prefer.
   - Don't add a README/gitignore (we already have one).
2. Follow GitHub's instructions to push an existing project — from inside the project folder on your computer, run:

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/off-the-clock.git
git push -u origin main
```

> `.env.local` will NOT be pushed (it's in `.gitignore` on purpose — keeps your keys private). You'll re-enter them directly in Vercel in the next step.

---

## Part 4 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with your GitHub account.
2. Click **Add New** → **Project**.
3. Find and import your `off-the-clock` repo.
4. Before clicking Deploy, expand **Environment Variables** and add the same two values from Part 2:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
5. Click **Deploy**.
6. After a minute or two, Vercel gives you a live URL like `off-the-clock.vercel.app`.

---

## Part 5 — Try it

1. Open the URL on your phone.
2. Enter your name to join the group.
3. Go to settings (gear icon) and set the weekly limit and penalty.
4. At the end of the week, take a screenshot of Settings → Screen Time and upload it.
5. Send the link to your friends so they can join too.

---

## Troubleshooting

- **"Failed to fetch" or blank page**: double check your environment variables in Vercel exactly match Supabase (no extra spaces, no quotes).
- **Upload fails**: make sure the `screenshots` bucket exists and is set to **Public**.
- **Changes don't show after editing code**: push to GitHub again — Vercel redeploys automatically on every push to `main`.
