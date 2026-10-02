import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Os tamanhos de fonte do tema (text-body, text-body-lg...) precisam ser declarados: sem isso o
// tailwind-merge os confunde com cores e descarta `text-primary-foreground` dos botões grandes.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['caption', 'body', 'body-lg', 'heading', 'display'] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
