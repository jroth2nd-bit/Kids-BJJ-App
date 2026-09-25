# Kids BJJ App

Browser-based attendance, student, promotion, class notes, calendar, and waiver tools for Black Lotus BJJ.

## Run locally

The app uses ES modules, so serve the repository over HTTP instead of opening `index.html` directly.

```powershell
npx --yes http-server . -p 8000
```

Open [http://127.0.0.1:8000/login.html](http://127.0.0.1:8000/login.html).

## Supabase setup

1. Create or select the project configured in `supabase-client.js`.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Run the migration SQL files in the order required by their names and the migration pages.
4. Configure Supabase Auth and confirm Row Level Security policies before using production data.

The browser client uses a publishable Supabase key. Keep service-role keys and other private credentials out of the repository and local browser code.

## Git workflow

```powershell
git checkout -b feature/short-description
# make and test changes
git add .
git commit -m "Describe the change"
git push -u origin feature/short-description
```
