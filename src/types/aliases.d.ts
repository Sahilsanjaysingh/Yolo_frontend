// Allow importing using the @/ path alias in the editor
declare module '@/lib/utils' {
  export function cn(...inputs: any[]): string
}

declare module '@/hooks/use-mobile' {
  export const useIsMobile: any
}

// (no wildcard fallback) — rely on tsconfig paths and actual module files for named exports
