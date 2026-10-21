type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  alt: string;
  className?: string;
};

export function safeAvatarUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export default function UserAvatar({ name, avatarUrl, alt, className = "size-11" }: UserAvatarProps) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? "").join("") || "?";
  const imageUrl = safeAvatarUrl(avatarUrl);

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 ${className}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={!alt}>{initials}</span>
      )}
    </span>
  );
}
