export function assertNever(x: never): never {
  throw new Error(`Unhandled discriminated union: ${JSON.stringify(x)}`);
}
