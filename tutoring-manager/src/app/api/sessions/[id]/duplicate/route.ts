import { NextResponse } from "next/server";
import { z } from "zod";
import { route, body, serialize } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { ConflictError, duplicateSession } from "@/server/sessions";

const schema = z.object({ date: dateStr(), startTime: timeStr().optional(), endTime: timeStr().optional(), force: z.boolean().default(false) });

export const POST = route<{ id: string }>(async ({ req, params }) => {
  try {
    return await duplicateSession(params.id, await body(req, schema));
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json(serialize({ error: e.message, conflicts: e.conflicts }), { status: 409 });
    throw e;
  }
});
