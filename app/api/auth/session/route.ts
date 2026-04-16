import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, authenticateWithPassword, clearCurrentSession, getCurrentSession, verifyMfaChallenge } from "@/lib/auth";
import { enforceRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function GET() {
  const current = await getCurrentSession();

  return NextResponse.json({
    current: current
      ? {
          token: current.token,
          professionalId: current.professionalId,
          professionalName: current.professional.name,
          role: current.professional.role,
          specialty: current.professional.specialty
        }
      : null
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  try {
    const rateLimit = await enforceRateLimit({
      scope: "login",
      ip: getRequestIp(request),
      maxHits: 10,
      windowMs: 1000 * 60 * 5,
      blockMs: 1000 * 60 * 10
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: `Muitas tentativas neste IP. Tente novamente em ${rateLimit.retryAfterSeconds}s.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    if (payload.mode === "mfa" && payload.challengeToken && payload.code) {
      const session = await verifyMfaChallenge({
        challengeToken: payload.challengeToken,
        code: payload.code
      });

      if (!session) {
        return NextResponse.json({ message: "Codigo MFA invalido ou expirado." }, { status: 401 });
      }

      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, session.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        expires: session.expiresAt
      });

      return NextResponse.json({
        token: session.token,
        professionalId: session.professionalId,
        professionalName: session.professional.name,
        role: session.professional.role
      });
    }

    const authResult =
      payload.email && payload.password
        ? await authenticateWithPassword(payload.email, payload.password)
        : null;

    if (!authResult) {
      return NextResponse.json({ message: "Credenciais invalidas." }, { status: 401 });
    }

    if (authResult.requiresMfa) {
      return NextResponse.json({
        requiresMfa: true,
        challengeToken: authResult.challengeToken,
        email: authResult.professional.email
      });
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, authResult.session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: authResult.session.expiresAt
    });

    return NextResponse.json({
      token: authResult.session.token,
      professionalId: authResult.session.professionalId,
      professionalName: authResult.session.professional.name,
      role: authResult.session.professional.role
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nao foi possivel autenticar.";
    const status =
      error instanceof Error && error.name === "AccountLockedError" ? 423 : 400;

    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE() {
  await clearCurrentSession();
  return NextResponse.json({ ok: true });
}
