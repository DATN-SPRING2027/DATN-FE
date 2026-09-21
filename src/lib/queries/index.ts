/**
 * Continuum AI — Service Queries & Mutations
 *
 * Central index exporting query keys and TanStack Query hooks organized by service domain.
 */

// Generic / Backend health
export * from "./backend";

// IAM / Auth service
export * from "./auth/auth.keys";
export * from "./auth/useAuth";

// Lifecycle / Verification service
export * from "./verification/verification.keys";
export * from "./verification/useVerification";

// Capture / Daily notes service
export * from "./capture/capture.keys";
export * from "./capture/useCapture";
