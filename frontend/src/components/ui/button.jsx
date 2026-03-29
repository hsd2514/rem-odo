import { cn } from "../../lib/utils";

export function Button({ className, variant = "default", size = "default", ...props }) {
  const sizeClass = size === "sm" ? "btn-sm" : size === "xs" ? "btn-xs" : "";
  const variantClass =
    variant === "primary" ? "btn-primary" :
    variant === "danger" ? "btn-danger" :
    variant === "success" ? "btn-success" :
    variant === "ghost" ? "btn-ghost" : "";

  return (
    <button
      className={cn("btn", variantClass, sizeClass, className)}
      {...props}
    />
  );
}
