import { prisma } from "@/lib/prisma";

type RateLimitOptions = {
  scope: string;
  ip: string;
  maxHits: number;
  windowMs: number;
  blockMs: number;
};

export async function enforceRateLimit({
  scope,
  ip,
  maxHits,
  windowMs,
  blockMs
}: RateLimitOptions) {
  const now = new Date();
  const record = await prisma.authRateLimit.findUnique({
    where: {
      scope_ip: {
        scope,
        ip
      }
    }
  });

  if (!record) {
    await prisma.authRateLimit.create({
      data: {
        scope,
        ip,
        hits: 1,
        windowStart: now
      }
    });

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((record.blockedUntil.getTime() - now.getTime()) / 1000)
      )
    };
  }

  const windowExpired =
    now.getTime() - record.windowStart.getTime() > windowMs;

  const nextHits = windowExpired ? 1 : record.hits + 1;
  const nextWindowStart = windowExpired ? now : record.windowStart;
  const shouldBlock = !windowExpired && nextHits > maxHits;

  await prisma.authRateLimit.update({
    where: { id: record.id },
    data: {
      hits: shouldBlock ? 0 : nextHits,
      windowStart: nextWindowStart,
      blockedUntil: shouldBlock ? new Date(now.getTime() + blockMs) : null
    }
  });

  if (shouldBlock) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(blockMs / 1000)
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "local";
  }

  return request.headers.get("x-real-ip") || "local";
}
