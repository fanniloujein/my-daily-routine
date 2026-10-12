// Génération de fichiers iCalendar (.ics) avec alarmes (VALARM),
// pour obtenir des rappels fiables via l'agenda du téléphone.

export type IcsEvent = {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null;
  endTime?: string | null;
  durationMin?: number;
  description?: string | null;
  alarmsMin?: number[];
  rrule?: string | null;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
const d8 = (d: string) => d.replace(/-/g, "");
const t6 = (t: string) => t.replace(":", "") + "00";

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

function addMin(date: string, time: string, min: number): { date: string; time: string } {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi + min));
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`, time: `${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}` };
}

export function buildIcs(events: IcsEvent[], calName = "My Life OS"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//My Life OS//FR", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(calName)}`];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(e.title)}`);
    if (e.startTime) {
      // Heure « flottante » (locale) : s'affiche à la même heure quel que soit le fuseau
      lines.push(`DTSTART:${d8(e.date)}T${t6(e.startTime)}`);
      const end = e.endTime ? { date: e.date, time: e.endTime } : addMin(e.date, e.startTime, e.durationMin ?? 30);
      lines.push(`DTEND:${d8(end.date)}T${t6(end.time)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d8(e.date)}`);
    }
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    for (const a of e.alarmsMin ?? []) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${a}M`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function rruleFor(a: { recurrence: string; interval: number; weekdays: number[]; until?: string | null }): string | null {
  const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  const until = a.until ? `;UNTIL=${d8(a.until)}T235959` : "";
  if (a.recurrence === "DAILY") return `FREQ=DAILY;INTERVAL=${a.interval}${until}`;
  if (a.recurrence === "WEEKLY" || a.recurrence === "CUSTOM") {
    const by = a.weekdays.length ? `;BYDAY=${a.weekdays.map((w) => days[w]).join(",")}` : "";
    return `FREQ=WEEKLY;INTERVAL=${a.interval}${by}${until}`;
  }
  return null;
}
