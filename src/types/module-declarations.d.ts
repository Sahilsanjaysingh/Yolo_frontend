// Declarations for commonly imported ui modules to satisfy editor diagnostics
declare module '@/components/ui/button' {
  import type React from 'react'
  export const buttonVariants: any
  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}
  export const Button: React.ComponentType<any>
}

declare module '@/components/ui/dialog' {
  import type React from 'react'
  export const Dialog: any
  export const DialogTrigger: any
  export const DialogContent: React.ComponentType<any>
  export const DialogPortal: any
  export const DialogOverlay: any
  export const DialogClose: any
  export const DialogHeader: any
  export const DialogFooter: any
  export const DialogTitle: any
  export const DialogDescription: any
}

declare module '@/components/ui/label' {
  import type React from 'react'
  export const Label: React.ComponentType<any>
}

declare module '@/components/ui/input' {
  import type React from 'react'
  export const Input: React.ComponentType<any>
}

declare module '@/components/ui/separator' {
  export const Separator: any
}

declare module '@/components/ui/sheet' {
  export const Sheet: any
  export const SheetContent: any
  export const SheetDescription: any
  export const SheetHeader: any
  export const SheetTitle: any
}

declare module '@/components/ui/skeleton' {
  export const Skeleton: any
}

declare module '@/components/ui/tooltip' {
  export const Tooltip: any
  export const TooltipContent: any
  export const TooltipProvider: any
  export const TooltipTrigger: any
}

declare module '@/components/ui/toast' {
  export const Toast: any
  export const ToastClose: any
  export const ToastDescription: any
  export const ToastProvider: any
  export const ToastTitle: any
  export const ToastViewport: any
  export const ToastActionElement: any
  export type ToastProps = any
}

declare module '@/components/ui/toggle' {
  export const toggleVariants: any
}

declare module '@/hooks/use-toast' {
  export function useToast(): { toasts: any[]; add: (...a: any[]) => void }
}
