export function Switch({ label, checked, onChange }) {
  return (
    <label className="checkbox-wrap">
      <button
        type="button"
        className="switch-track"
        data-checked={checked}
        onClick={() => onChange && onChange({ target: { checked: !checked } })}
        role="switch"
        aria-checked={checked}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
