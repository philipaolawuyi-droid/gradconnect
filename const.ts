export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Direct Google OAuth route. The server builds the Google authorization URL
// and owns the callback, so the sign-in flow never passes through Manus.
export const getLoginUrl = () => "/api/auth/google";
