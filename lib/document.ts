import { ApiError } from "@/lib/errors";

export async function extractDocumentText(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "pdf" || file.type === "application/pdf") {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buffer);
    const text = parsed.text.replace(/\s+\n/g, "\n").trim();

    if (!text) {
      throw new ApiError("The uploaded PDF did not contain readable text.", 400);
    }

    return text;
  }

  if (
    file.type.startsWith("text/") ||
    extension === "txt" ||
    extension === "md" ||
    extension === "rtf"
  ) {
    const text = buffer.toString("utf-8").trim();

    if (!text) {
      throw new ApiError("The uploaded document is empty.", 400);
    }

    return text;
  }

  throw new ApiError("Unsupported file type. Upload a text file or PDF.", 400);
}
