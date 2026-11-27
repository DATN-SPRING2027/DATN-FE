import type React from "react";
import { CheckLineIcon } from "@/icons";

interface CheckboxProps {
  label?: React.ReactNode;
  checked: boolean;
  className?: string;
  id?: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  id,
  onChange,
  className = "",
  disabled = false,
  ariaInvalid,
  ariaDescribedBy,
}) => {
  return (
    <label
      className={`group flex cursor-pointer items-center gap-3 ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <div className="relative h-5 w-5 shrink-0">
        <input
          id={id}
          type="checkbox"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={`h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 checked:border-transparent checked:bg-brand-500 disabled:opacity-60 dark:border-gray-700 ${className}`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {checked && (
          <CheckLineIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 start-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 transform text-white rtl:translate-x-1/2"
          />
        )}
        {disabled && (
          <CheckLineIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 start-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 transform text-gray-200 rtl:translate-x-1/2"
          />
        )}
      </div>
      {label && (
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {label}
        </span>
      )}
    </label>
  );
};

export default Checkbox;
