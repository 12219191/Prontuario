import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string) {
  const normalized = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, "0");
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function verifyTotpCode(secret: string, code: string, window = 1) {
  const normalizedCode = code.replace(/\s+/g, "");
  const timeStep = 30;
  const currentCounter = Math.floor(Date.now() / 1000 / timeStep);

  for (let errorWindow = -window; errorWindow <= window; errorWindow += 1) {
    const candidate = hotp(secret, currentCounter + errorWindow);
    const a = Buffer.from(candidate);
    const b = Buffer.from(normalizedCode);

    if (a.length === b.length && timingSafeEqual(a, b)) {
      return true;
    }
  }

  return false;
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () =>
    randomBytes(4).toString("hex").toUpperCase()
  );
}

export function buildOtpAuthUrl({
  accountName,
  issuer,
  secret
}: {
  accountName: string;
  issuer: string;
  secret: string;
}) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export function buildQrCodeUrl(content: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(content)}`;
}
