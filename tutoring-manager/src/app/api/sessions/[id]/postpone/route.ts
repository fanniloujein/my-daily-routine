import { NextResponse } from "next/server";
import { z } from "zod";
import { route, body, serialize } from "@/lib/api";
import { dateStr, timeStr } from "@/lib/validation";
import { ConflictError, postponeSession } from "@/server/sessions";

const schema = z.object({ date: dateStr(), startTime: timeStr(), endTime: timeStr(), force: z.boolean().default(false) });

export const POST = route<{ id: string }>(async ({ req, params }) => {
  try {
    return await postponeSession(params.id, await body(req, schema));
  } catch (e) {
    if (e instanceof ConflictError) return NextResponse.json(serialize({ error: e.message, conflicts: e.conflicts }), { status: 409 });
    throw e;
  }
});
