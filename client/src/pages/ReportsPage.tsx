import React, { useState, useEffect, useCallback } from 'react';
import { ReportTypeSelector } from '../components/reports/ReportTypeSelector';
import { SummaryCards } from '../components/reports/SummaryCards';
import { TrendChart } from '../components/reports/TrendChart';
import { EmptyState } from '../components/reports/EmptyState';
import { getTodayDateString } from '../utils/date';
import { evaluateGlucose, SLOT_CONFIG } from '../utils/clinical';
import type { ReportType, ReportResponse } from '../types/report';
import type { Reading } from '../types/reading';
import { api, ApiError } from '../services/api';
import { AlertCircle, RefreshCw, Activity } from 'lucide-react';

interface ReportsPageProps {
  onNavigateToReadings: () => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateToReadings }) => {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [chartReadings, setChartReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.reports.get(reportType, selectedDate);
      setReport(res);

      if (reportType === 'daily') {
        setChartReadings(res.readings || []);
      } else {
        // Fetch all readings within dateFrom and dateTo across pages for comprehensive trend charting
        try {
          let allReadings: Reading[] = [];
          let page = 1;
          let totalPages = 1;

          while (page <= totalPages && page <= 10) {
            const listRes = await api.readings.list({ page, limit: 100 });
            if (listRes.data && listRes.data.length > 0) {
              allReadings = allReadings.concat(listRes.data);
            }
            if (listRes.pagination && listRes.pagination.totalPages) {
              totalPages = listRes.pagination.totalPages;
            } else {
              break;
            }
            page++;
          }

          if (res.dateFrom && res.dateTo) {
            const filtered = allReadings
              .filter((r) => r.date >= res.dateFrom && r.date <= res.dateTo)
              .sort((a, b) => {
                const dateCmp = a.date.localeCompare(b.date);
                if (dateCmp !== 0) return dateCmp;
                const orderA = SLOT_CONFIG[a.slot]?.order || 0;
                const orderB = SLOT_CONFIG[b.slot]?.order || 0;
                return orderA - orderB;
              });
            setChartReadings(filtered);
          } else {
            setChartReadings([]);
          }
        } catch {
          setChartReadings([]);
        }
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to generate report.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const hasData = report && report.stats && report.stats.count > 0;

  return (
    <div className="space-y-4">
      {/* Timeframe & Date Selector */}
      <ReportTypeSelector
        type={reportType}
        onChangeType={setReportType}
        selectedDate={selectedDate}
        onChangeDate={setSelectedDate}
        dateFrom={report?.dateFrom}
        dateTo={report?.dateTo}
      />

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchReport}
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-800"
            title="Retry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      {report && <SummaryCards stats={report.stats} />}

      {/* Visual Glucose Curve (Recharts) */}
      {hasData && chartReadings.length > 0 && (
        <TrendChart readings={chartReadings} />
      )}

      {/* Daily Breakdown List (If daily report) */}
      {reportType === 'daily' && hasData && report.readings && report.readings.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Circadian Breakdown ({report.readings.length} readings)
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {report.readings.map((r) => {
              const cfg = SLOT_CONFIG[r.slot];
              const evaluation = evaluateGlucose(r.value, r.slot);
              return (
                <div key={r.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">
                      {cfg?.label || r.slot}
                    </p>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Target: {cfg?.isFasting ? '70–99 mg/dL' : '< 140 mg/dL'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900 font-mono">
                      {r.value} <span className="text-[10px] font-normal text-slate-500">mg/dL</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${evaluation.badgeClass}`}
                    >
                      {evaluation.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State when count === 0 */}
      {report && !hasData && !loading && (
        <EmptyState
          onLogClick={onNavigateToReadings}
          title={
            reportType === 'daily'
              ? 'No readings logged for this date'
              : reportType === 'month_to_date'
              ? 'No readings found for month-to-date period'
              : 'No readings found for the previous month'
          }
          description="Log your daily circadian blood glucose readings to view statistical summaries, average glycemic levels, and trend curves."
        />
      )}
    </div>
  );
};
