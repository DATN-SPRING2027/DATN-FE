import { forwardBackendRequest } from "@/app/api/backend/forward";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  return forwardBackendRequest(request, ["auth", "logout"]);
}
