import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRolePermissions, hasPermission, type Permission } from "@/lib/permissions";
import { verifyPassword } from "@/lib/password";
import { validatePasswordPolicy } from "@/lib/password-policy";
import {
  buildOtpAuthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotpCode
} from "@/lib/totp";

export const SESSION_COOKIE = "xfts_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const RESET_TTL_MS = 1000 * 60 * 30;
const RESET_REQUEST_COOLDOWN_MS = 1000 * 60 * 2;
const MAX_FAILED_LOGINS = 5;
const ACCOUNT_LOCK_MS = 1000 * 60 * 15;

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const session = token
    ? await prisma.session.findUnique({
        where: { token },
        include: { professional: true }
      })
    : null;

  if (session && session.expiresAt > new Date()) {
    const nextExpiry = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: new Date(),
        expiresAt: nextExpiry
      }
    });

    cookieStore.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: nextExpiry
    });

    return session;
  }

  if (session) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    cookieStore.delete(SESSION_COOKIE);
  }

  return null;
}

export async function getSessionContext() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Nenhuma sessao ativa encontrada.");
  }

  return {
    sessionId: session.id,
    token: session.token,
    professionalId: session.professionalId,
    professionalName: session.professional.name,
    mfaEnabled: session.professional.mfaEnabled,
    role: session.professional.role,
    permissions: getRolePermissions(session.professional.role)
  };
}

export async function requirePermission(permission: Permission) {
  const session = await getSessionContext();

  if (!hasPermission(session.role as UserRole, permission)) {
    const error = new Error("Acesso negado para este perfil.");
    error.name = "ForbiddenError";
    throw error;
  }

  return session;
}

export async function authenticateWithPassword(email: string, password: string) {
  const professional = await prisma.professional.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  if (professional?.lockedUntil && professional.lockedUntil > new Date()) {
    const error = new Error(
      `Conta temporariamente bloqueada ate ${professional.lockedUntil.toLocaleString("pt-BR")}.`
    );
    error.name = "AccountLockedError";
    throw error;
  }

  if (!professional || !verifyPassword(password, professional.passwordHash)) {
    if (professional) {
      const nextFailedCount = professional.failedLoginCount + 1;
      const shouldLock = nextFailedCount >= MAX_FAILED_LOGINS;

      await prisma.professional.update({
        where: { id: professional.id },
        data: {
          failedLoginCount: shouldLock ? 0 : nextFailedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null
        }
      });

      await prisma.auditTrail.create({
        data: {
          actorId: professional.id,
          entityName: "Auth",
          fieldName: "login_failed",
          previousValue: null,
          nextValue: shouldLock
            ? `${professional.email}:locked`
            : `${professional.email}:attempt_${nextFailedCount}`
        }
      });

      if (shouldLock) {
        const error = new Error("Muitas tentativas invalidas. Conta bloqueada por 15 minutos.");
        error.name = "AccountLockedError";
        throw error;
      }
    }
    return null;
  }

  await prisma.professional.update({
    where: { id: professional.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null
    }
  });

  if (professional.mfaEnabled) {
    const challenge = await prisma.loginChallenge.create({
      data: {
        token: randomBytes(24).toString("hex"),
        professionalId: professional.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      },
      include: { professional: true }
    });

    await prisma.auditTrail.create({
      data: {
        actorId: professional.id,
        entityName: "Auth",
        fieldName: "mfa_challenge_issued",
        previousValue: null,
        nextValue: professional.email
      }
    });

    return {
      requiresMfa: true,
      challengeToken: challenge.token,
      professional
    };
  }

  const session = await prisma.session.create({
    data: {
      token: randomBytes(24).toString("hex"),
      professionalId: professional.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    },
    include: { professional: true }
  });

  await prisma.auditTrail.create({
    data: {
      actorId: professional.id,
      entityName: "Auth",
      fieldName: "login_success",
      previousValue: null,
      nextValue: professional.email
    }
  });

  return {
    requiresMfa: false,
    session
  };
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function verifyMfaChallenge({
  challengeToken,
  code
}: {
  challengeToken: string;
  code: string;
}) {
  const challenge = await prisma.loginChallenge.findUnique({
    where: { token: challengeToken },
    include: { professional: true }
  });

  if (!challenge || challenge.expiresAt <= new Date()) {
    return null;
  }

  const professional = challenge.professional;
  const recoveryCodes = professional.recoveryCodes
    ? JSON.parse(professional.recoveryCodes) as string[]
    : [];

  let valid = false;
  let nextRecoveryCodes = recoveryCodes;

  if (professional.mfaSecret && verifyTotpCode(professional.mfaSecret, code)) {
    valid = true;
  } else if (recoveryCodes.includes(code.toUpperCase())) {
    valid = true;
    nextRecoveryCodes = recoveryCodes.filter((item) => item !== code.toUpperCase());
  }

  if (!valid) {
    await prisma.auditTrail.create({
      data: {
        actorId: professional.id,
        entityName: "Auth",
        fieldName: "mfa_failed",
        previousValue: null,
        nextValue: professional.email
      }
    });
    return null;
  }

  if (nextRecoveryCodes.length !== recoveryCodes.length) {
    await prisma.professional.update({
      where: { id: professional.id },
      data: {
        recoveryCodes: JSON.stringify(nextRecoveryCodes)
      }
    });
  }

  await prisma.loginChallenge.deleteMany({
    where: { professionalId: professional.id }
  });

  const session = await prisma.session.create({
    data: {
      token: randomBytes(24).toString("hex"),
      professionalId: professional.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS)
    },
    include: { professional: true }
  });

  await prisma.auditTrail.create({
    data: {
      actorId: professional.id,
      entityName: "Auth",
      fieldName: "mfa_success",
      previousValue: null,
      nextValue: professional.email
    }
  });

  return session;
}

export async function getMfaSetup() {
  const session = await getSessionContext();
  const professional = await prisma.professional.findUnique({
    where: { id: session.professionalId }
  });

  if (!professional) {
    throw new Error("Usuario nao encontrado.");
  }

  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();

  return {
    professionalId: professional.id,
    email: professional.email,
    secret,
    recoveryCodes,
    otpAuthUrl: buildOtpAuthUrl({
      accountName: professional.email,
      issuer: "XFTS Prontuario",
      secret
    })
  };
}

export async function enableMfa({
  secret,
  code,
  recoveryCodes
}: {
  secret: string;
  code: string;
  recoveryCodes: string[];
}) {
  const session = await getSessionContext();

  if (!verifyTotpCode(secret, code)) {
    const error = new Error("Codigo TOTP invalido.");
    error.name = "MfaCodeError";
    throw error;
  }

  await prisma.professional.update({
    where: { id: session.professionalId },
    data: {
      mfaEnabled: true,
      mfaSecret: secret,
      recoveryCodes: JSON.stringify(recoveryCodes)
    }
  });

  await prisma.auditTrail.create({
    data: {
      actorId: session.professionalId,
      entityName: "Auth",
      fieldName: "mfa_enabled",
      previousValue: null,
      nextValue: session.professionalName
    }
  });
}

export async function disableMfa() {
  const session = await getSessionContext();

  await prisma.professional.update({
    where: { id: session.professionalId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      recoveryCodes: null
    }
  });

  await prisma.auditTrail.create({
    data: {
      actorId: session.professionalId,
      entityName: "Auth",
      fieldName: "mfa_disabled",
      previousValue: null,
      nextValue: session.professionalName
    }
  });
}

export async function createPasswordReset(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const professional = await prisma.professional.findUnique({
    where: { email: normalizedEmail }
  });

  if (!professional) {
    return null;
  }

  const recentReset = await prisma.passwordResetToken.findFirst({
    where: {
      professionalId: professional.id,
      createdAt: {
        gte: new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS)
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (recentReset) {
    const error = new Error("Aguarde antes de solicitar um novo token de redefinicao.");
    error.name = "ResetRateLimitError";
    throw error;
  }

  await prisma.passwordResetToken.deleteMany({
    where: {
      professionalId: professional.id,
      usedAt: null
    }
  });

  const reset = await prisma.passwordResetToken.create({
    data: {
      token: randomBytes(24).toString("hex"),
      professionalId: professional.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS)
    },
    include: { professional: true }
  });

  await prisma.auditTrail.create({
    data: {
      actorId: professional.id,
      entityName: "Auth",
      fieldName: "password_reset_requested",
      previousValue: null,
      nextValue: professional.email
    }
  });

  return reset;
}

export async function resetPasswordWithToken(token: string, nextPassword: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { professional: true }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return null;
  }

  const policy = validatePasswordPolicy(nextPassword);
  if (!policy.valid) {
    const error = new Error(policy.issues.join(" "));
    error.name = "PasswordPolicyError";
    throw error;
  }

  const { hashPassword } = await import("@/lib/password");

  await prisma.professional.update({
    where: { id: resetToken.professionalId },
    data: {
      passwordHash: hashPassword(nextPassword)
    }
  });

  await prisma.passwordResetToken.update({
    where: { id: resetToken.id },
    data: {
      usedAt: new Date()
    }
  });

  await prisma.session.deleteMany({
    where: { professionalId: resetToken.professionalId }
  });

  await prisma.auditTrail.create({
    data: {
      actorId: resetToken.professionalId,
      entityName: "Auth",
      fieldName: "password_reset_completed",
      previousValue: null,
      nextValue: resetToken.professional.email
    }
  });

  return resetToken.professional;
}
