import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  children,
  variant = "primary",
  loading = false,
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button ${variant} ${className}`.trim()} disabled={props.disabled || loading} {...props}>
      {loading ? "Working..." : children}
    </button>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="cardHeader">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <small className="error">{error}</small>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="control" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="control textarea" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="control" {...props} />;
}

export function Empty({ children = "No records yet." }: { children?: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Status({ value }: { value: string }) {
  const classValue = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return <span className={`status ${classValue}`}>{value}</span>;
}

export function Notice({ type = "info", children }: { type?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  return <div className={`notice ${type}`}>{children}</div>;
}

export function Form({
  onSubmit,
  children,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form className="form" onSubmit={onSubmit}>
      {children}
    </form>
  );
}
