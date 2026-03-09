export function quoteArg(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
