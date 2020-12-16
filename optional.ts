
export type Optional<T> = null | { some: T }

export function notNull<T>(opt: Optional<T>): T {
  if(opt === null) {
    throw new Error("optional is unexpectedly null");
  }
  return opt.some;
}
