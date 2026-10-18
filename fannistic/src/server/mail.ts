import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export function siteUrl() {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Gabarit HTML sobre aux couleurs de la marque, généré à partir de texte brut. */
function renderHtml(text: string, link: { url: string; label: string } | undefined, rtl: boolean) {
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = link
    ? `<p style="margin:22px 0"><a href="${escapeHtml(link.url)}" style="background:#FFB800;color:#0E1633;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<!doctype html><html dir="${rtl ? "rtl" : "ltr"}"><body style="margin:0;background:#F4F6FA;font-family:Poppins,Segoe UI,Arial,sans-serif;color:#0E1633">
<div style="max-width:560px;margin:0 auto;padding:28px 18px">
<div style="background:#0E1633;color:#fff;border-radius:16px 16px 0 0;padding:18px 24px;font-weight:700;font-size:20px">Fanni<span style="color:#FFC21A">’</span>stic</div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px">${paragraphs}${button}</div>
</div></body></html>`;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  link?: { url: string; label: string };
  rtl?: boolean;
  replyTo?: string;
}

/** Envoie réellement l'e-mail. Renvoie false si le service n'est pas configuré ou si l'envoi échoue. */
export async function sendMail(input: MailInput): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.link ? `${input.text}\n\n${input.link.label} : ${input.link.url}` : input.text,
      html: renderHtml(input.text, input.link, Boolean(input.rtl)),
    });
    return true;
  } catch (e) {
    console.error("[mail] échec de l'envoi :", (e as Error).message);
    return false;
  }
}
