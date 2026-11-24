import type { Reading } from './reading';

export type ReportType = 'daily' | 'month_to_date' | 'monthly';

export interface ReportStats {
  count: number;
  highest: number | null;
  lowest: number | null;
  average: number | null;
}

export interface ReportResponse {
  type: ReportType;
  selectedDate: string;
  dateFrom: string;
  dateTo: string;
  stats: ReportStats;
  readings: Reading[];
}
