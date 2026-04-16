import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { getDashboardData } from "@/lib/chart-service";

export async function GET() {
  try {
    const session = await getSessionContext();
    const data = await getDashboardData(session.role);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nao autenticado." },
      { status: 401 }
    );
  }
}
