// Génération des reçus PDF et des exports Excel / PDF.
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { readSettings } from "@/lib/settings";
import { loadLedger } from "./finance";
import { formatDT, fromMil, toMil } from "@/lib/money";
import { longDate, shortDate, today } from "@/lib/dates";
import { PAYMENT_KINDS, PAYMENT_METHODS, TX_TYPES } from "@/lib/constants";

// Les polices PDF standard ne contiennent pas certains caractères typographiques.
const clean = (s: string) => s.replace(/[  ]/g, " ").replace(/−/g, "-").replace(/[’‘]/g, "'").replace(/[«»]/g, '"').replace(/…/g, "...").replace(/[–—]/g, "-");
const NAVY: [number, number, number] = [30, 42, 74];
const BLUE: [number, number, number] = [143, 184, 232];

function header(doc: jsPDF, title: string, appName: string, sub?: string) {
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(clean(appName), 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(clean(title), 14, 21);
  if (sub) doc.text(clean(sub), 196, 21, { align: "right" });
  doc.setTextColor(40, 40, 40);
}

export async function receiptPdf(paymentId: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { student: { include: { parent: true } } } });
  if (!p) throw new HttpError(404, "Versement introuvable.");
  const user = await prisma.user.findFirst();
  const st = readSettings(user?.settings);
  // Solde de l'élève juste après ce versement (journal), sinon solde actuel
  const tx = await prisma.financialTransaction.findFirst({ where: { paymentId: p.id, type: { in: ["PAYMENT_RECEIVED", "ADVANCE_RECEIVED", "DISCOUNT"] } } });
  const { ledger } = await loadLedger(prisma, p.studentId);
  const dueAfter = tx ? fromMil(toMil(tx.dueAfter)) : fromMil(ledger.totals.due);
  const creditAfter = tx ? fromMil(toMil(tx.creditAfter)) : fromMil(ledger.totals.credit);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, p.kind === "ADVANCE" ? "Reçu d'avance" : "Reçu de paiement", st.appName, p.receiptNo ?? "");
  let y = 42;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Enseignante", 14, y);
  doc.text("Élève", 110, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  const left = [st.teacherName || user?.name || "", st.phone, st.contactEmail, st.address].filter(Boolean);
  const right = [`${p.student.firstName} ${p.student.lastName}`, p.student.parent ? `Parent : ${p.student.parent.name}${p.student.parent.phone ? ` (${p.student.parent.phone})` : ""}` : ""].filter(Boolean);
  left.forEach((l, i) => doc.text(clean(l), 14, y + i * 5));
  right.forEach((l, i) => doc.text(clean(l), 110, y + i * 5));
  y += Math.max(left.length, right.length) * 5 + 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 60 } },
    head: [["Détail", ""]],
    body: [
      ["N° de reçu", p.receiptNo ?? "—"],
      ["Date", clean(longDate(p.date))],
      ["Type", PAYMENT_KINDS[p.kind as keyof typeof PAYMENT_KINDS] ?? p.kind],
      ["Montant reçu", clean(formatDT(fromMil(toMil(p.amount))))],
      ["Mode de paiement", PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method],
      ["Motif", clean(p.reason || (p.kind === "ADVANCE" ? "Avance sur les prochaines séances" : "Cours particuliers"))],
      ...(p.reference ? [["Référence", clean(p.reference)]] : []),
      ["Solde restant à payer", clean(formatDT(dueAfter))],
      ["Crédit disponible", clean(formatDT(creditAfter))],
    ],
  });
  // @ts-expect-error propriété ajoutée par jspdf-autotable
  y = (doc.lastAutoTable?.finalY ?? y) + 14;
  if (p.voidedAt) {
    doc.setTextColor(200, 60, 60);
    doc.setFont("helvetica", "bold");
    doc.text(clean(`REÇU ANNULÉ — ${p.voidReason ?? ""}`), 14, y);
    doc.setTextColor(40, 40, 40);
    y += 10;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(clean(`Fait le ${shortDate(today())}`), 14, y);
  doc.text("Signature", 160, y);
  return { buffer: Buffer.from(doc.output("arraybuffer")), filename: `${p.receiptNo ?? "recu"}-${p.student.lastName}.pdf` };
}

type Col = { header: string; key: string; width?: number; money?: boolean };

export async function buildExport(dataset: string, p: URLSearchParams) {
  const from = p.get("from") ?? undefined, to = p.get("to") ?? undefined;
  const studentId = p.get("studentId") ?? undefined;
  const date = { gte: from, lte: to };
  let title = "", cols: Col[] = [], rows: Record<string, unknown>[] = [];
  const name = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;

  if (dataset === "transactions") {
    title = "Journal des transactions";
    const items = await prisma.financialTransaction.findMany({ where: { date, studentId }, include: { student: true }, orderBy: { createdAt: "asc" } });
    cols = [
      { header: "Date", key: "date", width: 12 },
      { header: "Élève", key: "student", width: 22 },
      { header: "Opération", key: "type", width: 22 },
      { header: "Description", key: "description", width: 48 },
      { header: "Montant (DT)", key: "amount", width: 14, money: true },
      { header: "Reste dû après", key: "dueAfter", width: 14, money: true },
      { header: "Crédit après", key: "creditAfter", width: 14, money: true },
    ];
    rows = items.map((t) => ({ date: shortDate(t.date), student: name(t.student), type: TX_TYPES[t.type]?.label ?? t.type, description: t.description, amount: fromMil(toMil(t.amount)), dueAfter: fromMil(toMil(t.dueAfter)), creditAfter: fromMil(toMil(t.creditAfter)) }));
  } else if (dataset === "payments") {
    title = "Versements reçus";
    const items = await prisma.payment.findMany({ where: { date, studentId }, include: { student: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
    cols = [
      { header: "Date", key: "date", width: 12 },
      { header: "N° reçu", key: "receiptNo", width: 14 },
      { header: "Élève", key: "student", width: 22 },
      { header: "Type", key: "kind", width: 12 },
      { header: "Mode", key: "method", width: 16 },
      { header: "Motif", key: "reason", width: 30 },
      { header: "Montant (DT)", key: "amount", width: 14, money: true },
      { header: "Statut", key: "status", width: 14 },
    ];
    rows = items.map((x) => ({
      date: shortDate(x.date), receiptNo: x.receiptNo ?? "", student: name(x.student), kind: PAYMENT_KINDS[x.kind as keyof typeof PAYMENT_KINDS], method: PAYMENT_METHODS[x.method as keyof typeof PAYMENT_METHODS] ?? x.method,
      reason: x.reason ?? "", amount: fromMil(toMil(x.amount)), status: x.voidedAt ? `Annulé (${x.voidReason ?? ""})` : "Valide",
    }));
  } else if (dataset === "finance") {
    title = "Situation financière des élèves";
    const { financeOverview } = await import("./reports");
    const ov = await financeOverview(p);
    cols = [
      { header: "Élève", key: "name", width: 24 },
      { header: "Niveau", key: "level", width: 20 },
      { header: "Séances effectuées", key: "sessionsDone", width: 10 },
      { header: "Frais dus (DT)", key: "billed", width: 14, money: true },
      { header: "Payé (DT)", key: "paid", width: 14, money: true },
      { header: "Avances (DT)", key: "advances", width: 14, money: true },
      { header: "Crédit disponible (DT)", key: "credit", width: 14, money: true },
      { header: "Reste à payer (DT)", key: "due", width: 14, money: true },
    ];
    rows = ov.rows.map((r) => ({ ...r, level: r.level ?? "" }));
    rows.push({ name: "TOTAL", level: "", sessionsDone: "", billed: ov.totals.billed, paid: ov.totals.paid, advances: "", credit: ov.totals.credit, due: ov.totals.due });
  } else if (dataset === "sessions") {
    title = "Séances";
    const items = await prisma.session.findMany({ where: { date, ...(studentId ? { participants: { some: { studentId } } } : {}) }, include: { participants: { include: { student: true } }, subject: true }, orderBy: [{ date: "asc" }, { startTime: "asc" }] });
    const { SESSION_STATUS } = await import("@/lib/constants");
    cols = [
      { header: "Date", key: "date", width: 12 },
      { header: "Horaire", key: "time", width: 14 },
      { header: "Élève(s)", key: "students", width: 30 },
      { header: "Matière", key: "subject", width: 18 },
      { header: "Chapitre", key: "chapter", width: 24 },
      { header: "Statut", key: "status", width: 18 },
      { header: "Tarif (DT)", key: "price", width: 12, money: true },
    ];
    rows = items.map((s) => ({
      date: shortDate(s.date), time: `${s.startTime}-${s.endTime}`, students: s.title || s.participants.map((x) => name(x.student)).join(", "), subject: s.subject?.name ?? "", chapter: s.chapter ?? "",
      status: SESSION_STATUS[s.status].label, price: fromMil(s.participants.reduce((a, x) => a + toMil(x.price), 0)),
    }));
  } else throw new HttpError(400, "Export inconnu.");

  const period = from || to ? `Période : ${from ? shortDate(from) : "début"} → ${to ? shortDate(to) : "aujourd'hui"}` : `Au ${shortDate(today())}`;
  const format = p.get("format") === "pdf" ? "pdf" : "xlsx";
  const filename = `${dataset}-${today()}.${format}`;

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Fanni's Tutoring Manager";
    const ws = wb.addWorksheet(title.slice(0, 30));
    ws.addRow([title]).font = { bold: true, size: 14 };
    ws.addRow([period]);
    ws.addRow([]);
    const head = ws.addRow(cols.map((c) => c.header));
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E2A4A" } }));
    for (const r of rows) ws.addRow(cols.map((c) => r[c.key] ?? ""));
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = (c.width ?? 14) + 2;
      if (c.money) col.numFmt = "#,##0.000";
    });
    ws.views = [{ state: "frozen", ySplit: 4 }];
    const buf = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buf as ArrayBuffer), filename, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  const user = await prisma.user.findFirst();
  const doc = new jsPDF({ orientation: cols.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  header(doc, title, readSettings(user?.settings).appName, period);
  autoTable(doc, {
    startY: 34,
    head: [cols.map((c) => clean(c.header))],
    body: rows.map((r) => cols.map((c) => clean(c.money && typeof r[c.key] === "number" ? formatDT(r[c.key] as number) : String(r[c.key] ?? "")))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    alternateRowStyles: { fillColor: [247, 244, 238] },
  });
  return { buffer: Buffer.from(doc.output("arraybuffer")), filename, type: "application/pdf" };
}
