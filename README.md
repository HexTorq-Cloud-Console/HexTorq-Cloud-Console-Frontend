# HexTorq Cloud Console Frontend

Next.js frontend for the central HexTorq Cloud Console.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` only when Google Identity Services is enabled for the console. The backend independently verifies the returned Google ID token.
