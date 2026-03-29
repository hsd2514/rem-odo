export function Tabs({ items, active, onChange }) {
  return (
    <div className="tabs">
      {items.map((item) => (
        <button
          key={item.key}
          className={`tab-item ${active === item.key ? "active" : ""}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count != null && (
            <span style={{ marginLeft: "0.4rem", opacity: 0.65, fontSize: "0.7rem" }}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
