/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleDismiss = useCallback((id, duration) => {
    const currentTimer = timersRef.current.get(id);
    if (currentTimer) clearTimeout(currentTimer);

    const timeout = setTimeout(() => {
      timersRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    timersRef.current.set(id, timeout);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const addToast = useCallback((message, type = "info", options = {}) => {
    const {
      duration = 4000,
      dedupe = true,
      key,
    } = options;

    const toastKey = key || `${type}:${String(message)}`;

    if (dedupe) {
      const existing = toastsRef.current.find((item) => item.toastKey === toastKey);
      if (existing) {
        scheduleDismiss(existing.id, duration);
        return existing.id;
      }
    }

    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, toastKey }]);
    scheduleDismiss(id, duration);
    return id;
  }, [scheduleDismiss]);

  const toast = {
    show: addToast,
    success: (msg, options) => addToast(msg, "success", options),
    error: (msg, options) => addToast(msg, "error", options),
    info: (msg, options) => addToast(msg, "info", options),
    dismiss: dismissToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
