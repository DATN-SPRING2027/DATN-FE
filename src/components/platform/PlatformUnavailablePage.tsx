"use client";

import CapabilityUnavailable from "./ui/CapabilityUnavailable";

type PlatformUnavailablePageProps = Readonly<{
  title: string;
  description: string;
  dependency: string;
  items: readonly string[];
  partial?: boolean;
}>;

export default function PlatformUnavailablePage({
  title,
  description,
  dependency,
  items,
  partial = false,
}: PlatformUnavailablePageProps) {
  return (
    <CapabilityUnavailable
      title={title}
      description={description}
      dependency={dependency}
      items={items}
      partial={partial}
    />
  );
}
