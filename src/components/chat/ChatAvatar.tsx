"use client";
import Image from "next/image";
import { useState } from "react";
import AvatarText from "@/components/ui/avatar/AvatarText";

export default function ChatAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src || !/^https?:\/\//i.test(src))
    return <AvatarText name={name} className={className} />;
  return (
    <span
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className ?? "h-10 w-10"}`}
    >
      <Image
        src={src}
        alt={name}
        fill
        unoptimized
        sizes="56px"
        onError={() => setFailedSrc(src)}
        className="object-cover"
      />
    </span>
  );
}
