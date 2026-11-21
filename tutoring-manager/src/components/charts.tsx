"use client";
// Graphiques (Recharts) : marques fines, grille discrète, info-bulle au survol, légende dès 2 séries.
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDT } from "@/lib/money";

const axis = { stroke: "rgb(var(--muted))", fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 3" />;
const tooltipStyle = {
  contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, fontSize: 12, color: "rgb(var(--ink))", boxShadow: "0 10px 30px -10px rgb(var(--shadow) / .3)" },
  labelStyle: { color: "rgb(var(--ink))", fontWeight: 600 },
  itemStyle: { color: "rgb(var(--ink-2))" },
  cursor: { fill: "rgb(var(--primary) / 0.12)" },
};

type Series = { key: string; label: string; color: string };

export function Bars({ data, x, series, money, height = 240, stacked, xFormat }: { data: Record<string, unknown>[]; x: string; series: Series[]; money?: boolean; height?: number; stacked?: boolean; xFormat?: (v: string) => string }) {
  const fmt = (v: number) => (money ? formatDT(v) : String(v));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
          {grid}
          <XAxis dataKey={x} {...axis} tickFormatter={xFormat} interval="preserveStartEnd" />
          <YAxis {...axis} width={money ? 56 : 36} tickFormatter={(v) => (money ? `${v}` : String(v))} />
          <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [fmt(v), n]} labelFormatter={(l) => (xFormat ? xFormat(String(l)) : String(l))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--ink-2))" }} iconType="circle" iconSize={8} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "a" : undefined} radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]} maxBarSize={36} stroke="rgb(var(--surface))" strokeWidth={stacked ? 1 : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({ data, x, series, height = 240, domain, xFormat }: { data: Record<string, unknown>[]; x: string; series: Series[]; height?: number; domain?: [number, number]; xFormat?: (v: string) => string }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          {grid}
          <XAxis dataKey={x} {...axis} tickFormatter={xFormat} />
          <YAxis {...axis} width={36} domain={domain ?? ["auto", "auto"]} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: "rgb(var(--muted))", strokeDasharray: "3 3" }} labelFormatter={(l) => (xFormat ? xFormat(String(l)) : String(l))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "rgb(var(--surface))" }} activeDot={{ r: 6 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Répartition (anneau) avec légende chiffrée : l'identité n'est jamais portée par la seule couleur. */
export function Donut({ data, money, height = 220 }: { data: { name: string; value: number; color: string }[]; money?: boolean; height?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const fmt = (v: number) => (money ? formatDT(v) : String(v));
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[180px_1fr]">
      <div style={{ height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="92%" paddingAngle={1.5} stroke="rgb(var(--surface))" strokeWidth={2}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v: number, n: string) => [`${fmt(v)} (${total ? Math.round((v / total) * 100) : 0} %)`, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
            <span className="tabular-nums text-ink">{fmt(d.value)}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted">{total ? Math.round((d.value / total) * 100) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)"];
