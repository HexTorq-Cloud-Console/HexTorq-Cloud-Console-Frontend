export type ConsoleSession = {
  token: string;
  role: string;
  email: string;
  forcePasswordChange: boolean;
};

let cachedSession: ConsoleSession | null = null;

export function readSessionCache() {
  return cachedSession;
}

export function writeSessionCache(session: ConsoleSession | null) {
  cachedSession = session;
}

export function clearSessionCache() {
  cachedSession = null;
}
