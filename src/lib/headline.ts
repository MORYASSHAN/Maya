/**
 * Headlines are set as lines, one per sentence, without trailing full stops:
 * "Every lens. Same instant." → ["Every lens", "Same instant"].
 */
export function headlineLines(title: string) {
  return title
    .split(/(?<=\.)\s+/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter(Boolean)
}
