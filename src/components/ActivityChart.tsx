'use client';

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

export default function ActivityChart({
  data,
}: {
  data: { date: string; minutes: number; xp: number }[];
}) {
  return (
    <div style={{ width: '100%', height: 240 }} dir="ltr">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary-500)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="var(--color-primary-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} interval={4} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--fg)' }}
            formatter={(v) => [`${Number(v ?? 0)} دقیقه`, 'یادگیری'] as [string, string]}
          />
          <Area
            type="monotone"
            dataKey="minutes"
            stroke="var(--color-primary-600)"
            strokeWidth={2}
            fill="url(#g)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
