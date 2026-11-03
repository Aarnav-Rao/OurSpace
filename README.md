# OurSpace

React + TypeScript + Tailwind + Supabase (auth, Postgres, private storage, realtime). Framer Motion and Lucide for motion and icons.

## Setup
1. Create a Supabase project.
2. SQL editor: run `schema.sql`, then `migration_002.sql`.
   (If you already ran `schema.sql` from the first version, run only `migration_002.sql`. It is safe to re-run, drops no data, and also tightens the answers insert policy, locks the invite join against races, enables full replica identity for realtime deletes, and restricts the two RPC functions to signed-in users.)
3. Authentication > Providers > Email. For quick testing turn off "Confirm email".
4. `cp .env.example .env` and fill in your project URL and anon key (Settings > API).
5. `npm install && npm run typecheck && npm run build`, then `npm run dev`
6. Person A signs up and creates the space, then copies the invite code from Settings. Person B signs up and joins with it.

## Where things are
- `schema.sql`, `migration_002.sql`: tables, RLS, private `photos` bucket, realtime.
- `src/lib.tsx`: shared types, signed-URL cache, realtime hook, upload/export helpers, Sheet, Avatar.
- One file per area: Calendar, Bucket, Dates, Us (milestones), Memories, Albums (+On this day), History, Search, Settings, Upcoming (home).

## Not verified (needs you)
`npm install` could not run where this was written (no network), so the project has never been installed, built with Vite, or run against a real Supabase project.
Checked only: every file parses; every cross-file import resolves to a real export; and a TypeScript pass against hand-written stand-ins for React, Supabase, Framer Motion and Lucide (this found and fixed a missing `Mem` import). Type errors that depend on the real library typings can only show up on your machine.

Manual checks required:
- `npm install`, then `npx tsc --noEmit` and `npm run build`; fix any type errors.
- Both accounts: sign up, create + join, confirm each sees the same data.
- RLS: with a third account, confirm no workspace data or photos are readable or writable.
- Storage: upload, signed-URL display, delete; profile photo; album ZIP and all-photos ZIP downloads.
- Realtime: change something on one device and watch the other (check Database > Replication lists the tables).
- Daily-question privacy: one answer stays hidden from the partner until the second is saved.
- Calendar yearly repeats, reminders display, month navigation; bucket and date "Save as memory"; random date filters.
- Dark mode on every page and sheet; mobile layout and bottom nav.

## Known limits
- Reminders appear on Home and in Upcoming; there are no push, email or browser notifications.
- A memory belongs to one album.
- Bucket-list entries and memories made from them share one stored image file.
- Search matches text columns only (not dates). Memories can be filtered by date text in Memories.
- Export of very large photo libraries builds the ZIP in the browser and may be slow on phones.

## No local npm? Build it in the cloud
- **StackBlitz:** stackblitz.com > Start a new project > import the unzipped folder. It runs `npm install` and the dev server inside the browser.
- **GitHub + Vercel (best for daily use on two phones):** upload the unzipped folder to a new GitHub repo, import the repo on vercel.com (Vite is auto-detected), and add the env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Vercel runs `npm install` and `npm run build` for you and gives you a URL.
- **GitHub Codespaces:** open the repo in a Codespace and run the commands there.
- After deploying, add the site URL in Supabase > Authentication > URL Configuration (Site URL and Redirect URLs), or email confirmation links will point to the wrong place.
- Windows PowerShell "running scripts is disabled": use `npm.cmd install` or Command Prompt, or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Deploy on GitHub Pages (no local npm)
1. Put the files from this folder at the top level of a new GitHub repo (branch `main`). `.github/workflows/deploy.yml` must come along.
2. Repo Settings > Secrets and variables > Actions > New repository secret: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Repo Settings > Pages > Source: **GitHub Actions**.
4. Actions tab > "Deploy to GitHub Pages" > Run workflow (or push a commit). The site appears at `https://<user>.github.io/<repo>/`.
5. Supabase > Authentication > URL Configuration: set Site URL and Redirect URLs to that address.
Free GitHub Pages needs a public repo. The code is public but your data is not: it is protected by Supabase Row Level Security, and no secret keys are in the repo.
