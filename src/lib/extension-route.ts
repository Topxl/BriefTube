import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { ZodSchema } from "zod";
import type { Database } from "@/types/supabase";

/**
 * Extension-aware route wrapper for /api/extension/*.
 *
 * Differences from `authRoute`:
 * - Accepts `Authorization: Bearer <jwt>` in addition to cookies (extensions
 *   can't rely on Supabase SSR cookies).
 * - Adds CORS headers so `chrome-extension://` origins can call it.
 * - When no auth is present, user is null (endpoints decide what to allow anon).
 *
 * Usage:
 *   export const POST = extensionRoute
 *     .body(schema)
 *     .handler(async (req, { body, user, cors }) => { ... });
 *   export const OPTIONS = corsPreflight;
 */

const STATIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Device-Id, X-Extension-Version",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/**
 * Return the CORS Allow-Origin value for this request, or null if the origin
 * is not trusted. We reflect the Origin header (rather than sending `*`) so
 * callers can't forge requests from arbitrary third-party sites.
 *
 * Accepted:
 *   - chrome-extension://<id> (extension background/content scripts)
 *   - https://{brief-tube.com, www.brief-tube.com, staging.brief-tube.com, ...}
 *   - http(s)://localhost:* (dev only)
 */
function resolveAllowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;

  if (origin.startsWith("chrome-extension://")) return origin;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return null;
  }

  const host = parsed.hostname;
  if (host === "brief-tube.com" || host.endsWith(".brief-tube.com")) {
    return origin;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    (host === "localhost" || host === "127.0.0.1")
  ) {
    return origin;
  }

  return null;
}

function buildCorsHeaders(req: NextRequest): Record<string, string> {
  const allowOrigin = resolveAllowedOrigin(req);
  if (!allowOrigin) {
    // No CORS headers emitted → browser blocks cross-origin access.
    // Same-origin (brief-tube.com calling its own API) still works since
    // browsers don't enforce CORS on same-origin requests.
    return { Vary: "Origin" };
  }
  return {
    ...STATIC_CORS_HEADERS,
    "Access-Control-Allow-Origin": allowOrigin,
  };
}

export function corsPreflight(req: NextRequest): Response {
  return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
}

function withCors(req: NextRequest, res: Response | NextResponse): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(buildCorsHeaders(req))) {
    headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

type ExtensionUser = {
  id: string;
  email: string | null;
  avatarUrl: string | null;
} | null;

function readAvatar(user: { user_metadata?: unknown }): string | null {
  const meta = user.user_metadata as
    | { avatar_url?: unknown; picture?: unknown }
    | undefined;
  const raw = meta?.avatar_url ?? meta?.picture;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

type Handler<TContext> = (
  req: NextRequest,
  context: TContext,
) => Promise<Response | NextResponse | object>;

async function resolveUser(req: NextRequest): Promise<ExtensionUser> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    const client = createSupabaseClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error || !user) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      avatarUrl: readAvatar(user),
    };
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      avatarUrl: readAvatar(user),
    };
  } catch {
    return null;
  }
}

class ExtensionRouteBuilder<TBody = unknown, TParams = unknown> {
  private bodySchema?: ZodSchema;
  private requireAuth = false;

  body(schema: ZodSchema) {
    const clone = new ExtensionRouteBuilder<TBody, TParams>();
    clone.bodySchema = schema;
    clone.requireAuth = this.requireAuth;
    return clone;
  }

  requireAuthenticated() {
    const clone = new ExtensionRouteBuilder<TBody, TParams>();
    clone.bodySchema = this.bodySchema;
    clone.requireAuth = true;
    return clone;
  }

  handler(
    fn: Handler<{
      body?: TBody;
      params?: TParams;
      user: ExtensionUser;
    }>,
  ) {
    return async (req: NextRequest, context: { params?: TParams }) => {
      try {
        const user = await resolveUser(req);
        if (this.requireAuth && !user) {
          return withCors(
            req,
            NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
          );
        }

        let parsedBody: TBody | undefined;
        if (req.method !== "GET" && this.bodySchema) {
          try {
            const text = await req.text();
            const rawBody = text ? (JSON.parse(text) as unknown) : {};
            parsedBody = this.bodySchema.parse(rawBody) as TBody;
          } catch (err) {
            const details = err instanceof Error ? err.message : "Invalid body";
            return withCors(
              req,
              NextResponse.json(
                { error: "Invalid request body", details },
                { status: 400 },
              ),
            );
          }
        }

        const result = await fn(req, {
          body: parsedBody,
          params: context.params,
          user,
        });

        if (result instanceof Response || result instanceof NextResponse) {
          return withCors(req, result);
        }
        return withCors(req, NextResponse.json(result));
      } catch (error) {
        logger.error(
          `[extensionRoute] ${req.method} ${req.nextUrl.pathname} failed:`,
          error,
        );
        return withCors(
          req,
          NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
          ),
        );
      }
    };
  }
}

export const extensionRoute = new ExtensionRouteBuilder();
