# Deploy Individual Training System (ITS) on Vercel

The live site is the GitHub repo `ctante/crew-training-tracker`, branch `main`, at https://mcd-its.vercel.app. Vercel builds that branch for production. The person using ITS only needs that URL and the team password. The repository name and Vercel project stay as they are.

The beta site is branch `beta` at https://crew-training-tracker.vercel.app. New pull requests target `beta`. Merge `beta` into `main` only when promoting to the live restaurants. The beta site shows a BETA / TEST SITE banner because `NEXT_PUBLIC_BETA=1` is set as a Preview variable for the `beta` branch only.

Beta uses its own Neon database. The Neon connection creates a database branch for Preview deployments only, and Production stays on the live branch. Before migrations run, a beta build checks the database host. If that host is the live production branch, the build stops and does not migrate or seed.

The weekly roster sync is retired. People are added under Admin, then Add Trainer / Manager. The old sync address must not be pointed at the beta site.

## 1. Create the Vercel project

1. Sign in at [vercel.com](https://vercel.com) with the GitHub account that owns `ctante/crew-training-tracker`.
2. Add a new project and import that repository.
3. Framework preset: **Next.js**. Leave the root directory as the repository root.
4. Do not change the build command. `vercel.json` sets it to `npm run build`, which applies database migrations, seeds the catalog, then builds the site.

## 2. Connect Neon

1. In the Vercel project, open **Storage** (or the Marketplace) and add **Neon Postgres**. Create a database when it asks.
2. Accept the environment variables it offers for Production, Preview, and Development.
3. Confirm these two names exist. The Neon integration sets them automatically:

| Variable | Set by Neon | Used for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | App queries. This is the pooled connection. |
| `DATABASE_URL_UNPOOLED` | Yes | Prisma migrations during the build. This is the direct connection. |

If the integration uses different names, such as `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING`, copy those values into `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Migrations need the direct string. The app needs the pooled string.

## 3. Add the team password

Set these yourself. Neon does not create them.

| Variable | Required | What to put |
| --- | --- | --- |
| `APP_PASSWORD` | Yes | The shared password for general managers and crew trainers. Use a long password. Everyone on the team uses this one password. |
| `SESSION_SECRET` | Yes | A different random string, at least 32 characters. It signs the sign-in cookie. Generate one and do not reuse the password. |
| `SEED_SAMPLE_DATA` | No | Leave this **unset** on Production. Set it to `true` only on a throwaway database when you want fictional trainees. |

Add `APP_PASSWORD` and `SESSION_SECRET` for Production. Preview deployments need them too if you open those URLs.

## 4. Deploy

Click **Deploy**. The first build runs:

```bash
npm run build
```

which runs:

```bash
node scripts/assert-beta-db.mjs && prisma migrate deploy && tsx prisma/seed.ts && next build
```

The migration creates the tables. The seed adds the 10 restaurants and the English and Spanish module catalog with Campus links. It does not add sample trainees or sample trainers unless `SEED_SAMPLE_DATA=true` and the database has no trainees yet. Running the build again does not duplicate restaurants or modules, and it does not erase people you add later.

Position order (Crew Trainer, Area Manager, Shift Manager, Assistant Manager, General Manager) is part of the deployed code in `src/lib/constants.ts`. It is not an environment variable.

## 5. Hand out the URL

Open the Vercel URL on a phone. The sign-in page asks for a password. The cookie lasts 30 days. The header shows whether you are signed in as the admin (All restaurants) or as one restaurant number. Sign out is in the top bar on a phone and at the bottom of the side menu on a larger screen.

## Store passwords

`APP_PASSWORD` is the admin password. It is the only password that can see every restaurant and the Admin pages.

After the site is up, sign in with that admin password. Open **Admin**, then **Store passwords** (`/admin/access`). Each of the 10 restaurants has its own password. Type a password, type it again, and save. The page shows “Password set” or “No password”. It never shows the password again. A restaurant with no password cannot sign in. Use a different password for each restaurant, and do not reuse the admin password. Any password of at least one character is allowed. When you save a new password, anyone already signed in as that restaurant is signed out.

Give each restaurant only its own password. They will see that restaurant’s trainees, trainers, schedule, and progress. They will not see the other restaurants or the import and roster pages.

## Paths, modules, and scheduled sessions

Each trainee is Foundation plus either Service or Production. The other section stays in the database and stays off that person’s schedule. New trainees choose a path when they are added. The path can be changed on the Individual Training Schedule (ITS) page.

The deploy sets a path for trainees who already have progress. It counts dated or completed Service rows against dated or completed Production rows and keeps the side with more. A tie, or no rows on either side, leaves the path unset. Those people show “Choose path” on their schedule, and the board shows how many still need one. Nothing new is required in the environment variables.

Admin, then Modules (`/admin/modules`), adds a module in English and Spanish, moves modules up or down inside a section, moves a module to another section, and removes a module. The section menu puts it at the end of Orientation, Foundation, Service, or Production, and the Spanish module moves with it. Saved progress stays on that module. A module in Service counts only for trainees on the Service path, and a module in Production counts only for the Production path. Orientation and Foundation count for everyone. If anyone already has a date, a trainer, or a completion on it, the module is archived and the history stays. If nobody has history, it is deleted. Archived modules disappear from schedules. New modules show up for every trainee in that section.

A module link can be a Campus link or a Google Drive video link, one per line. On the schedule, a Drive file has Watch video (it plays in the page) and Open in Drive. A Drive folder has Open folder. Other links stay Open module. Share the Drive file as Anyone with the link.

Saving an English module fills the matching Spanish name and video titles. Time, video count, credit, section, order, and link are copied. A Spanish link that is already different is left as it is. The Spanish wording shows on the English module card and can be edited there. That edit is marked Edited by hand, and later English saves do not replace it. Re-translate replaces it from the current English text. Translate missing Spanish fills modules that still have no Spanish wording, such as a new Orientation module. No new environment variable is required. On Vercel the translation uses the AI Gateway with the deployment’s existing OIDC token and the small Gemini Flash Lite model. If translation does not run, the English module is still saved and the Modules page shows a warning.

The board has a Scheduled sessions view. It opens on today, using Eastern Time, and weeks run Monday through Sunday. Sessions are grouped by trainee. Tabs split Scheduled, Overdue, Done, and All. Overdue is every session dated before today that is not done. A restaurant login sees only that restaurant. The admin login can filter by restaurant.

A trainee who finishes Foundation and their first path can add the other path from the Individual Training Schedule. That date is kept. Progress then counts Foundation plus both paths. Reports are in the main menu. The admin store filter can select any combination of restaurants or the entire organization, and each report includes a total for that selection. A restaurant login only sees its own restaurant.

## Weekly roster sync

The Google Development Report is no longer the roster. Add people under Admin, then Add Trainer / Manager.

`POST /api/sync/roster` is still in place so an old script does not have to be rewritten before it stops. It checks `Authorization: Bearer <SYNC_TOKEN>` the same way as before. A missing token returns `503`. A wrong token returns `401`. A valid token returns `ok: true` and `retired: true`, and does not add, update, or deactivate anyone.

## What fails on the first deploy

- **Missing `DATABASE_URL` or `DATABASE_URL_UNPOOLED`.** The build stops during `prisma migrate deploy` with an error that the environment variable is not set. Connect Neon, or copy the two connection strings into those names, then redeploy.
- **`DATABASE_URL_UNPOOLED` is actually the pooled string.** Migrations can fail with a prepared-statement or advisory-lock error. Use the Neon connection string whose host does not contain `-pooler`.
- **The Vercel project build command was changed to `next build`.** Tables are never created, and the first page load errors. Set the build command back to `npm run build`.
- **`APP_PASSWORD` or `SESSION_SECRET` missing.** The build still succeeds. The sign-in page says access is not configured. Add both variables and redeploy, or add them and open the site again. A new deployment is only required if the variables were missing at runtime and the function cached the empty value; adding them in the dashboard and redeploying is the reliable step.
- **A beta build says it is pointed at the production database.** The Neon preview branch was not used. Leave that deployment failed. Turn Create Database Branch For Deployment back to Preview only, then redeploy `beta`. Do not point the beta site at the live database to get past the check.
- **Neon is still waking up.** The free database sleeps. The first build or first visit can be slow. Run the deploy again if the migration times out once.
- **Sample people are missing.** That is expected. Leave `SEED_SAMPLE_DATA` unset. Add real trainees from the site, or set the flag on an empty database and redeploy once if you want the fictional set.
