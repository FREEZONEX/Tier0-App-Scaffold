/**
 * Every server function requires an employee visitor (`requireEmployeeFn` in
 * `src/start.ts`). One that really needs no visitor says so in its name, which
 * the Start compiler keeps in the function's metadata: `publicServerFnStatus`.
 * A contract test lists every such function, so an opt-out is always visible.
 */
const PUBLIC_SERVER_FN = /^publicServerFn[A-Z]/;

export function isPublicServerFn(name: string): boolean {
  return PUBLIC_SERVER_FN.test(name);
}
