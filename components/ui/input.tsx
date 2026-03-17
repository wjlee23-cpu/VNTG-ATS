import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // DS 2.0: Subtle Surface 배경 (#FCFCFC), neutral-900 포커스
        "file:text-foreground placeholder:text-neutral-400 selection:bg-neutral-900 selection:text-white dark:bg-input/30 border-neutral-200 flex h-9 w-full min-w-0 rounded-lg border px-3 py-1 text-base bg-[#FCFCFC] transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-neutral-900 focus-visible:ring-neutral-900/50 focus-visible:ring-[3px] dark:focus-visible:border-neutral-100 dark:focus-visible:ring-neutral-100/50",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
