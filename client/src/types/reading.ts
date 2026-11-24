export type TimeSlot = 'morning_fasting' | 'after_breakfast' | 'after_lunch' | 'after_dinner';

export interface Reading {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  slot: TimeSlot;
  value: number; // 40 - 600
  createdAt: string;
  updatedAt: string;
}

export interface ReadingsResponse {
  data: Reading[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReadingResponse {
  reading: Reading;
}

export interface ReadingFormData {
  date: string;
  slot: TimeSlot;
  value: number | '';
}

export type ClinicalStatus = 'low' | 'normal' | 'borderline' | 'high';

export interface ClinicalEvaluation {
  status: ClinicalStatus;
  label: string;
  badgeClass: string;
  description: string;
}
