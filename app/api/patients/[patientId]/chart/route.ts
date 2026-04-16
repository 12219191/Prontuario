import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requirePermission } from "@/lib/auth";
import { getPatientChart, updateAppointmentChart } from "@/lib/chart-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await context.params;
    const session = await getSessionContext();
    const data = await getPatientChart(patientId, session.role);

    if (!data) {
      return NextResponse.json({ message: "Paciente nao encontrado." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nao autenticado." },
      { status: 401 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  _context: { params: Promise<{ patientId: string }> }
) {
  try {
    const payload = await request.json();
    await requirePermission(payload.finalize ? "finalize_appointment" : "edit_chart");
    const updated = await updateAppointmentChart(payload.appointmentId, payload);
    return NextResponse.json({ appointmentId: updated.id, status: updated.status });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro ao atualizar atendimento." },
      { status: error instanceof Error && error.name === "ForbiddenError" ? 403 : 400 }
    );
  }
}
