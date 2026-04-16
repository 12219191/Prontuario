import { NextRequest, NextResponse } from "next/server";
import { createPasswordReset, resetPasswordWithToken } from "@/lib/auth";
import { enforceRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  if (payload.mode === "request") {
    try {
      const rateLimit = await enforceRateLimit({
        scope: "password-reset-request",
        ip: getRequestIp(request),
        maxHits: 5,
        windowMs: 1000 * 60 * 10,
        blockMs: 1000 * 60 * 15
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { message: `Muitas solicitacoes de reset neste IP. Tente novamente em ${rateLimit.retryAfterSeconds}s.` },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds)
            }
          }
        );
      }

      const reset = await createPasswordReset(payload.email ?? "");

      return NextResponse.json({
        ok: true,
        message: reset
          ? "Token de redefinicao gerado para o usuario demo."
          : "Se o email existir, um token de redefinicao foi criado.",
        resetToken: reset?.token ?? null,
        expiresAt: reset?.expiresAt ?? null
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Nao foi possivel gerar token." },
        { status: error instanceof Error && error.name === "ResetRateLimitError" ? 429 : 400 }
      );
    }
  }

  if (payload.mode === "confirm") {
    if (!payload.token || !payload.password) {
      return NextResponse.json(
        { message: "Token e nova senha sao obrigatorios." },
        { status: 400 }
      );
    }

    try {
      const rateLimit = await enforceRateLimit({
        scope: "password-reset-confirm",
        ip: getRequestIp(request),
        maxHits: 10,
        windowMs: 1000 * 60 * 10,
        blockMs: 1000 * 60 * 10
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { message: `Muitas tentativas de redefinicao neste IP. Tente novamente em ${rateLimit.retryAfterSeconds}s.` },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds)
            }
          }
        );
      }

      const professional = await resetPasswordWithToken(
        payload.token,
        payload.password
      );

      if (!professional) {
        return NextResponse.json(
          { message: "Token invalido, expirado ou ja utilizado." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Senha redefinida com sucesso.",
        email: professional.email
      });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Nao foi possivel redefinir a senha." },
        { status: error instanceof Error && error.name === "PasswordPolicyError" ? 400 : 500 }
      );
    }
  }

  return NextResponse.json({ message: "Modo invalido." }, { status: 400 });
}
