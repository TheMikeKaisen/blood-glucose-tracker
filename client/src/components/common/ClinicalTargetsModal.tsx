import React from 'react';
import { Modal } from './Modal';
import { ShieldCheck, Info } from 'lucide-react';

interface ClinicalTargetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClinicalTargetsModal: React.FC<ClinicalTargetsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clinical Target Guidelines (ADA)"
      description="Standard glycemic ranges calibrated according to the American Diabetes Association (ADA)."
    >
      <div className="space-y-4">
        {/* Hypoglycemia Banner */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
          <div className="font-bold mb-0.5 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Low / Hypoglycemia (&lt; 70 mg/dL)</span>
          </div>
          <p className="text-[11px] text-blue-700">
            Readings below 70 mg/dL represent hypoglycemia. Treat immediately with fast-acting carbohydrates according to clinician instructions.
          </p>
        </div>

        {/* Fasting Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100/80 px-3 py-2 text-xs font-bold text-slate-800 border-b border-slate-200">
            Fasting Glucose Targets (Morning Fasting)
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between p-2.5">
              <span className="font-semibold text-emerald-800">In Target / Normal</span>
              <span className="font-bold text-slate-900 font-mono">70 – 99 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-2.5">
              <span className="font-semibold text-amber-800">Borderline / Elevated</span>
              <span className="font-bold text-slate-900 font-mono">100 – 125 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-2.5">
              <span className="font-semibold text-rose-800">High / Fasting Hyperglycemia</span>
              <span className="font-bold text-slate-900 font-mono">≥ 126 mg/dL</span>
            </div>
          </div>
        </div>

        {/* Post-Meal Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-100/80 px-3 py-2 text-xs font-bold text-slate-800 border-b border-slate-200">
            Post-Meal Glucose Targets (Breakfast, Lunch, Dinner)
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between p-2.5">
              <span className="font-semibold text-emerald-800">In Target / Normal</span>
              <span className="font-bold text-slate-900 font-mono">&lt; 140 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-2.5">
              <span className="font-semibold text-amber-800">Borderline / Elevated</span>
              <span className="font-bold text-slate-900 font-mono">140 – 180 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-2.5">
              <span className="font-semibold text-rose-800">High / Postprandial Hyperglycemia</span>
              <span className="font-bold text-slate-900 font-mono">&gt; 180 mg/dL</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-[11px] text-teal-800">
          <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Sweety automatically applies the correct clinical target based on whether a slot is fasting or post-meal.</span>
        </div>
      </div>
    </Modal>
  );
};
