# HexTorq Cloud Console Frontend

Next.js frontend for the central HexTorq Cloud Console.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only when Google Identity Services is enabled for the console. The backend independently verifies the returned Google ID token.

Clients can open the **View access** popup to see every FileZilla/SFTP and PostgreSQL credential entry their administrator has assigned to them. Super admins create, view, edit, disable, and delete those entries from the Access section of the administration panel.

The **Service health checks** panel lets a client enable an automatic webhook health schedule, choose the interval, view the next and last run, start all checks manually, and watch webhook and deployment results update live. Results refresh every five seconds while the console is open.
