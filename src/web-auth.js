const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "receipt_auth";
const OAUTH_STATE_COOKIE_NAME = "receipt_oauth_state";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (typeof header !== "string") return "";

  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return "";
}

function sign(value, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`receipt-scanner-session-v1:${value}`)
    .digest("base64url");
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionToken(email, secret, now = Date.now()) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !secret) throw new Error("Session email and signing secret are required.");

  const payload = Buffer.from(JSON.stringify({
    email: normalizedEmail,
    expiresAt: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
  })).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

function isValidSessionToken(token, allowedEmail, secret, now = Date.now()) {
  const normalizedAllowedEmail = normalizeEmail(allowedEmail);
  if (!token || !normalizedAllowedEmail || !secret) return false;

  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1 || token.indexOf(".", separator + 1) !== -1) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, secret))) return false;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return false;

  const nowSeconds = Math.floor(now / 1000);
  return (
    normalizeEmail(claims.email) === normalizedAllowedEmail &&
    Number.isSafeInteger(claims.expiresAt) &&
    claims.expiresAt > nowSeconds &&
    claims.expiresAt <= nowSeconds + SESSION_MAX_AGE_SECONDS + 60
  );
}

function hasValidSession(req, allowedEmail, secret, now = Date.now()) {
  return isValidSessionToken(readCookie(req, SESSION_COOKIE_NAME), allowedEmail, secret, now);
}

function createOAuthState(secret, now = Date.now()) {
  if (!secret) throw new Error("Google client secret is required to start sign-in.");
  const payload = `${Math.floor(now / 1000)}.${crypto.randomBytes(32).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

function isValidOAuthState(cookieState, queryState, secret, now = Date.now()) {
  if (!cookieState || !queryState || !secret || !safeEqual(cookieState, queryState)) return false;

  const parts = cookieState.split(".");
  if (parts.length !== 3) return false;

  const [issuedAtText, nonce, signature] = parts;
  const issuedAt = Number(issuedAtText);
  const payload = `${issuedAtText}.${nonce}`;
  if (!Number.isSafeInteger(issuedAt) || !nonce || !safeEqual(signature, sign(payload, secret))) return false;

  const nowSeconds = Math.floor(now / 1000);
  return issuedAt <= nowSeconds + 30 && issuedAt > nowSeconds - OAUTH_STATE_MAX_AGE_SECONDS;
}

function hasValidOAuthState(req, queryState, secret, now = Date.now()) {
  return isValidOAuthState(readCookie(req, OAUTH_STATE_COOKIE_NAME), queryState, secret, now);
}

module.exports = {
  SESSION_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  OAUTH_STATE_MAX_AGE_SECONDS,
  normalizeEmail,
  createSessionToken,
  hasValidSession,
  createOAuthState,
  hasValidOAuthState,
  isValidOAuthState,
  isValidSessionToken,
};
