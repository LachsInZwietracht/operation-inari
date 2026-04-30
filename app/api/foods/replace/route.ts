import { NextResponse } from "next/server";
import { z } from "zod";

import { replaceFoodReferences } from "@/lib/data/database-lifecycle";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  sourceFoodId: z.string().uuid(),
  targetFoodId: z.string().uuid(),
  reason: z.string().optional(),
  scope: z.enum(["user_workspace", "organization"]).default("user_workspace"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const result = await replaceFoodReferences({
      ...parsed.data,
      supabase,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ersetzung fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
