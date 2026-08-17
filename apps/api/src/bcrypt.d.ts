declare module 'bcrypt' {
  export function hash(s: string, rounds: number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
}
