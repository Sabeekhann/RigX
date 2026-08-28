export function parseNdjson(text) {
  const values = [];
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      values.push(JSON.parse(line));
    } catch {
      throw new Error(`Invalid JSON on input line ${index + 1}.`);
    }
  }
  return values;
}
