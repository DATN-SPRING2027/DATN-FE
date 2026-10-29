"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Badge from "@/components/ui/badge/Badge";
import RoleLabel from "@/components/common/RoleLabel";
import {
  CheckLineIcon,
  ChevronDownIcon,
  SearchIcon,
  UserCircleIcon,
} from "@/icons";

export interface HandoverMemberOption {
  userId: string;
  fullName: string;
  email?: string;
  avatarUrl?: string | null;
  status?: "ACTIVE" | "INACTIVE";
  roleCode?: string;
  isCurrentUser?: boolean;
}

export interface HandoverMemberSelectProps {
  id: string;
  value: string;
  onChange: (nextUserId: string) => void;
  options: readonly HandoverMemberOption[];
  placeholder: string;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  emptyOptionHint?: string;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
  activeBadgeLabel?: string;
  departedBadgeLabel?: string;
  youBadgeLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
  autoFocusField?: boolean;
}

function computeInitials(fullName: string, email?: string): string {
  const source = fullName.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function MemberAvatar({
  option,
  size = "sm",
}: {
  option: HandoverMemberOption;
  size?: "sm" | "md";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const sizeClass = size === "md" ? "size-8 text-xs" : "size-6.5 text-[11px]";
  const validAvatar =
    option.avatarUrl && option.avatarUrl !== failedUrl
      ? option.avatarUrl
      : null;

  if (validAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={validAvatar}
        alt=""
        onError={() => setFailedUrl(validAvatar)}
        className={`${size === "md" ? "size-8" : "size-6.5"} shrink-0 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700`}
      />
    );
  }

  const toneClass =
    option.status === "INACTIVE"
      ? "bg-warning-50 text-warning-700 ring-warning-200/90 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30"
      : option.roleCode === "TEAM_LEADER" || option.roleCode === "LEADER"
        ? "bg-brand-50 text-brand-700 ring-brand-200/90 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30"
        : "bg-gray-100 text-gray-700 ring-gray-200/90 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ring-1 ${toneClass}`}
    >
      {computeInitials(option.fullName, option.email)}
    </span>
  );
}

interface PopoverGeometry {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export default function HandoverMemberSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  allowEmpty = false,
  emptyOptionLabel,
  emptyOptionHint,
  searchPlaceholder = "Filter by name or email…",
  noMatchesLabel = "No matching project members",
  activeBadgeLabel = "Active",
  departedBadgeLabel = "Departed",
  youBadgeLabel = "You",
  invalid = false,
  disabled = false,
  describedBy,
  autoFocusField = false,
}: HandoverMemberSelectProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [geometry, setGeometry] = useState<PopoverGeometry>({
    top: 0,
    left: 0,
    width: 300,
    maxHeight: 280,
  });

  const selectedOption = useMemo(
    () => options.find((opt) => opt.userId === value) ?? null,
    [options, value],
  );

  const showSearch = options.length >= 4;

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.fullName.toLowerCase().includes(q) ||
        (opt.email?.toLowerCase().includes(q) ?? false) ||
        opt.userId.toLowerCase().includes(q),
    );
  }, [options, query]);

  const showEmptyRow = Boolean(
    allowEmpty && emptyOptionLabel && query.trim().length === 0,
  );
  const totalSelectableRows =
    (showEmptyRow ? 1 : 0) + filteredOptions.length;

  const updateGeometry = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 800;
    const viewportWidth = window.innerWidth || 1280;
    const margin = 12;
    const desiredWidth = Math.min(
      Math.max(rect.width, 272),
      viewportWidth - margin * 2,
    );
    const clampedLeft = Math.max(
      margin,
      Math.min(rect.left, viewportWidth - desiredWidth - margin),
    );

    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const preferAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      160,
      Math.min(300, (preferAbove ? spaceAbove : spaceBelow) - 8),
    );

    setGeometry({
      top: preferAbove ? Math.max(margin, rect.top - maxHeight - 6) : rect.bottom + 6,
      left: clampedLeft,
      width: desiredWidth,
      maxHeight,
    });
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setQuery("");
    const selectedIdx = options.findIndex((opt) => opt.userId === value);
    if (selectedIdx >= 0) {
      setActiveIndex(selectedIdx + (allowEmpty && emptyOptionLabel ? 1 : 0));
    } else {
      setActiveIndex(0);
    }
    setIsOpen(true);
  }, [allowEmpty, disabled, emptyOptionLabel, options, value]);

  const closeDropdown = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setQuery("");
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateGeometry();
  }, [isOpen, updateGeometry, filteredOptions.length]);

  useEffect(() => {
    if (!isOpen) return;

    if (showSearch) {
      const raf = requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, showSearch]);

  useEffect(() => {
    if (!isOpen) return;

    const handleCaptureKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDropdown(true);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      closeDropdown(false);
    };

    const handleViewportChange = () => {
      updateGeometry();
    };

    document.addEventListener("keydown", handleCaptureKeyDown, true);
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("keydown", handleCaptureKeyDown, true);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [closeDropdown, isOpen, updateGeometry]);

  const commitRowAt = (rowIndex: number) => {
    if (showEmptyRow) {
      if (rowIndex === 0) {
        onChange("");
        closeDropdown(true);
        return;
      }
      const opt = filteredOptions[rowIndex - 1];
      if (opt) {
        onChange(opt.userId);
        closeDropdown(true);
      }
      return;
    }
    const opt = filteredOptions[rowIndex];
    if (opt) {
      onChange(opt.userId);
      closeDropdown(true);
    }
  };

  const handleNavigationKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isOpen) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (totalSelectableRows === 0) return;
      const next = (activeIndex + 1) % totalSelectableRows;
      setActiveIndex(next);
      optionRefs.current[next]?.scrollIntoView?.({ block: "nearest" });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (totalSelectableRows === 0) return;
      const prev =
        (activeIndex - 1 + totalSelectableRows) % totalSelectableRows;
      setActiveIndex(prev);
      optionRefs.current[prev]?.scrollIntoView?.({ block: "nearest" });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (totalSelectableRows > 0) {
        commitRowAt(Math.min(activeIndex, totalSelectableRows - 1));
      }
      return;
    }

    if (event.key === "Tab") {
      const trigger = triggerRef.current;
      const dialog = trigger?.closest('[role="dialog"]');
      if (trigger && dialog) {
        event.preventDefault();
        event.stopPropagation();
        const fields = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        ).filter(
          (node) => !node.closest('[hidden], [aria-hidden="true"], [inert]'),
        );
        const index = fields.indexOf(trigger);
        const next =
          fields[
            (index + (event.shiftKey ? -1 : 1) + fields.length) % fields.length
          ];
        (next ?? trigger).focus();
      } else {
        // Native Tab navigation resumes from the trigger that survives closing.
        trigger?.focus();
      }
      closeDropdown(false);
    }
  };

  const borderClass = invalid
    ? "border-error-400 focus:border-error-500 focus:ring-3 focus:ring-error-500/15 dark:border-error-500/70"
    : isOpen
      ? "border-brand-500 ring-3 ring-brand-500/15 dark:border-brand-400"
      : "border-gray-300 hover:border-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:hover:border-gray-600";

  const popoverNode =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            data-handover-listbox-portal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: `${geometry.top}px`,
              left: `${geometry.left}px`,
              width: `${geometry.width}px`,
              zIndex: 100005,
            }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xl ring-1 ring-gray-950/5 dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
          >
            {showSearch && (
              <div className="border-b border-gray-100 p-2 dark:border-gray-800">
                <div className="relative flex items-center">
                  <SearchIcon
                    className="pointer-events-none absolute start-2.5 size-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={handleNavigationKey}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/80 py-1.5 ps-8 pe-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-900"
                  />
                </div>
              </div>
            )}

            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={id}
              style={{ maxHeight: `${geometry.maxHeight - (showSearch ? 48 : 0)}px` }}
              className="overflow-y-auto p-1.5"
            >
              {showEmptyRow && emptyOptionLabel && (
                <button
                  ref={(el) => {
                    optionRefs.current[0] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={value === ""}
                  onMouseEnter={() => setActiveIndex(0)}
                  onClick={() => commitRowAt(0)}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors ${
                    activeIndex === 0
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
                  >
                    <UserCircleIcon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                      {emptyOptionLabel}
                    </span>
                    {emptyOptionHint && (
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {emptyOptionHint}
                      </span>
                    )}
                  </span>
                  {value === "" && (
                    <CheckLineIcon
                      className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}

              {filteredOptions.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  {noMatchesLabel}
                </p>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const rowIndex = idx + (showEmptyRow ? 1 : 0);
                  const isSelected = opt.userId === value;
                  const isActive = activeIndex === rowIndex;
                  const isLeader =
                    opt.roleCode === "TEAM_LEADER" || opt.roleCode === "LEADER";

                  return (
                    <button
                      key={opt.userId}
                      ref={(el) => {
                        optionRefs.current[rowIndex] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(rowIndex)}
                      onClick={() => commitRowAt(rowIndex)}
                      className={`mt-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors first:mt-0 ${
                        isActive
                          ? "bg-brand-50/70 dark:bg-brand-500/15"
                          : isSelected
                            ? "bg-gray-50 dark:bg-gray-800/70"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <MemberAvatar option={opt} size="md" />

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {opt.fullName}
                          </span>
                          {opt.isCurrentUser && (
                            <Badge color="light" size="sm">
                              {youBadgeLabel}
                            </Badge>
                          )}
                        </span>
                        {opt.email && (
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {opt.email}
                          </span>
                        )}
                      </span>

                      <span className="flex shrink-0 items-center gap-1.5">
                        {opt.status === "INACTIVE" ? (
                          <Badge color="warning" size="sm">
                            {departedBadgeLabel}
                          </Badge>
                        ) : isLeader && opt.roleCode ? (
                          <Badge color="primary" size="sm">
                            <RoleLabel roleCode={opt.roleCode} />
                          </Badge>
                        ) : (
                          <Badge color="success" size="sm">
                            {activeBadgeLabel}
                          </Badge>
                        )}
                        {isSelected && (
                          <CheckLineIcon
                            className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        data-dialog-autofocus-field={autoFocusField ? "true" : undefined}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => {
          if (isOpen) {
            closeDropdown(false);
          } else {
            openDropdown();
          }
        }}
        onKeyDown={handleNavigationKey}
        className={`mt-1.5 flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border bg-white px-3 py-2 text-start shadow-theme-xs transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800/90 ${borderClass}`}
      >
        {selectedOption ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <MemberAvatar option={selectedOption} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
              {selectedOption.fullName}
            </span>
            {selectedOption.status === "INACTIVE" ? (
              <Badge color="warning" size="sm">
                {departedBadgeLabel}
              </Badge>
            ) : selectedOption.isCurrentUser ? (
              <Badge color="light" size="sm">
                {youBadgeLabel}
              </Badge>
            ) : null}
          </span>
        ) : allowEmpty && emptyOptionLabel ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
            >
              <UserCircleIcon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-gray-300">
              {emptyOptionLabel}
            </span>
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <UserCircleIcon
              className="size-5 shrink-0 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm text-gray-400 dark:text-gray-500">
              {placeholder}
            </span>
          </span>
        )}

        <ChevronDownIcon
          aria-hidden="true"
          className={`size-4 shrink-0 text-gray-400 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-brand-600 dark:text-brand-400" : ""
          }`}
        />
      </button>

      {popoverNode}
    </>
  );
}
