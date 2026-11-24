import React from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '../common/Button';

interface EmptyStateProps {
  onLogClick: () => void;
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onLogClick,
  title = 'No readings found for this period',
  description = 'Log your circadian meal slot readings to generate daily, month-to-date, or monthly glycemic reports.',
}) => {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-xs border border-slate-200/90 mb-4">
      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3 border border-teal-100">
        <ClipboardList className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
        {description}
      </p>
      <Button
        variant="primary"
        onClick={onLogClick}
        icon={<Plus className="w-4 h-4" />}
      >
        Record Blood Glucose Now
      </Button>
    </div>
  );
};
