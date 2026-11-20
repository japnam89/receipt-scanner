/**
 * Authentication routes for Google OAuth flow.
 * Handles sign-in, state generation, and callback handling.
 */

import { Router } from "express";
import multer from "multer";
import { 
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  hasValidSession,
  createOAuthState,
  hasValidOAuthState,
  allowedGoogleEmail,
  noCache,
} from "./web-auth.js";
import config from "./config.js";

const router = Router();

// Mount point for these routes in parent module
export const authRoutesPath = "/api/auth";

/**
 * Check if user is an authorized Google account.
 */
function isAuthenticated(req) {
  return hasValidSession(req, config.oauth.googleDriveFolderId ?? "", process.env.GOOGLE_CLIENT_SECRET || "");
}

/**
 * Allow list of Google emails for session verification.
 */
function allowedEmails() {
  if (process.env.GOOGLE_ALLOWED_EMAIL) {
    return [process.env.GOOGLE_ALLOWED_EMAIL.trim().toLowerCase()];
  }
  return [];
}

/**
 * Check if the requested email is in the allowlist.
 */
function hasAllowedEmail(req) {
  const cookie = req.headers.cookie;
  if (!cookie) return false;
  
  // Try to extract email from session cookie
  try {
    const authCookie = cookie.split(";").find(c => c.startsWith("receipt_auth="));
    if (authCookie) {
      const decoded = JSON.parse(Buffer.from(authCookie.substring(9), "base64").toString());
      return allowedEmails().includes(decoded.email);
    }
  } catch {
    // Ignore decoding errors
  }
  return false;
}

/**
 * Send authentication error page.
 */
function authErrorPage(title, message) {
  const signInPath = `/auth`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | Receipt Scanner</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:16px system-ui,sans-serif}.panel{width:min(420px,calc(100% - 40px));text-align:center}.mark{font-size:32px}h1{font-size:26px;margin:14px 0 8px}.muted{color:#94a3b8;line-height:1.5}.button{margin:24px auto 0;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:6px;background:#2563eb;color:white;font-size:15px;font-weight:600;text-decoration:none}</style></head>
<body><main class="panel"><div class="mark" aria-hidden="true">&#128221;</div><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(message)}</p><a class="button" href="${escapeHtml(signInPath)}">Back to sign in</a></main></body></html>`;
}

/**
 * Sign-in page route.
 */
router.get("/sign-in", (req, res) => {
  noCache(res);
  
  // Check if email is configured
  if (!process.env.GOOGLE_ALLOWED_EMAIL) {
    return res.status(503).type("html").send(authErrorPage(
      "Sign-in not configured",
      "The authorized Google account has not been configured on this server.",
    ));
  }

  // Check if already authenticated
  if (hasValidSession(req)) {
    return res.redirect(`/${config.api.basePath || "/"}`);
  }

  const basePath = config.api.basePath;
  const state = createOAuthState(process.env.GOOGLE_CLIENT_SECRET);

  res.type("html").send({
    basePath,
    state: state.substring(0, 16), // Don't send full token in URL
    signInUrl: `${process.env.OAUTH_REDIRECT_URI || "http://localhost:4000"}/${state}`,
  });
});

/**
 * Generate OAuth state for CSRF protection.
 */
router.post("/generate-state", (req, res) => {
  try {
    const state = createOAuthState(process.env.GOOGLE_CLIENT_SECRET);
    res.json({ state, valid: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate OAuth state" });
  }
});

/**
 * Exchange authorization code for tokens.
 */
router.post("/exchange-code", async (req, res) => {
  noCache(res);
  
  try {
    const { code } = req.body;
    
    if (!code || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(400).json({ error: "Missing authorization code or client secret" });
    }

    // Exchange code for tokens
    const tokens = await exchangeCode(code);
    
    // Verify email match
    if (!allowedEmails().includes(tokens.profile.email.toLowerCase())) {
      return res.status(403).json({ 
        error: "Google account not authorized",
        message: "This scanner is only available to its configured Google account."
      });
    }

    // Save tokens and create session token
    await saveTokens(tokens.tokens);
    const sessionToken = createSessionToken(tokens.profile.email, process.env.GOOGLE_CLIENT_SECRET);

    return res.redirect(`${config.api.basePath || "/"}?afterAuth=1`);
  } catch (error) {
    noCache(res);
    return res.status(500).json({ error: "Google sign-in failed" });
  }
});

/**
 * OAuth callback handler.
 */
router.get("/callback", async (req, res) => {
  noCache(res);
  
  try {
    const { error, code, state } = req.query;

    // Check for errors
    if (error || !code || !state) {
      return res.status(400).type("html").send(authErrorPage(
        "Sign-in could not be verified",
        "Please start again from the sign-in page.",
      ));
    }

    // Validate state (CSRF protection)
    const valid = await validateOAuthState(state);
    if (!valid) {
      return res.status(400).type("html").send(authErrorPage(
        "Sign-in could not be verified",
        "Please start again from the sign-in page.",
      ));
    }

    // Check for errors from Google
    if (error === "access_denied" || error === "permission_denied") {
      return res.status(403).type("html").send(authErrorPage(
        "Permission Denied",
        "This Google account is not authorized to use this scanner.",
      ));
    }

    // Exchange code for tokens
    const { tokens, profile } = await exchangeCode(code);

    // Check email match
    if (!allowedEmails().includes(profile.email.toLowerCase())) {
      return res.status(403).type("html").send(authErrorPage(
        "Google account not authorized",
        "This receipt scanner is only available to its configured Google account.",
      ));
    }

    // Save tokens and redirect
    await saveTokens(tokens);
    const sessionToken = createSessionToken(profile.email, process.env.GOOGLE_CLIENT_SECRET);
    
    const redirectUrl = `${config.api.basePath || "/"}?afterAuth=1`;
    return res.redirect(redirectUrl);
  } catch (error) {
    noCache(res);
    return res.status(500).type("html").send(authErrorPage("Google sign-in failed", error.message));
  }
});

/**
 * Logout - clear session cookie.
 */
router.post("/logout", (req, res) => {
  noCache(res);
  
  const options = {
    httpOnly: true,
    secure: req.secure || false,
    sameSite: "lax",
    path: config.api.basePath || "/",
  };

  res.clearCookie(SESSION_COOKIE_NAME, options);
  res.status(204).end();
});

/**
 * Check if a session is valid for an email.
 */
function validateSessionToken(email, secret) {
  const cookie = req.headers.cookie;
  if (!cookie) return false;
  
  try {
    const authCookie = cookie.split(";").find(c => c.startsWith("receipt_auth="));
    if (authCookie) {
      const decoded = JSON.parse(Buffer.from(authCookie.substring(9), "base64").toString());
      const now = Date.now();
      return Number(decoded.expiresAt) > now && Number(decoded.expiresAt) < now + 1000;
    }
  } catch {}
  return false;
}

/**
 * Validate OAuth state.
 */
async function validateOAuthState(cookieState) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!cookieState || !secret) return false;
  
  try {
    const parts = cookieState.split(".");
    if (parts.length !== 3) return false;

    const [issuedAtText, nonce, signature] = parts;
    const issuedAt = Number(issuedAtText);
    const now = Date.now();
    
    // Check timestamp freshness
    if (issuedAt < now - 60 * 10 || issuedAt > now + 30 * 1000) return false;

    const payload = `${issuedAtText}.${nonce}`;
    const expectedSignature = await sign(payload, secret);
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Sign a token with HMAC.
 */
function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(`receipt-scanner-session-v1:${payload}`).digest("base64url");
}

/**
 * Exchange authorization code for tokens and profile.
 */
async function exchangeCode(code) {
  const client = google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    [process.env.OAUTH_REDIRECT_URI || `http://localhost:${process.env.PORT || 4000}/oauth2callback`]
  );
  
  client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
  
  const tokens = await client.getToken(code);
  const profile = await getProfile(client);
  
  return { tokens, profile };
}

/**
 * Save OAuth tokens to file.
 */
async function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  fs.chmodSync(TOKEN_PATH, 0o600);
}

/**
 * Get authenticated user profile.
 */
async function getProfile(client) {
  const drive = google.drive({ version: "v3", auth: client });
  const response = await drive.about.get({ fields: "user(displayName,emailAddress)" });
  return {
    name: response.data.user?.displayName || "",
    email: response.data.user?.emailAddress || "",
  };
}

export { 
  router, 
  authRoutesPath,
  validateSessionToken,
  validateOAuthState,
  exchangeCode,
  saveTokens,
  getProfile,
};
