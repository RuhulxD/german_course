export type BookConfig = {
  name: string;
  folder: string;
  pages: number[];
};

export const books: BookConfig[] = [
  { name: 'Book 1', folder: 'book-1', pages: Array.from({ length: 52 }, (_, i) => i + 1) },
  { name: 'Book 3', folder: 'book-3', pages: Array.from({ length: 17 }, (_, i) => i + 1) },
];

export const allPages: string[] = books.flatMap((book) =>
  book.pages.map((p) => `${book.folder}/${p}`),
);

export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.trim()] = values[index] || '';
      });
      data.push(row);
    }
  }

  return data;
}
