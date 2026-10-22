export const foldSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d");

export function matchesNamePrefixes(name: string, query: string) {
  const words = foldSearchText(name).split(/\s+/);
  return foldSearchText(query)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => words.some((word) => word.startsWith(term)));
}
