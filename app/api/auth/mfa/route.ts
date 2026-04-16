import { NextRequest, NextResponse } from "next/server";
import { disableMfa, enableMfa, getMfaSetup } from "@/lib/auth";

export async function GET() {
  try {
    const setup = await getMfaSetup();
    return NextResponse.json(setup);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nao autenticado." },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    await enableMfa(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nao foi possivel habilitar MFA." },
      { status: error instanceof Error && error.name === "MfaCodeError" ? 400 : 401 }
    );
  }
}

export async function DELETE() {
  try {
    await disableMfa();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Nao foi possivel desabilitar MFA." },
      { status: 401 }
    );
  }
}
