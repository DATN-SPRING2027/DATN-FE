"use client";

import type React from "react";
import { useState } from "react";
import { CopyIcon } from "@/icons";

const CopyInput: React.FC = () => {
  const [website, setWebsite] = useState("www.tailadmin.com");
  const [copyText, setCopyText] = useState("Copy");

  const copyWebsite = () => {
    navigator.clipboard.writeText(website).then(() => {
      setCopyText("Copied!");
      setTimeout(() => setCopyText("Copy"), 2000);
    });
  };

  return (
    <div className="relative">
      <button
        onClick={copyWebsite}
        className="absolute end-0 top-1/2 inline-flex -translate-y-1/2 cursor-pointer items-center gap-1 border-s border-gray-200 py-3 ps-3.5 pe-3 text-sm font-medium text-gray-700 dark:border-gray-800 dark:text-gray-400"
      >
        <CopyIcon aria-hidden="true" className="size-5 shrink-0" />
        <div>{copyText}</div>
      </button>
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        type="url"
        className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-3 ps-4 pe-[90px] text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        placeholder="Enter website URL"
      />
    </div>
  );
};

export default CopyInput;
