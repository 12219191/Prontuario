import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createMedia } from "@/lib/chart-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ patientId: string }> }
) {
  try {
    await requirePermission("upload_media");
    const { patientId } = await context.params;
    const payload = await request.json();
    const media = await createMedia(patientId, payload);
    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao salvar midia." },
      { status: error instanceof Error && error.name === "ForbiddenError" ? 403 : 400 }
    );
  }
}
