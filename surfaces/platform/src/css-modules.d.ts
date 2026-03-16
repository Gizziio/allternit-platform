declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// xterm CSS imports
declare module 'xterm/css/xterm.css' {
  const content: string;
  export default content;
}

// styled-jsx support for <style jsx> elements
declare module 'react' {
  interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
