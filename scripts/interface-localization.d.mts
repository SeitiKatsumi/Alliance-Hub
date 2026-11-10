import type { Plugin } from 'vite';
export function interfaceLocalization(): Plugin;
export function transformInterface(source: string, file: string, collect?: (s: string) => void): string | null;
