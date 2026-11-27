"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CloseLineIcon } from "@/icons";

interface Option {
  value: string;
  text: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  defaultSelected?: string[];
  value?: string[];
  onChange?: (selected: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  defaultSelected = [],
  value,
  onChange,
  disabled = false,
  placeholder = "Select options",
}) => {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] =
    useState<string[]>(defaultSelected);
  const selectedOptions = isControlled ? value : internalSelected;
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const updateSelection = (newSelected: string[]) => {
    if (!isControlled) setInternalSelected(newSelected);
    onChange?.(newSelected);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setFocusedIndex(-1);
    }
  };

  const handleSelect = (optionValue: string) => {
    const newSelected = selectedOptions.includes(optionValue)
      ? selectedOptions.filter((v) => v !== optionValue)
      : [...selectedOptions, optionValue];
    updateSelection(newSelected);
  };

  const removeOption = (optionValue: string) => {
    updateSelection(selectedOptions.filter((v) => v !== optionValue));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    e.preventDefault();
    switch (e.key) {
      case "Enter":
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0) {
          handleSelect(options[focusedIndex].value);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
      case "ArrowDown":
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case "ArrowUp":
        if (isOpen) {
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
    }
  };

  return (
    <div className="w-full" ref={dropdownRef}>
      <label
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
        id={`${label}-label`}
      >
        {label}
      </label>

      <div className="relative z-20 inline-block w-full">
        <div className="relative flex flex-col items-center">
          <div
            onClick={toggleDropdown}
            onKeyDown={handleKeyDown}
            className="w-full"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-labelledby={`${label}-label`}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
          >
            <div
              className={`mb-2 flex min-h-11 rounded-lg border border-gray-300 px-3 py-1.5 shadow-theme-xs outline-hidden transition focus:border-brand-300 focus:shadow-focus-ring dark:border-gray-700 dark:bg-gray-900 dark:focus:border-brand-300 ${
                disabled
                  ? "cursor-not-allowed bg-gray-50 opacity-50 dark:bg-gray-800"
                  : "cursor-pointer"
              }`}
            >
              <div className="flex flex-auto flex-wrap gap-2">
                {selectedOptions.length > 0 ? (
                  selectedOptions.map((value) => {
                    const text =
                      options.find((opt) => opt.value === value)?.text || value;
                    return (
                      <div
                        key={value}
                        className="group flex items-center justify-center rounded-full border-[0.7px] border-transparent bg-gray-100 py-1 ps-2.5 pe-2 text-sm text-gray-800 hover:border-gray-200 dark:bg-gray-800 dark:text-white/90 dark:hover:border-gray-800"
                      >
                        <span className="max-w-full flex-initial">{text}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!disabled) removeOption(value);
                          }}
                          disabled={disabled}
                          className="cursor-pointer ps-2 text-gray-500 group-hover:text-gray-400 disabled:cursor-not-allowed dark:text-gray-400"
                          aria-label={`Remove ${text}`}
                        >
                          <CloseLineIcon aria-hidden="true" className="size-3.5 shrink-0" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="pointer-events-none h-full w-full p-1 pe-2 text-sm text-gray-400 dark:text-gray-500">
                    {placeholder}
                  </div>
                )}
              </div>
              <div className="flex w-7 items-center self-start px-1 py-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDropdown();
                  }}
                  disabled={disabled}
                  className="h-5 w-5 cursor-pointer text-gray-700 outline-hidden focus:outline-hidden disabled:cursor-not-allowed dark:text-gray-400"
                >
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={`size-5 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {isOpen && (
            <div
              className="max-h-select inset-s-0 absolute top-full z-40 w-full overflow-y-auto rounded-lg bg-white shadow-sm dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              aria-label={label}
            >
              {options.map((option, index) => {
                const isSelected = selectedOptions.includes(option.value);
                const isFocused = index === focusedIndex;

                return (
                  <div
                    key={option.value}
                    className={`hover:bg-primary/5 w-full cursor-pointer rounded-t border-b border-gray-200 dark:border-gray-800 ${
                      isFocused ? "bg-primary/5" : ""
                    } ${isSelected ? "bg-primary/10" : ""}`}
                    onClick={() => handleSelect(option.value)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="relative flex w-full items-center p-2">
                      <div className="mx-2 leading-6 text-gray-800 dark:text-white/90">
                        {option.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiSelect;
