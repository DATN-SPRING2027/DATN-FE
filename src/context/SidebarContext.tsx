"use client";

import { usePathname } from "@/i18n/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const SIDEBAR_COLLAPSE_SNAP_WIDTH = 140;
const SIDEBAR_WIDTH_STORAGE_KEY = "continuum.sidebar.width";
const SIDEBAR_EXPANDED_STORAGE_KEY = "continuum.sidebar.expanded";

export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

type SidebarContextType = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  activeItem: string | null;
  openSubmenu: string | null;
  toggleSidebar: () => void;
  setIsExpanded: (isExpanded: boolean) => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setIsResizing: (isResizing: boolean) => void;
  resetSidebarWidth: () => void;
  setActiveItem: (item: string | null) => void;
  toggleSubmenu: (item: string) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isExpanded, setIsExpandedState] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [sidebarWidth, setSidebarWidthState] = useState<number>(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const pathname = usePathname();

  // Restore saved sidebar width and expanded/icon-only state from localStorage on mount
  useEffect(() => {
    try {
      const rawWidth = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (rawWidth !== null) {
        const parsed = Number(rawWidth);
        if (Number.isFinite(parsed)) {
          setSidebarWidthState(clampSidebarWidth(parsed));
        }
      }
      const rawExpanded = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
      if (rawExpanded === "false") {
        setIsExpandedState(false);
      } else if (rawExpanded === "true") {
        setIsExpandedState(true);
      }
    } catch {
      // Ignore storage access errors in restricted environments
    }
  }, []);

  const setIsExpanded = useCallback((nextExpanded: boolean) => {
    setIsExpandedState(nextExpanded);
    try {
      window.localStorage.setItem(
        SIDEBAR_EXPANDED_STORAGE_KEY,
        String(nextExpanded),
      );
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const setSidebarWidth = useCallback((nextWidth: number) => {
    const clamped = clampSidebarWidth(nextWidth);
    setSidebarWidthState(clamped);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const resetSidebarWidth = useCallback(() => {
    setIsExpanded(true);
    setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  }, [setIsExpanded, setSidebarWidth]);

  // Close sidebar on route change (for mobile)
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsExpandedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const toggleSubmenu = (item: string) => {
    setOpenSubmenu((prev) => (prev === item ? null : item));
  };

  return (
    <SidebarContext.Provider
      value={{
        isExpanded: isMobile ? false : isExpanded,
        isMobileOpen,
        isHovered,
        sidebarWidth,
        isResizing,
        activeItem,
        openSubmenu,
        toggleSidebar,
        setIsExpanded,
        toggleMobileSidebar,
        setIsHovered,
        setSidebarWidth,
        setIsResizing,
        resetSidebarWidth,
        setActiveItem,
        toggleSubmenu,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
