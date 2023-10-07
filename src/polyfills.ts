if (window) { // in case running in a node environment e.g. server side rendering
  (window as any).global = (window as any).global ?? window; // don't override global if it is already defined.
}
