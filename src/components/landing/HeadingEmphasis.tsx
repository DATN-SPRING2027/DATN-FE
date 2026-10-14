"use client";

import React from "react";

export type EmphasisVariant = "gradient" | "blue" | "underline" | "contrast";

interface HeadingEmphasisProps {
  children: React.ReactNode;
  variant?: EmphasisVariant;
  className?: string;
  as?: "span" | "strong" | "em";
}

export function HeadingEmphasis({
  children,
  variant = "gradient",
  className = "",
  as: Component = "span",
}: HeadingEmphasisProps) {
  const variantStyles: Record<EmphasisVariant, string> = {
    gradient:
      "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400 inline-block drop-shadow-xs",
    blue: "text-blue-600 dark:text-blue-400 font-extrabold inline-block",
    underline:
      "relative inline-block font-extrabold text-[#0F172A] dark:text-white after:content-[''] after:absolute after:bottom-1 after:left-0 after:right-0 after:h-[3px] after:bg-gradient-to-r after:from-blue-600 after:to-indigo-500 after:rounded-full after:opacity-85",
    contrast: "font-black text-[#0F172A] tracking-tight dark:text-white inline-block",
  };

  return (
    <Component className={`${variantStyles[variant]} ${className}`}>
      {children}
    </Component>
  );
}

interface SectionHeadingProps {
  badge?: string;
  badgeIcon?: React.ReactNode;
  regularText: string;
  emphasizedText: string;
  emphasisVariant?: EmphasisVariant;
  description?: string;
  align?: "center" | "left";
  reverseOrder?: boolean;
  className?: string;
  headingTag?: "h1" | "h2" | "h3";
}

export function SectionHeading({
  badge,
  badgeIcon,
  regularText,
  emphasizedText,
  emphasisVariant = "gradient",
  description,
  align = "center",
  reverseOrder = false,
  className = "",
  headingTag: Tag = "h2",
}: SectionHeadingProps) {
  const isCenter = align === "center";

  return (
    <div
      className={`max-w-3xl ${
        isCenter ? "mx-auto text-center" : "text-left"
      } ${className}`}
    >
      {badge && (
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3.5 py-1 text-xs font-bold text-blue-700 shadow-2xs mb-3.5 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300 ${
            isCenter ? "mx-auto" : ""
          }`}
        >
          {badgeIcon}
          <span>{badge}</span>
        </div>
      )}

      <Tag className="text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl lg:leading-tight dark:text-white">
        {reverseOrder ? (
          <>
            <HeadingEmphasis variant={emphasisVariant}>
              {emphasizedText}
            </HeadingEmphasis>{" "}
            <span>{regularText}</span>
          </>
        ) : (
          <>
            <span>{regularText}</span>{" "}
            <HeadingEmphasis variant={emphasisVariant}>
              {emphasizedText}
            </HeadingEmphasis>
          </>
        )}
      </Tag>

      {description && (
        <p className="mt-4 text-base leading-relaxed text-[#334155] sm:text-lg dark:text-gray-300">
          {description}
        </p>
      )}
    </div>
  );
}

export default HeadingEmphasis;
