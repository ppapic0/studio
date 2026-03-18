# WordPress Local Setup - Academy + Study Cafe

## 1) Prerequisites

- Docker Desktop
- If `docker` is not recognized in PowerShell, reopen terminal after Docker Desktop install.

## 2) Start locally (PowerShell on Windows)

```powershell
Copy-Item .env.example .env
docker compose up -d
```

If command not found, use full path:

```powershell
& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' compose up -d
```

One-command start script:

```powershell
.\start-local.ps1
```

If you prefer Git Bash:

```bash
cp .env.example .env
docker compose up -d
```

Open: http://localhost:8080

On first run, complete WordPress installation screen.

This project is already initialized with:

- Site title: `트랙 국어 학원 | 트랙 관리형 스터디카페`
- Admin URL: `http://localhost:8080/wp-admin`
- Admin user: `trackadmin`
- Admin password: `Track!2026!Local`

## 3) Activate the custom theme

1. Go to `Appearance > Themes`
2. Activate `Academy Cafe`
3. (Optional) Go to `Settings > Reading` and ensure homepage displays latest posts or static page as desired

## 4) Edit content

Theme files are in:

- `wp-content/themes/academy-cafe/front-page.php`
- `wp-content/themes/academy-cafe/assets/css/main.css`

## 5) Stop

```powershell
docker compose down
```

Or:

```powershell
.\stop-local.ps1
```

## 6) Deploy later to a real domain

When ready, migrate using one of these:

- All-in-One WP Migration plugin export/import
- Duplicator plugin package migration
- Manual DB + `wp-content` migration

Also remember to change:

- WordPress Address (URL)
- Site Address (URL)
- Permalinks re-save after migration
