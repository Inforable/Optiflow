// Header pressure (PT-104) and filter dP (PDT-101) with dashed SITE SETPOINT lines and a
// shaded post-repair region when readings.postRepairFrom is set.
import { useMemo } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-control border border-dark-700 bg-dark-900 p-2.5 text-xs shadow-xl">
      <div className="mb-1 text-gray-400">{new Date(label).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}</span>
          <span className="ml-auto font-mono font-bold text-white">{Number(p.value).toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

export default function SignalChart({ readings, height = 240, compact = false }) {
  const { data, post, end } = useMemo(() => {
    const s = readings?.series || {};
    const pt = s['PT-104'] || [];
    const dp = s['PDT-101'] || [];
    const map = new Map();
    for (const [t, v] of pt) map.set(t, { ts: Date.parse(t), pt: v });
    for (const [t, v] of dp) map.set(t, { ...(map.get(t) || { ts: Date.parse(t) }), dp: v });
    const rows = [...map.values()].sort((a, b) => a.ts - b.ts);
    return {
      data: rows,
      post: readings?.postRepairFrom ? Date.parse(readings.postRepairFrom) : null,
      end: rows.length ? rows[rows.length - 1].ts : null,
    };
  }, [readings]);

  const sp = readings?.setpoints || {};
  if (!data.length) return <div className="skeleton" style={{ height }} />;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: compact ? 4 : 12, bottom: 0, left: compact ? -24 : -8 }}>
          <defs>
            <linearGradient id="ptFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            stroke="#9CA3AF"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis yAxisId="pt" domain={[0.6, 1.8]} stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} hide={compact} />
          <YAxis yAxisId="dp" orientation="right" domain={[0, 1.2]} stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} hide={compact} />
          {post && end ? (
            <ReferenceArea
              yAxisId="pt"
              x1={post}
              x2={end}
              fill="#10B981"
              fillOpacity={0.08}
              stroke="#10B981"
              strokeOpacity={0.3}
              label={{ value: 'Post-repair', position: 'insideTopRight', fill: '#34D399', fontSize: 10 }}
            />
          ) : null}
          {sp['PT-104']?.low != null && (
            <ReferenceLine yAxisId="pt" y={sp['PT-104'].low} stroke="#F59E0B" strokeDasharray="6 4" label={{ value: `PSL-104 ${sp['PT-104'].low} barg`, position: 'insideBottomLeft', fill: '#FBBF24', fontSize: 10 }} />
          )}
          {sp['PT-104']?.lowLow != null && (
            <ReferenceLine yAxisId="pt" y={sp['PT-104'].lowLow} stroke="#EF4444" strokeDasharray="6 4" label={{ value: `PSLL-104 ${sp['PT-104'].lowLow} barg (trip)`, position: 'insideBottomLeft', fill: '#F87171', fontSize: 10 }} />
          )}
          {sp['PDT-101']?.change != null && (
            <ReferenceLine yAxisId="dp" y={sp['PDT-101'].change} stroke="#8B5CF6" strokeDasharray="6 4" label={{ value: `Change element ${sp['PDT-101'].change} bar`, position: 'insideTopRight', fill: '#A78BFA', fontSize: 10 }} />
          )}
          <Tooltip content={<ChartTooltip />} />
          <Area yAxisId="pt" type="monotone" dataKey="pt" name="PT-104 header (barg)" stroke="#06B6D4" strokeWidth={2} fill="url(#ptFill)" dot={false} isAnimationActive={false} />
          <Line yAxisId="dp" type="monotone" dataKey="dp" name="PDT-101 filter dP (bar)" stroke="#8B5CF6" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
