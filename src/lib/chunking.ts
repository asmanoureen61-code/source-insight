export type Chunk = {
  content: string;
  index: number;
  section: string | null;
  page: number | null;
};

const TARGET = 1100;
const OVERLAP = 150;

/** Split plain text / markdown into overlapping chunks, tracking the nearest heading. */
export function chunkText(raw: string): Chunk[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let buffer = "";
  let section: string | null = null;
  let pendingSection: string | null = null;

  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({
      content,
      index: chunks.length,
      section,
      page: null,
    });
    const tail = content.slice(-OVERLAP);
    buffer = tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) + "\n\n" : "";
    section = pendingSection ?? section;
  };

  for (const para of paragraphs) {
    const heading = para.match(/^#{1,6}\s+(.+)$/m);
    if (heading) {
      pendingSection = (heading[1] ?? "").trim() || null;
      if (!buffer.trim()) section = pendingSection;
    }
    if (buffer.length + para.length > TARGET && buffer.trim().length > 200) flush();
    buffer += para + "\n\n";
  }
  flush();
  buffer = "";

  return chunks.map((c, i) => ({ ...c, index: i }));
}

export function estimateBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
