# Individual Training System (ITS)

A phone-friendly desk for general managers and crew trainers. It replaces the per-trainee Individual Training Schedule (ITS) tabs: one 36-module path, a date and a trainer on each row, and a store agenda of sessions that are scheduled and still open.

Crew members do not have their own logins. The admin password opens every restaurant. Each restaurant can have its own password, set from Admin → Store passwords, and that login sees only that restaurant.

## Run locally

Install Postgres, or use a Neon dev branch. Copy `.env.example` to `.env` and set both database URLs to that database. For a Neon branch they are the pooled and direct strings Neon shows you. For Postgres on this machine they can be the same URL.

```bash
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000 and sign in with `APP_PASSWORD`.

`db:setup` applies migrations and loads the 10 restaurants and 36-module catalog. With `SEED_SAMPLE_DATA=true` it also adds fictional trainees, but only when the database has none yet. `npm run db:reset` drops the database and loads the catalog plus sample people.

Production deployment is in `DEPLOY.md`. The shared password and session secret are set on Vercel, and sample people are left off the live site.

## Live site and beta site

The restaurants use the live site: https://mcd-its.vercel.app. That address follows the `main` branch and the live database.

Ongoing development uses the beta site: https://crew-training-tracker.vercel.app. That address follows the long-lived `beta` branch and a separate database copied from live. A yellow-red banner reading **BETA / TEST SITE** is shown only there, from the `NEXT_PUBLIC_BETA` flag set on that branch.

New work opens a pull request into `beta`. When Chris says to promote, merge `beta` into `main`. That updates the live site. Do not open routine work against `main`.

The weekly roster sync must post to https://mcd-its.vercel.app/api/sync/roster. The old address is the beta site now, so a sync pointed there would change the test database instead of the live one.

The database is only touched through `src/lib/data.ts`. Neon hosts use the Neon serverless driver. Any other Postgres URL uses Prisma's standard client.

## What is on each page

- **Board** (`/`): active trainees, store filter, percent complete, current section, next session, overdue and stalled flags.
- **Schedule**: per-store calendar of scheduled modules that are not completed, with the assigned trainer.
- **Trainee**: the 36 steps for one person. Set the date, qualified trainer, completed checkbox, completed date, and notes. Campus rows have an Open module link. Each section has a progress bar.
- **Path**: the English and Spanish module list, including video titles and links that still contain a personal `regId`.
- **Admin**: restaurant names, people, module links, ITS import/export, and the Development Report roster.

## Development Report trainers

In the sheets, the Trainer column is a dropdown fed by the Development Report roster (name, restaurant, position). This app stores that roster on each restaurant.

- A trainer appears in a module dropdown only when they are **qualified**, **active**, and at the **same restaurant** as the trainee.
- Lists and dropdowns are grouped by position, then sorted by name.
- The order lives in one constant, `TRAINER_POSITION_ORDER`, in `src/lib/constants.ts`:

  Crew Trainer, Area Manager, Shift Manager, Assistant Manager, General Manager

  Sheet abbreviations such as `Gen Mgr`, `Asst Mgr`, `Shift Mgr`, and `Area Mgr` sort into those same groups. Anything else sorts after them.

- Upload a roster at `/admin/roster` with columns `Name`, `Store`, `Position`, `Qualified` (`Yes` or `No`). `Store` can be `05207` or `5207`. If the Qualified column is missing, every row is qualified.
- The file is the roster for the restaurants it names. People previously imported from a Development Report at those restaurants, and missing from the new file, are marked not qualified. Sample trainers are kept unless a row matches their name.
- Orientation remains available on the first module as a label.

### Google Sheets hook

CSV upload and a future sheet sync both implement `DevelopmentReportSource` in `src/lib/roster/source.ts`. Neither implementation writes to the database. `syncDevelopmentReport` in `src/lib/data.ts` is the writer.

`src/lib/roster/google-sheets.ts` is the plug-in point. It currently reads a published CSV from `DEVELOPMENT_REPORT_CSV_URL`. Replace `pull()` there with a Sheets API call and keep the same return shape (`name`, `storeNumber`, `position`, `qualified`). The Admin roster page has a Sync button that calls this adapter.

## Sample data

Every sample person uses the last name Sample. Each restaurant has six qualified sample trainers covering the five positions above, and two or three sample trainees at different points on the path. Dates are written around 18 November 2026.

- **Overdue**: a training date before today, still open.
- **Due today**: scheduled for the Eastern Time date.
- **Stalled**: active, started at least 14 days ago, no completion in the last 14 days, and no upcoming date.
- Restaurants are shown by number only: 05207, 07276, 11237, 11350, 12956, 12958, 22171, 28182, 33853, and 33965.

## ITS import and export

A single trainee tab exports as `Module, Time, Videos, Credit, Date, Trainer, Completed`. Dates use the sheet’s long form (`Wednesday, November 4, 2026`). Completed is `TRUE` or `FALSE`.

The all-restaurant export adds store, trainee, language, position, start date, status, section, completed date, and notes. Duplicate module names (Fries, Hashbrowns, the assembly rows) match on name plus time.

## Assumptions

- All 36 rows are one path. The sheet does not mark any row optional.
- Percent complete is completed modules divided by 36.
- Scheduling is a calendar date plus a trainer. The sheet has no start time.
- English and Spanish are two copies of the same 36 steps so a link can differ. Switching a trainee’s language keeps checks and dates on the same step numbers.
- Campus links open in a new tab and still require a Campus login.
- Grilling (both languages) is flagged **Needs review** because the URL contains a personal `regId`. MOP with ROA Simulation uses the same kind of link, and that one is marked OK because it works for everyone. Admin can mark any other flagged link OK.
- The HazMat module name still includes the master-sheet id `5207 / 162067`.
- Block labels such as `3 hr 30 min` and `4 hr` are the column A estimates from the ITS template. Row times are shown separately.
- There is one shared desk. GMs and crew trainers are not separate logins yet.
