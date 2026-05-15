import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await supabaseAdmin.from("calls").select("id").limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error", reason: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "ok",
      supabase: "connected",
      time: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
