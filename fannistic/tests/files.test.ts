import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sniff, safeName } = await import("@/server/files");

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe("contrôle des fichiers envoyés", () => {
  it("reconnaît les formats d'après leur contenu", () => {
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "a.png")?.mime).toBe("image/png");
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0), "photo.jpg")?.mime).toBe("image/jpeg");
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46), "brief.pdf")?.mime).toBe("application/pdf");
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04), "doc.docx")?.ext).toBe("docx");
  });
  it("refuse un exécutable déguisé en image", () => {
    expect(sniff(bytes(0x4d, 0x5a, 0x90, 0x00), "virus.png")).toBeNull();
  });
  it("refuse le HTML/SVG (risque de script)", () => {
    expect(sniff(new TextEncoder().encode("<svg onload=alert(1)>"), "x.svg")).toBeNull();
    expect(sniff(new TextEncoder().encode("<html><script>"), "x.html")).toBeNull();
  });
  it("accepte le texte brut UTF-8", () => {
    expect(sniff(new TextEncoder().encode("Bonjour 👋"), "notes.txt")?.ext).toBe("txt");
  });
  it("nettoie les noms de fichiers", () => {
    expect(safeName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(safeName('a<b>:"c".pdf')).toBe("a_b___c_.pdf");
  });
});
