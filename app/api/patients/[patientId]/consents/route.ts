import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createConsent } from "@/lib/chart-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ patientId: string }> }
) {
  try {
    await requirePermission("manage_consents");
    const { patientId } = await context.params;
    const payload = await request.json();
    const consent = await createConsent(patientId, payload);
    return NextResponse.json(consent, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao registrar consentimento." },
      { status: error instanceof Error && error.name === "ForbiddenError" ? 403 : 400 }
    );
  }
}
