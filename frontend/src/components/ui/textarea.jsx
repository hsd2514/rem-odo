export function Textarea({ label, ...props }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <textarea className="textarea" {...props} />
    </div>
  );
}
