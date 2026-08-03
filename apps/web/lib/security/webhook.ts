import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * API Contract Pattern C (`POST /webhooks/gmail`): "X-Signature: HMAC-SHA256
 * of body using org's webhook secret"... "signature verified before any
 * parsing; invalid signature → 401 INVALID_SIGNATURE, logged, and does
 * NOT enqueue anything." Constant-time comparison to avoid timing attacks.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}
