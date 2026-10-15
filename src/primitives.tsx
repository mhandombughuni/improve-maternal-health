import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
// Local equivalents of Figma's Code Connect primitives; no primitives package exists in this repository.
export function Button({
  variant = "primary",
  onPress,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "neutral";
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      onClick={props.onClick ?? onPress}
      className={`button ${variant} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function InputField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input {...props} id={id} />
    </label>
  );
}
export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select {...props} id={id}>
        {children}
      </select>
    </label>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials.slice(0, 1)}
    </span>
  );
}
