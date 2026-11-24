import type { TimeSlot, ClinicalEvaluation } from '../types/reading';

export const SLOT_CONFIG: Record<
  TimeSlot,
  {
    label: string;
    shortLabel: string;
    timeOfDay: string;
    isFasting: boolean;
    order: number;
  }
> = {
  morning_fasting: {
    label: 'Morning (fasting)',
    shortLabel: 'Fasting',
    timeOfDay: '07:00 AM',
    isFasting: true,
    order: 1,
  },
  after_breakfast: {
    label: 'After breakfast',
    shortLabel: 'Breakfast',
    timeOfDay: '09:00 AM',
    isFasting: false,
    order: 2,
  },
  after_lunch: {
    label: 'After lunch',
    shortLabel: 'Lunch',
    timeOfDay: '01:30 PM',
    isFasting: false,
    order: 3,
  },
  after_dinner: {
    label: 'After dinner',
    shortLabel: 'Dinner',
    timeOfDay: '08:30 PM',
    isFasting: false,
    order: 4,
  },
};

export const CHRONOLOGICAL_SLOTS: TimeSlot[] = [
  'morning_fasting',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
];

/**
 * Evaluates blood glucose reading against standard American Diabetes Association (ADA) clinical guidelines
 */
export function evaluateGlucose(value: number, slot?: TimeSlot): ClinicalEvaluation {
  if (value < 70) {
    return {
      status: 'low',
      label: 'Low',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Below 70 mg/dL – Hypoglycemia risk. Take fast-acting carbs if advised.',
    };
  }

  const isFasting = slot ? SLOT_CONFIG[slot].isFasting : true;

  if (isFasting) {
    // Fasting guidelines: Normal 70-99, Borderline 100-125, High >= 126
    if (value <= 99) {
      return {
        status: 'normal',
        label: 'In Target',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: '70–99 mg/dL – Optimal fasting glycemic control.',
      };
    }
    if (value <= 125) {
      return {
        status: 'borderline',
        label: 'Borderline',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: '100–125 mg/dL – Slightly elevated fasting level.',
      };
    }
    return {
      status: 'high',
      label: 'High',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      description: '≥ 126 mg/dL – Fasting hyperglycemia indicator.',
    };
  } else {
    // Post-meal guidelines: Normal < 140, Borderline 140-180, High > 180
    if (value < 140) {
      return {
        status: 'normal',
        label: 'In Target',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: '< 140 mg/dL – Optimal postprandial glucose level.',
      };
    }
    if (value <= 180) {
      return {
        status: 'borderline',
        label: 'Borderline',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: '140–180 mg/dL – Mild post-meal elevation.',
      };
    }
    return {
      status: 'high',
      label: 'High',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      description: '> 180 mg/dL – Post-meal hyperglycemia threshold.',
    };
  }
}
