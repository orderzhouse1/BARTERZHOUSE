type FieldErrorProps = {
  id?: string;
  message?: string | null;
};

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="text-sm text-[var(--destructive)]">
      {message}
    </p>
  );
}
