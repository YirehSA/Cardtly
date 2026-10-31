// A name with "'s" on the end, or an apostrophe alone when it already ends in s:
// "Support's", but "Installations'" and "Sales'". Department and team names
// are mostly plural nouns, and a manager was being told to "Write
// Installations's NFC cards" (video 32, 2026-10-31).
export function possessive(name: string): string {
  const n = (name || '').trim()
  return /s$/i.test(n) ? `${n}'` : `${n}'s`
}
