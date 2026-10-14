import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  variant?: "adaptive" | "mark" | "inverse";
};

const markSource = "/images/logo/continuum-mark.png";

export default function BrandLogo({
  className = "",
  priority = false,
  variant = "adaptive",
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={markSource}
        alt="Continuum AI"
        width={512}
        height={512}
        className={className}
        priority={priority}
      />
    );
  }

  if (variant === "inverse") {
    return (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        <Image
          src={markSource}
          alt=""
          aria-hidden="true"
          width={512}
          height={512}
          className="h-full w-auto"
          priority={priority}
        />
        <span className="text-xl font-semibold tracking-tight text-white">
          Continuum AI
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/images/logo/continuum-lockup-light.png"
        alt="Continuum AI"
        width={1200}
        height={273}
        className="h-full w-auto dark:hidden"
        priority={priority}
      />
      <span className="hidden h-full items-center gap-2 dark:inline-flex">
        <Image
          src={markSource}
          alt=""
          aria-hidden="true"
          width={512}
          height={512}
          className="h-full w-auto"
          priority={priority}
        />
        <span className="text-lg font-semibold tracking-tight text-white">
          Continuum AI
        </span>
      </span>
    </span>
  );
}
