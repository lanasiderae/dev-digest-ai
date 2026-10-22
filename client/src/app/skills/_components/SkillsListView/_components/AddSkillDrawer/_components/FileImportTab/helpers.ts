/** Read a File's contents as UTF-8 text (client-only — no server round trip
 *  for a plain Markdown paste/upload). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

/** Same heading-derivation convention as the server's helper — a nicer
 *  prefilled name while the user hasn't typed one yet. */
export function deriveNameFromMarkdown(body: string): string | undefined {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || undefined;
}

export function isZipFile(file: File): boolean {
  return /\.zip$/i.test(file.name);
}
