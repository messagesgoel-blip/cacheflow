/**
 * Cookie-based Authentication
 * 
 * Migrates from localStorage token storage to HttpOnly cookies.
 * Provides secure token management without client-side token exposure.
 * 
 * Gate: AUTH-3
 * Task: 1.3@AUTH-3
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'accessToken';
const REFRESH_TOKEN_COOKIE = 'refreshToken';
const USER_DATA_COOKIE = 'userData';

export interface UserData {
  userId: string;
  email: string;
  name?: string;
}

export interface CookieAuthOptions {
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
}

const DEFAULT_OPTIONS: CookieAuthOptions = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

/**
 * Set authentication cookies
 */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string,
  user: UserData,
  options: CookieAuthOptions = {}
): Promise<void> {
  const cookieStore = await cookies();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Access token (short-lived, still HttpOnly for security)
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: 15 * 60, // 15 minutes
  });

  // Refresh token (long-lived, HttpOnly only)
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: '/api/auth', // Restricted path for refresh
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  // User data (non-sensitive, can be readable by client if needed)
  cookieStore.set(USER_DATA_COOKIE, JSON.stringify(user), {
    httpOnly: false, // Allow client to read user data
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Get access token from cookies
 */
export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
}

/**
 * Get refresh token from cookies
 */
export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Get user data from cookies
 */
export async function getUserData(): Promise<UserData | null> {
  const cookieStore = await cookies();
  const userDataCookie = cookieStore.get(USER_DATA_COOKIE)?.value;
  
  if (!userDataCookie) return null;
  
  try {
    return JSON.parse(userDataCookie) as UserData;
  } catch {
    return null;
  }
}

/**
 * Clear all auth cookies
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(USER_DATA_COOKIE);
}

/**
 * Check if user is authenticated (has valid access token)
 */
export async function isAuthenticated(): Promise<boolean> {
  const accessToken = await getAccessToken();
  return !!accessToken;
}

/**
 * Middleware helper - extract auth from cookies
 * Returns auth headers to forward to API calls
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return {};
  }
  
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * Client-side helper - clear localStorage tokens (migration)
 * Call this when migrating from localStorage to cookies
 */
export function migrateFromLocalStorage(): void {
  if (typeof window === 'undefined') return;
  
  // Remove old localStorage tokens
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cacheflow_token_');
  
  // Remove any keys starting with our old prefixes
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('cacheflow_') || key.startsWith('cf_')) {
      localStorage.removeItem(key);
    }
  });
  
  console.log('Migrated from localStorage to HttpOnly cookies');
}
