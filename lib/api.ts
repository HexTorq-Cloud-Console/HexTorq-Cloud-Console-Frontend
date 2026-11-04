// Shared API plumbing: base URL, token storage key, and response helpers.
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'hextorq_token';async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
export { apiUrl, TOKEN_KEY, responseJson, errorMessage };
