export function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select className="select" {...props}>
        {children}
      </select>
    </div>
  );
}
