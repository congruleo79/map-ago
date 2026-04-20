type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") {
    process.exit(0)
  }

  throw error
})

export function parseArgs(argv: string[]) {
  const positional: string[] = []
  const options: Record<string, string | boolean> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (!arg.startsWith("--")) {
      positional.push(arg)
      continue
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2)

    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue
      continue
    }

    const nextArg = argv[index + 1]

    if (!nextArg || nextArg.startsWith("--")) {
      options[rawKey] = true
      continue
    }

    options[rawKey] = nextArg
    index += 1
  }

  return { positional, options }
}

export function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

export function printJson(value: JsonValue) {
  console.log(JSON.stringify(value, null, 2))
}

export function normalizeDateInput(input: string) {
  const trimmedInput = input.trim()
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedInput)

  if (isoMatch) {
    return { month: isoMatch[2], day: isoMatch[3], label: trimmedInput }
  }

  const monthDayMatch = /^(\d{1,2})-(\d{1,2})$/.exec(trimmedInput)

  if (monthDayMatch) {
    const month = monthDayMatch[1].padStart(2, "0")
    const day = monthDayMatch[2].padStart(2, "0")

    return { month, day, label: `${month}-${day}` }
  }

  fail('Expected a date like "2026-04-16" or "04-16".')
}

export function readStdin() {
  return new Promise<string>((resolve, reject) => {
    let output = ""

    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
      output += chunk
    })
    process.stdin.on("end", () => resolve(output.trim()))
    process.stdin.on("error", reject)
  })
}

export function dedupeStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
