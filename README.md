# HexTorq Cloud Console Frontend

Next.js frontend for the central HexTorq Cloud Console.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only when Google Identity Services is enabled for the console. The backend independently verifies the returned Google ID token.

Clients can open the **View access** popup to see every FileZilla/SFTP and PostgreSQL credential entry their administrator has assigned to them. Credential lists contain metadata only; passwords are fetched on demand from the backend reveal endpoints, stay masked (blurred, not focusable) until revealed, and are hidden again automatically after 30 seconds. PostgreSQL connection strings are generated without embedding the password. Super admins create, view, edit, disable, and delete entries from the Access section of the administration panel; their one-time temporary passwords and agent enrollment tokens appear only in dedicated dialogs, never in persistent notices.

The **Service health checks** panel lets a client enable an automatic webhook health schedule, choose the interval, view the next and last run, start all checks manually, and watch webhook and deployment results update live. Results refresh every five seconds while the console is open.

The **Service details** drawer shows overview, PM2 metrics (with an explicit unavailable state when telemetry is missing), and that service's deployment history. Press `Ctrl+K` / `Cmd+K` to open the role-aware command palette for navigation and service search.
