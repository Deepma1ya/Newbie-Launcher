/**
 * Split a command-line string into argv tokens. Quotes group words and are not
 * emitted. Unlike a regex tokenizer this handles `-Dkey="some value"` as one
 * token, which is common in JVM argument settings.
 */
export function tokenise(value: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (const char of value) {
    if (quote) {
      if (char === quote) quote = null
      else current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (current) tokens.push(current)
  return tokens
}
