/**
 * fileParser.ts
 * Client-side text extraction for PDF, Word (.docx), and Excel (.xlsx/.xls/.csv) files.
 * Extracted text is truncated to MAX_CHARS to avoid exceeding LLM context windows.
 */

const MAX_CHARS = 50_000;

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;
  return (
    text.slice(0, MAX_CHARS) +
    `\n\n[... content truncated at ${MAX_CHARS.toLocaleString()} characters ...]`
  );
}

// ── PDF ──────────────────────────────────────────────────────────────────────

async function extractPdf(file: File): Promise<string> {
  // Dynamically import to keep the initial bundle lean
  const pdfjsLib = await import("pdfjs-dist");

  // Use the worker file copied to /public — avoids CDN version mismatches
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(`--- Page ${i} ---\n${pageText}`);

    // Early exit if already over limit (saves parsing time)
    if (pageTexts.join("\n").length > MAX_CHARS) break;
  }

  return truncate(pageTexts.join("\n\n"));
}

// ── Word (.docx) ─────────────────────────────────────────────────────────────

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return truncate(result.value);
}

// ── Excel / CSV ───────────────────────────────────────────────────────────────

async function extractExcel(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sheetTexts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to CSV — clean and token-efficient
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    sheetTexts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }

  return truncate(sheetTexts.join("\n\n"));
}

// ── Plain text ────────────────────────────────────────────────────────────────

async function extractText(file: File): Promise<string> {
  const text = await file.text();
  return truncate(text);
}

// ── Public API ────────────────────────────────────────────────────────────────

export type FileCategory = "image" | "pdf" | "word" | "excel" | "text" | "unknown";

export function getFileCategory(file: File): FileCategory {
  const { type, name } = file;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  )
    return "word";
  if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv"
  )
    return "excel";
  if (type.startsWith("text/") || ext === "txt" || ext === "md") return "text";
  return "unknown";
}

export async function extractTextFromFile(file: File): Promise<string> {
  const category = getFileCategory(file);
  switch (category) {
    case "pdf":
      return extractPdf(file);
    case "word":
      return extractDocx(file);
    case "excel":
      return extractExcel(file);
    case "text":
      return extractText(file);
    default:
      throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }
}

/** Format extracted text for injection into the AI message */
export function formatDocumentForPrompt(name: string, extractedText: string): string {
  return `[Attached document: ${name}]\n\`\`\`\n${extractedText}\n\`\`\``;
}
