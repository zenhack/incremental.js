
export function impossible(n: never): never {
  throw new Error("impossible: " + n)
}
