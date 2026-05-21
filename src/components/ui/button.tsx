import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "primary" &&
          "border-primary bg-primary text-primary-foreground shadow-sm hover:opacity-90",
        variant === "secondary" &&
          "border-border bg-card text-foreground hover:border-foreground/20 hover:bg-accent",
        variant === "ghost" && "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        variant === "danger" &&
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground",
        size === "sm" && "h-8 px-3",
        size === "md" && "h-10 px-4",
        size === "icon" && "h-9 w-9 p-0",
        className
      )}
      {...props}
    />
  );
}
