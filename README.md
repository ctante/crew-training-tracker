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

The weekly Google roster sync is retired. People are added under Admin, then Trainer / Manager. `POST /api/sync/roster` is still there and still checks its token, but it does not change the roster.

## Users

Admin, then Users, holds individual accounts. Each account has a name, a username or email, a password an admin sets, a role, restaurants, and active or inactive. The password is stored hashed and is not shown again. Deactivating someone or setting a new password signs them out. The list shows the last sign-in.

Roles start with these permissions. An admin can change any box for one person. A box that differs from the role is marked Override, and Reset to role defaults clears that. Only an admin can turn on Manage users, Manage modules, Manage roster and import, Manage store logins, or View other stores. Role defaults for User, Manager, and Supervisor can be edited under Admin, then Role defaults. Admins always keep every permission as the role starting point. The last active Admin cannot be deactivated or demoted.

- **User** signs off modules for one restaurant. A restaurant password becomes a User whose username is the restaurant number. People can still leave the username blank and enter that password.
- **Manager** can also schedule sessions, add trainees, and run reports for one restaurant.
- **Supervisor** can do that across the assigned restaurants, and can manage Managers and Users for those restaurants.
- **Admin** can do everything, including modules, the roster, import, and store logins. The admin password still signs in with the username left blank.

A person only sees the restaurants on the account. Reports, the board, the schedule, and the development week follow that limit on the server.

## Development

Development is the weekly sheet for managers and crew trainers, and it is now the roster. Weeks run Monday through Sunday and are labeled like Week of 11/23-11/29. The first view shows people who have hours, a development activity, or comments. If the current week has none, the page opens the latest week that already has work, or the next week that has work. Edit lists every active person on the roster. Show everyone does that without editing. Someone with Edit development and Manage roster can add a person, change the name, restaurant, or position, or remove them. Removing keeps past weeks and training history. The same name cannot be added twice at one restaurant. Hours are a dropdown from 0.5 to 10. Development Activity is a dropdown an admin maintains under Admin, then Development Activity, and the choices stay in alphabetical order. The Spanish label is Actividad de desarrollo. New trainers and managers are added under Admin, then Trainer / Manager. Add work records hours or an activity for someone already on the roster. Comments stay free text. Copy last week carries the previous week forward. Download CSV uses Employee, Restaurant, Position, Training Hours Needed, Development Activity, Comments.

Managers and supervisors can view it. Admins can edit it, and can grant Edit development to someone else. An admin can also import a CSV of those columns into the week on screen. That import is the way to load a sheet onto the live site later. A beta deploy loads the bundled sheet by itself. A production deploy does not.

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

- Add a person under Admin, then Trainer / Manager. The positions are Gen Mgr, Asst Mgr, Shift Mgr, Area Mgr, and Crew Trainer. Each one is a qualified trainer at that restaurant.
- Removing a person hides them from the roster and from trainer dropdowns. Their past development weeks and assigned sessions stay.
- Orientation remains available on the first module as a label.

The old weekly sheet sync is not used. `POST /api/sync/roster` answers without writing. Admin, then Trainer roster, only lists the people already on the roster.

## Sample data

Every sample person uses the last name Sample. Each restaurant has six qualified sample trainers covering the five positions above, and two or three sample trainees at different points on the path. Dates are written around 18 November 2026.

- **Overdue**: a training date before today, still open.
- **Due today**: scheduled for the Eastern Time date.
- **Stalled**: active, started at least 14 days ago, no completion in the last 14 days, and no upcoming date.
- Restaurants are shown by number only: 05207, 07276, 11237, 11350, 12956, 12958, 22171, 28182, 33853, and 33965.

## ITS import and export

A single trainee tab exports as `Module, Time, Videos, Credit, Date, Trainer, Completed`. Dates use the sheet’s long form (`Wednesday, November 4, 2026`). Completed is `TRUE` or `FALSE`.

The all-restaurant export adds store, trainee, language, position, start date, status, section, completed date, and notes. Duplicate module names (Fries, Hashbrowns, the assembly rows) match on name plus time.

## Employee roster sync

`POST /api/roster/sync` replaces the people at the restaurants included in the body. Authorize it with `Authorization: Bearer <SYNC_TOKEN>`. The token is not written to logs. A missing token returns 503. A wrong token returns 401.

Send either a JSON array or the MyQSRSoft CSV. For the CSV, post the file as the body with `Content-Type: text/csv` and this header:

```csv
Store,Name,Job Title
05207,Alex Rivera,PRIMARY MAIN. PERSON
```

`PRIMARY MAIN. PERSON` and `BACKUP MAINTENANCE PERSON` are stored as `Crew Person`. Other job titles are stored in Title Case, such as `Cert. Swing Mgr.` The file is the active roster. Anyone at those restaurants who is missing from it is marked inactive. There is no employee id in this file, so people match on the restaurant plus the name.

Or send a JSON array. Each object is one employee:

```json
[
  { "store": "05207", "employeeId": "qsr-1001", "name": "Alex Rivera", "position": "Crew" },
  { "store": "05207", "name": "Jordan Lee", "position": "Shift Mgr" }
]
```

`store` is the restaurant number. `name` is required. `employeeId` and `position` are optional. A person with `employeeId` matches that id at the restaurant, or a row at that restaurant with the same name and no id yet. Otherwise the match is the restaurant plus the name, ignoring case and extra spaces.

People already there are updated. A person who was inactive and appears again is reactivated. A new name is added. Anyone at those restaurants who is missing from the array is marked inactive and is not deleted. Restaurants that are absent from the array are left alone. Unknown restaurant numbers are ignored.

```json
{ "ok": true, "added": 1, "updated": 1, "deactivated": 0, "reactivated": 0 }
```

The beta database starts with an empty Employee table. Existing trainees and trainers are linked only when one employee at that restaurant has the same normalized name. If two employees share a name, nobody is linked from that name, and unlinked people stay visible.

## Conventions

Grouped lists and long lists start collapsed. Each header shows a count. Expand all and Collapse all sit above the list. Print still shows the contents. New grouped lists follow the same pattern.

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
