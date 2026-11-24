import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { Reading } from '../../types/reading';
import { SLOT_CONFIG, evaluateGlucose } from '../../utils/clinical';

interface TrendChartProps {
  readings: Reading[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ readings }) => {
  if (readings.length === 0) return null;

  // Format data points for chart
  const data = readings.map((r, index) => {
    const slotLabel = SLOT_CONFIG[r.slot]?.shortLabel || r.slot;
    return {
      index: index + 1,
      date: r.date,
      slot: r.slot,
      slotLabel,
      value: r.value,
      fullLabel: `${r.date.slice(5)} (${slotLabel})`,
    };
  });

  return (
    <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Glycemic Curve
          </h3>
          <p className="text-sm font-semibold text-slate-900">
            Timeline Progression ({readings.length} points)
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-emerald-600 inline-block" />
            <span>Target (&lt;140)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-blue-600 inline-block" />
            <span>Low (70)</span>
          </div>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="fullLabel"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={[40, (dataMax: number) => Math.max(dataMax + 20, 200)]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              unit=" "
            />
            {/* ADA Reference Target Lines */}
            <ReferenceLine
              y={70}
              stroke="#2563eb"
              strokeDasharray="3 3"
              label={{ value: '70', position: 'right', fill: '#2563eb', fontSize: 10 }}
            />
            <ReferenceLine
              y={140}
              stroke="#059669"
              strokeDasharray="3 3"
              label={{ value: '140', position: 'right', fill: '#059669', fontSize: 10 }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  const evaluation = evaluateGlucose(item.value, item.slot);
                  return (
                    <div className="bg-slate-900 text-white p-2.5 rounded-xl text-xs shadow-lg border border-slate-800">
                      <p className="font-bold text-white mb-0.5">{item.date}</p>
                      <p className="text-slate-300 text-[11px] mb-1">
                        {SLOT_CONFIG[item.slot as keyof typeof SLOT_CONFIG]?.label || item.slot}
                      </p>
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-700">
                        <span className="font-extrabold text-base text-teal-400">
                          {item.value} mg/dL
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          evaluation.status === 'normal'
                            ? 'bg-emerald-950 text-emerald-400'
                            : evaluation.status === 'borderline'
                            ? 'bg-amber-950 text-amber-400'
                            : evaluation.status === 'low'
                            ? 'bg-blue-950 text-blue-400'
                            : 'bg-rose-950 text-rose-400'
                        }`}>
                          {evaluation.label}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Line
              type="monotone"
              dataKey="value"
              stroke="#0f766e"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#0f766e', stroke: '#ffffff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: '#0f766e', stroke: '#ccfbf1', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
