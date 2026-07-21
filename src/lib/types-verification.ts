/**
 * Verification types — VerificationResult.
 */

export interface VerificationResult {
  valid: boolean;
  checksum_match: boolean;
  size_match: boolean;
  format_valid: boolean;
  error: string | null;
}
