"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "#0c0c0c",
  border: "1px solid rgba(201,162,79,0.22)",
  borderRadius: 2,
  fontSize: 12,
  color: "#f2eee6",
};

export function Sparkline({ data, color = "#c9a24f" }: { data: number[]; color?: string }) {
  const series = data.map((v, i) => ({ i, v }));
  const up = (data[data.length - 1] ?? 0) >= (data[0] ?? 0);
  return (
    <div className="h-10 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color || (up ? "#9cba8a" : "#d46a6a")}
            strokeWidth={1.4}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceChart({
  data,
  color = "#c9a24f",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(201,162,79,0.08)" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis domain={["auto", "auto"]} tick={{ fill: "#8a8378", fontSize: 11 }} width={64} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DualLineChart({
  data,
}: {
  data: { date: string; picks: number; ihsg: number }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(201,162,79,0.08)" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis domain={["auto", "auto"]} tick={{ fill: "#8a8378", fontSize: 11 }} width={48} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="picks" name="Top 5 desk" stroke="#c9a24f" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ihsg" name="IHSG" stroke="#f2eee6" strokeWidth={1.4} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DrawdownChart({ data }: { data: { date: string; dd: number }[] }) {
  const series = data.map((d) => ({ ...d, ddPct: d.dd * 100 }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <CartesianGrid stroke="rgba(201,162,79,0.08)" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fill: "#8a8378", fontSize: 11 }} width={40} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="ddPct" name="Drawdown %" stroke="#d46a6a" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreBarChart({ data }: { data: { bucket: string; count: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(201,162,79,0.08)" vertical={false} />
          <XAxis dataKey="bucket" tick={{ fill: "#8a8378", fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#8a8378", fontSize: 11 }} width={28} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="#c9a24f" radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskScatter({
  data,
}: {
  data: { ticker: string; vol: number; ret1m: number; score: number }[];
}) {
  const series = data.map((d) => ({ ...d, volPct: d.vol * 100, retPct: d.ret1m * 100 }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid stroke="rgba(201,162,79,0.08)" />
          <XAxis
            dataKey="volPct"
            name="Volatilitas %"
            tick={{ fill: "#8a8378", fontSize: 11 }}
            type="number"
          />
          <YAxis dataKey="retPct" name="Return 1 bln %" tick={{ fill: "#8a8378", fontSize: 11 }} type="number" />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle} />
          <Scatter data={series}>
            {series.map((d) => (
              <Cell key={d.ticker} fill={d.score >= 70 ? "#c9a24f" : d.score >= 50 ? "#f2eee6" : "#d46a6a"} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
