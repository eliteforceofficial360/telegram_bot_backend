/// <reference types="vite/client" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        trigger?: string;
        colors?: string;
        delay?: string | number;
        state?: string;
      }, HTMLElement>;
    }
  }
}

export {};

