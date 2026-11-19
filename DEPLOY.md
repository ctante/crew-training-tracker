# Deploy Crew Training Tracker on Vercel

The live site is the GitHub repo `ctante/crew-training-tracker`, branch `main`. Vercel builds that branch. The person using the tracker only needs the site URL and the team password.

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
prisma migrate deploy && tsx prisma/seed.ts && next build
```

The migration creates the tables. The seed adds the 10 restaurants and the English and Spanish module catalog with Campus links. It does not add sample trainees or sample trainers unless `SEED_SAMPLE_DATA=true` and the database has no trainees yet. Running the build again does not duplicate restaurants or modules, and it does not erase people you add later.

Position order (Crew Trainer, Area Manager, Shift Manager, Assistant Manager, General Manager) is part of the deployed code in `src/lib/constants.ts`. It is not an environment variable.

## 5. Hand out the URL

Open the Vercel URL on a phone. The sign-in page asks for a password. The cookie lasts 30 days. The header shows whether you are signed in as the admin (All restaurants) or as one restaurant number. Sign out is in the top bar on a phone and at the bottom of the side menu on a larger screen.

## Store passwords

`APP_PASSWORD` is the admin password. It is the only password that can see every restaurant and the Admin pages.

After the site is up, sign in with that admin password. Open **Admin**, then **Store passwords** (`/admin/access`). Each of the 10 restaurants has its own password. Type a password, type it again, and save. The page shows “Password set” or “No password”. It never shows the password again. A restaurant with no password cannot sign in. Use a different password for each restaurant, and do not reuse the admin password. When you save a new password, anyone already signed in as that restaurant is signed out.

Give each restaurant only its own password. They will see that restaurant’s trainees, trainers, schedule, and progress. They will not see the other restaurants or the import and roster pages.

## What fails on the first deploy

- **Missing `DATABASE_URL` or `DATABASE_URL_UNPOOLED`.** The build stops during `prisma migrate deploy` with an error that the environment variable is not set. Connect Neon, or copy the two connection strings into those names, then redeploy.
- **`DATABASE_URL_UNPOOLED` is actually the pooled string.** Migrations can fail with a prepared-statement or advisory-lock error. Use the Neon connection string whose host does not contain `-pooler`.
- **The Vercel project build command was changed to `next build`.** Tables are never created, and the first page load errors. Set the build command back to `npm run build`.
- **`APP_PASSWORD` or `SESSION_SECRET` missing.** The build still succeeds. The sign-in page says access is not configured. Add both variables and redeploy, or add them and open the site again. A new deployment is only required if the variables were missing at runtime and the function cached the empty value; adding them in the dashboard and redeploying is the reliable step.
- **Neon is still waking up.** The free database sleeps. The first build or first visit can be slow. Run the deploy again if the migration times out once.
- **Sample people are missing.** That is expected. Leave `SEED_SAMPLE_DATA` unset. Add real trainees from the site, or set the flag on an empty database and redeploy once if you want the fictional set.
