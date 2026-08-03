"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Design System §1: dark-first, light fully supported as secondary theme.
 * Uses next-themes' class strategy against globals.css's `.light` override.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      value={{ dark: "dark", light: "light" }}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
