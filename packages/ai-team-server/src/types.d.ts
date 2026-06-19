declare module 'pdf-parse/lib/pdf-parse.js' {
  import { Buffer } from 'node:buffer';
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    version: string;
    text: string;
  }
  function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<PdfData>;
  export default pdfParse;
}
