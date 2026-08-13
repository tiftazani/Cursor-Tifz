"use client";

import { useEffect, useState } from "react";
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

type Theme = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipFg: string;
  blue: string;
  green: string;
};

function useAppleChartTheme(): Theme {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return dark
    ? {
        axis: "#98989d",
        grid: "rgba(84,84,88,0.45)",
        tooltipBg: "#1c1c1e",
        tooltipFg: "#f5f5f7",
        blue: "#0a84ff",
        green: "#30d158",
      }
    : {
        axis: "#6e6e73",
        grid: "rgba(60,60,67,0.12)",
        tooltipBg: "#ffffff",
        tooltipFg: "#1d1d1f",
        blue: "#007aff",
        green: "#34c759",
      };
}

function tip(theme: Theme) {
  return {
    background: theme.tooltipBg,
    border: "0.5px solid rgba(60,60,67,0.18)",
    borderRadius: 12,
    fontSize: 13,
    color: theme.tooltipFg,
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  };
}

export function MonthlyArea({ data }: { data: { month: string; count: number }[] }) {
  const theme = useAppleChartTheme();
  const series = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <defs>
            <linearGradient id="imoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.blue} stopOpacity={0.28} />
              <stop offset="100%" stopColor={theme.blue} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="label" interval={5} tick={{ fill: theme.axis, fontSize: 11 }} minTickGap={28} />
          <YAxis tick={{ fill: theme.axis, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tip(theme)} />
          <Area type="monotone" dataKey="count" name="Pesan" stroke={theme.blue} strokeWidth={2.2} fill="url(#imoFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function YearBar({ data }: { data: { year: string; count: number }[] }) {
  const theme = useAppleChartTheme();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="year" tick={{ fill: theme.axis, fontSize: 12 }} />
          <YAxis tick={{ fill: theme.axis, fontSize: 12 }} width={48} />
          <Tooltip contentStyle={tip(theme)} />
          <Bar dataKey="count" name="Pesan" fill={theme.blue} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourBar({ data }: { data: { hour: number; count: number }[] }) {
  const theme = useAppleChartTheme();
  const series = data.map((d) => ({ ...d, label: `${String(d.hour).padStart(2, "0")}` }));
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="label" interval={2} tick={{ fill: theme.axis, fontSize: 11 }} />
          <YAxis tick={{ fill: theme.axis, fontSize: 12 }} width={40} />
          <Tooltip contentStyle={tip(theme)} />
          <Bar dataKey="count" name="Pesan" fill={theme.blue} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeekdayBar({ data }: { data: { day: string; count: number }[] }) {
  const theme = useAppleChartTheme();
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis dataKey="day" tick={{ fill: theme.axis, fontSize: 12 }} />
          <YAxis tick={{ fill: theme.axis, fontSize: 12 }} width={40} />
          <Tooltip contentStyle={tip(theme)} />
          <Bar dataKey="count" name="Pesan" fill={theme.green} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
