import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { AlertCircleIcon, ChevronDownIcon } from "./icons";

type FieldMeta = {
  label: string;
  hint?: string;
  /** Error message. When set the control is marked invalid and the message is announced with it. */
  error?: string;
  required?: boolean;
};

type ControlA11y = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

function FieldShell({
  label,
  hint,
  error,
  required,
  idProp,
  children,
  className,
}: FieldMeta & {
  idProp?: string | undefined;
  className?: string | undefined;
  children: (a11y: ControlA11y) => ReactNode;
}) {
  const generated = useId();
  const id = idProp ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-bold">
        {label}
        {required ? <span className="font-medium text-muted-foreground"> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-small text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(required ? { "aria-required": true as const } : {}),
      })}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-small font-semibold text-danger-fg"
        >
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

const controlBase =
  "block w-full rounded-md border border-input-border bg-surface px-3.5 text-body text-foreground placeholder:text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-2 aria-invalid:border-danger-fg";

export type TextFieldProps = FieldMeta & Omit<ComponentPropsWithoutRef<"input">, "required">;

export function TextField({
  label,
  hint,
  error,
  required,
  id,
  className,
  type = "text",
  ...props
}: TextFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} idProp={id}>
      {(a11y) => (
        <input
          type={type}
          required={required}
          className={cn(controlBase, "min-h-11 py-2", className)}
          {...a11y}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export type TextareaFieldProps = FieldMeta & Omit<ComponentPropsWithoutRef<"textarea">, "required">;

export function TextareaField({
  label,
  hint,
  error,
  required,
  id,
  className,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} idProp={id}>
      {(a11y) => (
        <textarea
          rows={rows}
          required={required}
          className={cn(controlBase, "py-2.5", className)}
          {...a11y}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export type SelectFieldProps = FieldMeta & Omit<ComponentPropsWithoutRef<"select">, "required">;

/** Native select: best mobile behaviour and full keyboard support for free. */
export function SelectField({
  label,
  hint,
  error,
  required,
  id,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} idProp={id}>
      {(a11y) => (
        <div className="relative">
          <select
            required={required}
            className={cn(controlBase, "min-h-11 appearance-none py-2 pr-10", className)}
            {...a11y}
            {...props}
          >
            {children}
          </select>
          <ChevronDownIcon
            size={18}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      )}
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & Omit<ComponentPropsWithoutRef<"input">, "type">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={hintId}
        className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
        {...props}
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="cursor-pointer font-semibold">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-small text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type RadioOption = { value: string; label: string; hint?: string };

export function RadioGroup({
  legend,
  name,
  options,
  defaultValue,
  error,
  className,
}: {
  legend: string;
  name: string;
  options: RadioOption[];
  defaultValue?: string;
  error?: string;
  className?: string;
}) {
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;
  return (
    <fieldset aria-describedby={errorId} className={cn("flex flex-col gap-2", className)}>
      <legend className="mb-1 text-small font-bold">{legend}</legend>
      {options.map((option) => {
        const id = `${groupId}-${option.value}`;
        return (
          <div key={option.value} className="flex items-start gap-3">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
            />
            <div className="flex flex-col">
              <label htmlFor={id} className="cursor-pointer font-semibold">
                {option.label}
              </label>
              {option.hint ? (
                <p className="text-small text-muted-foreground">{option.hint}</p>
              ) : null}
            </div>
          </div>
        );
      })}
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-small font-semibold text-danger-fg"
        >
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
