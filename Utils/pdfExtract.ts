import pdfParse from 'pdf-parse';

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { text } = await pdfParse(buffer);
  return text.trim();
}
