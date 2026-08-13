"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthLabel } from "@/lib/imo";

const AXIS = "#c4bcb2";
const GRID = "rgba(201,162,79,0.12)";

const tooltipStyle = {
  background: "#0c0c0c",
  border: "1px solid rgba(201,162,79,0.22)",
  borderRadius: 2,
  fontSize: 13,
  color: "#f2eee6",
};

export function MonthlyArea({ data }: { data: { month: string; count: number }[] }) {
  const series = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id="imoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c9a24f" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#c9a24f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" interval={5} tick={{ fill: AXIS, fontSize: 11 }} minTickGap={28} />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="count" name="Pesan" stroke="#c9a24f" strokeWidth={2} fill="url(#imoFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function YearBar({ data }: { data: { year: string; count: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 12 }} />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Pesan" fill="#c9a24f" radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourBar({ data }: { data: { hour: number; count: number }[] }) {
  const series = data.map((d) => ({ ...d, label: `${String(d.hour).padStart(2, "0")}` }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" interval={2} tick={{ fill: AXIS, fontSize: 11 }} />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} width={40} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Pesan" fill="#d4af77" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekdayBar({ data }: { data: { day: string; count: number }[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tick={{ fill: AXIS, fontSize: 12 }} />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} width={40} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Pesan" fill="#9cba8a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
