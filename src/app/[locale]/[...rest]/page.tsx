import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildAppPageMetadata } from "@/lib/page-titles.server";

export function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return buildAppPageMetadata(params, "notFound");
}

export default function CatchAllNotFoundPage() {
  notFound();
}
