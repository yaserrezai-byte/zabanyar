'use client';

import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer,
} from 'recharts';

export default function SkillRadar({
  data,
}: {
  data: { skill: string; score: number }[];
}) {
  if (!data.length) return null;
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} angle={90} />
          <Radar
            name="امتیاز"
            dataKey="score"
            stroke="var(--color-primary-600)"
            fill="var(--color-primary-500)"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
