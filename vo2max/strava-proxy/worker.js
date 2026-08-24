/*
 * Cloudflare Worker: the one piece of backend this otherwise-static app
 * needs. Strava's OAuth token exchange/refresh requires a client_secret,
 * which can never be shipped to the browser - so this tiny proxy holds it
 * (as a Worker secret, never in source) and does only those two calls on
 * the app's behalf. Everything else (the initial authorize redirect, and
 * reading activities with an access token) happens straight from the
 * browser to Strava - see js/strava.js.
 *
 * Deploy: see the "Strava sync" section of vo2max/README.md.
 *
 * Env vars this Worker needs (set via `wrangler secret put` or the
 * Cloudflare dashboard - never committed to source):
 *   STRAVA_CLIENT_ID      - Strava app's Client ID (not secret, but kept
 *                            here too so the Worker is self-contained)
 *   STRAVA_CLIENT_SECRET  - Strava app's Client Secret (the whole reason
 *                            this Worker exists)
 *   ALLOWED_ORIGIN         - the app's origin, e.g. https://you.github.io
 *                            (CORS - only this origin may call the proxy)
 */

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'not found' }, 404, env);
    }

    const url = new URL(request.url);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400, env);
    }

    let params;
    if (url.pathname === '/exchange') {
      if (!body.code) return json({ error: 'missing code' }, 400, env);
      params = {
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        code: body.code,
        grant_type: 'authorization_code',
      };
    } else if (url.pathname === '/refresh') {
      if (!body.refresh_token) return json({ error: 'missing refresh_token' }, 400, env);
      params = {
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        refresh_token: body.refresh_token,
        grant_type: 'refresh_token',
      };
    } else {
      return json({ error: 'not found' }, 404, env);
    }

    const stravaResp = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await stravaResp.json().catch(() => ({ error: 'invalid response from Strava' }));
    return json(data, stravaResp.status, env);
  },
};
