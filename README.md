# Shanghai Trip Control

A mobile-friendly shared trip and expense app converted from the supplied Excel workbook. It includes:

- dashboard with planned vs actual spending, category totals, and settlement balances;
- expense entry in HKD or RMB, payer, contributors, and equal/custom splits;
- itinerary and flight option management;
- shared reminders;
- participant and exchange-rate settings;
- one-tap export of the latest shared data to a six-sheet Excel `.xlsx` workbook;
- optimistic concurrency protection when two people edit at the same time.

## Where the data lives

GitHub stores the source code and the initial data imported from Excel. Live edits are stored in **Netlify Database**, so every phone or PC opening the same Netlify link sees the same records. GitHub is not used as a live database because that would expose a GitHub write token in the browser.

This version has no login. Anyone with the Netlify link can view and edit the data.

## Deploy from GitHub to Netlify

1. Create an empty GitHub repository.
2. Upload the **contents of this folder** to the repository root. Keep the `public` and `netlify` folders intact.
3. In Netlify, choose **Add new project → Import an existing project → GitHub**.
4. Select the repository. Netlify reads `netlify.toml`; leave the build command empty and deploy.
5. The included database migration creates the table and imports the workbook's current records on the first deploy.
6. Open the Netlify URL and make a small test edit. Open the same URL on another device to confirm it syncs.

Netlify Database requires a compatible credit-based Netlify plan.

## Local development

Install dependencies and run Netlify Dev:

```bash
npm install
npx netlify dev
```

The app intentionally uses no external JavaScript or CSS CDN, so the user interface remains self-contained.

## Important deployment notes

- Do not deploy only `public/index.html` with Netlify Drop. Netlify Drop does not apply the database migration or server function.
- Use the GitHub import workflow above for the shared-data version.
- The database starts with the records imported from `20261008_ATP_ShangHai_Trip_Expense_Manager(1).xlsx`.
- To reset the live database to the original workbook data, delete/recreate the Netlify project database or create a new migration deliberately. Do not edit the old migration after it has run.
