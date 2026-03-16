/// <reference types="react" />

// Type declarations for styled-jsx
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<HTMLStyleElement> {
    jsx?: boolean;
    global?: boolean;
  }
}

export {};
