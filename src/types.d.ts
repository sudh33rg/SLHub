// Ambient module declarations for dependencies that ship without TypeScript types.
// The workspace deps are installed via the existing (fragile) node_modules layout,
// so rather than mutate that tree we declare the few untyped modules we use here.

declare module 'bcrypt' {
  export function hash(s: string, rounds: number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
}
