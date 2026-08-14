import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { extractResumeText } from "../src/core/resumeParser";

pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.min.mjs")).href;

function fakeFile(name: string, type: string, bytes: Uint8Array): File {
  return {
    name,
    type,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  } as File;
}

async function makeDocx(text: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.folder("word")?.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:sectPr/></w:body>
    </w:document>`);
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("real file parsing smoke tests", () => {
  it("extracts text from a minimal DOCX", async () => {
    const bytes = await makeDocx("求职意向前端开发工程师，四年React和TypeScript项目经验，期望城市上海。");
    const text = await extractResumeText(fakeFile("resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", bytes));
    expect(text).toContain("前端开发工程师");
    expect(text).toContain("TypeScript");
  });

  it("extracts text from a generated text PDF", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([500, 500]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("Frontend engineer with four years React TypeScript Node experience", { x: 40, y: 440, size: 12, font });
    const bytes = await pdf.save();
    const text = await extractResumeText(fakeFile("resume.pdf", "application/pdf", bytes));
    expect(text).toContain("Frontend engineer");
    expect(text).toContain("TypeScript");
  });
});
