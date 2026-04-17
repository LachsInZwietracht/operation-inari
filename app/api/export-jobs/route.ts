import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/data/utils";

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!authData.user) {
    return NextResponse.json([], { status: 200 });
  }

  const { data, error } = await withTimeout(
    supabase.from("export_jobs").select("*").order("created_at", { ascending: false }),
    5000,
    "Export job request timed out",
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
