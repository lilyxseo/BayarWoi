export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <div className="spinner-icon" />
      {label ? <span className="spinner-label">{label}</span> : null}
    </div>
  );
}