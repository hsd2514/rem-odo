export function Checkbox({ label, checked, onChange, ...props }) {
  return (
    <label className="checkbox-wrap">
      <input
        type="checkbox"
        className="checkbox-input"
        checked={checked}
        onChange={onChange}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
