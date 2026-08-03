import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * "PDF Export... Storage" (Phase 6 scope). Uses Supabase Storage — already
 * the project's infra provider for Auth/DB (SAD §3.2), so this avoids
 * introducing a second cloud storage vendor for one feature. Requires the
 * `reports` bucket to exist (private, not public) and
 * `SUPABASE_SERVICE_ROLE_KEY` set — service-role because report PDFs must
 * bypass RLS-style bucket policies keyed on end-user sessions; access
 * control instead happens at the API layer (GET /reports/:id/download
 * checks org membership before generating a signed URL).
 */
const REPORTS_BUCKET = "reports";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage is not configured — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (see .env.example).");
  }
  return createClient(url, serviceRoleKey);
}

function reportPdfPath(orgId: string, reportId: string): string {
  return `${orgId}/${reportId}.pdf`;
}

/** Uploads the PDF and returns a signed URL valid for SIGNED_URL_TTL_SECONDS — `GET /reports/:id/download` regenerates a fresh one rather than relying on this staying valid forever. */
export async function uploadReportPdf(orgId: string, reportId: string, pdfBuffer: Buffer): Promise<string> {
  const supabase = getStorageClient();
  const path = reportPdfPath(orgId, reportId);

  const { error: uploadError } = await supabase.storage.from(REPORTS_BUCKET).upload(path, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true
  });
  if (uploadError) {
    throw new Error(`Report PDF upload failed: ${uploadError.message}`);
  }

  return getSignedReportPdfUrl(orgId, reportId);
}

export async function getSignedReportPdfUrl(orgId: string, reportId: string): Promise<string> {
  const supabase = getStorageClient();
  const path = reportPdfPath(orgId, reportId);

  const { data, error } = await supabase.storage.from(REPORTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    throw new Error(`Failed to create signed URL for report PDF: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}
