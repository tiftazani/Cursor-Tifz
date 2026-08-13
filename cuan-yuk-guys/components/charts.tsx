"use client";

import {
  Area,
  AreaChart,
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

const AXIS = "#c4bcb2";
const GRID = "rgba(201,162,79,0.12)";

const tooltipStyle = {
  background: "#0c0c0c",
  border: "1px solid rgba(201,162,79,0.22)",
  borderRadius: 2,
  fontSize: 13,
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
  heightClass = "h-72",
  showX = false,
}: {
  data: { date: string; value: number }[];
  color?: string;
  heightClass?: string;
  showX?: boolean;
}) {
  return (
    <div className={`w-full ${heightClass}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            hide={!showX}
            interval="preserveStartEnd"
            tick={{ fill: AXIS, fontSize: 12 }}
            minTickGap={48}
          />
          <YAxis domain={["auto", "auto"]} tick={{ fill: AXIS, fontSize: 12 }} width={72} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IhsgChart({
  data,
  color = "#c9a24f",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) {
  return (
    <div className="h-[22rem] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ihsgFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" interval="preserveStartEnd" tick={{ fill: AXIS, fontSize: 12 }} minTickGap={56} />
          <YAxis domain={["auto", "auto"]} tick={{ fill: AXIS, fontSize: 12 }} width={72} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.2} fill="url(#ihsgFill)" />
        </AreaChart>
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
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis domain={["auto", "auto"]} tick={{ fill: AXIS, fontSize: 12 }} width={48} />
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
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fill: AXIS, fontSize: 12 }} width={40} />
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
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="bucket" tick={{ fill: AXIS, fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} width={28} />
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
          <CartesianGrid stroke={GRID} />
          <XAxis
            dataKey="volPct"
            name="Volatilitas %"
            tick={{ fill: AXIS, fontSize: 12 }}
            type="number"
          />
          <YAxis dataKey="retPct" name="Return 1 bln %" tick={{ fill: AXIS, fontSize: 12 }} type="number" />
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
