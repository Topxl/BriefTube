import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";

type Handler<TContext> = (
  req: NextRequest,
  context: TContext,
) => Promise<Response | NextResponse | object>;

class RouteBuilder<TBody = unknown, TParams = unknown> {
  private bodySchema?: ZodSchema;

  body(schema: ZodSchema) {
    const clone = new RouteBuilder<TBody, TParams>();
    clone.bodySchema = schema;
    return clone;
  }

  handler(
    fn: Handler<{
      body?: TBody;
      params?: TParams;
      ctx: { user: { id: string; email: string | null } };
    }>,
  ) {
    return async (req: NextRequest, context: { params?: TParams }) => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      let parsedBody: TBody | undefined;
      if (req.method !== "GET" && this.bodySchema) {
        try {
          const text = await req.text();
          const rawBody = JSON.parse(text) as unknown;
          parsedBody = this.bodySchema.parse(rawBody) as TBody;
        } catch (err) {
          const details = err instanceof Error ? err.message : "Invalid body";
          logger.error(
            `[authRoute] ${req.method} ${req.nextUrl.pathname} body parse failed:`,
            details,
          );
          return NextResponse.json(
            { error: "Invalid request body", details },
            { status: 400 },
          );
        }
      }

      try {
        const result = await fn(req, {
          body: parsedBody,
          params: context.params,
          ctx: { user: { id: user.id, email: user.email ?? null } },
        });

        if (result instanceof Response || result instanceof NextResponse) {
          return result;
        }

        return NextResponse.json(result);
      } catch (error) {
        logger.error(
          `[authRoute] ${req.method} ${req.nextUrl.pathname} failed:`,
          error,
        );
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    };
  }
}

/**
 * Authenticated route for Supabase
 */
export const authRoute = new RouteBuilder();

/**
 * Public route (no auth required)
 */
export const route = {
  handler: <TBody = unknown, TParams = unknown>(
    fn: Handler<{ body?: TBody; params?: TParams }>,
  ) => {
    return async (req: NextRequest, context: { params?: TParams }) => {
      let body: TBody | undefined;
      if (req.method !== "GET") {
        try {
          body = (await req.json()) as TBody;
        } catch {
          // No body
        }
      }

      const result = await fn(req, {
        body,
        params: context.params,
      });

      if (result instanceof Response || result instanceof NextResponse) {
        return result;
      }

      return NextResponse.json(result);
    };
  },
};
