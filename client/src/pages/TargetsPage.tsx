import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { ShieldCheck, Info, User, LogOut, CheckCircle2, Sun, Utensils } from 'lucide-react';

export const TargetsPage: React.FC = () => {
  const { user, logout, logoutAll } = useAuth();
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);
    try {
      await logoutAll();
    } catch {
      setNotice('Logged out from all devices.');
    } finally {
      setLogoutAllLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Patient Profile Card */}
      {user && (
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                {user.name}
              </h2>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              icon={<LogOut className="w-3.5 h-3.5" />}
            >
              Sign Out
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogoutAll}
              loading={logoutAllLoading}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              Revoke All Devices
            </Button>
          </div>
          {notice && (
            <p className="mt-2 text-xs text-teal-700 font-medium">{notice}</p>
          )}
        </div>
      )}

      {/* Clinical Target Guidelines Card */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-700" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Clinical Target Guidelines (ADA)
            </h2>
            <p className="text-xs text-slate-500">
              American Diabetes Association standard glycemic target thresholds
            </p>
          </div>
        </div>

        {/* Hypoglycemia Banner */}
        <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl text-xs text-blue-900">
          <div className="font-bold mb-1 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Low / Hypoglycemia (&lt; 70 mg/dL)</span>
          </div>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            A reading under 70 mg/dL requires prompt attention. Follow the 15-15 rule (consume 15g of fast-acting carbs and recheck in 15 minutes) or follow your endocrinologist's emergency protocol.
          </p>
        </div>

        {/* Fasting Guideline Block */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Morning Fasting Blood Glucose</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="font-bold text-emerald-800 block">In Target / Optimal</span>
                <span className="text-[11px] text-slate-500">Standard non-diabetic reference</span>
              </div>
              <span className="font-bold text-slate-900 font-mono text-sm">70 – 99 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="font-bold text-amber-800 block">Borderline / Elevated</span>
                <span className="text-[11px] text-slate-500">Impaired fasting glucose</span>
              </div>
              <span className="font-bold text-slate-900 font-mono text-sm">100 – 125 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="font-bold text-rose-800 block">High / Hyperglycemia</span>
                <span className="text-[11px] text-slate-500">Clinical threshold</span>
              </div>
              <span className="font-bold text-slate-900 font-mono text-sm">≥ 126 mg/dL</span>
            </div>
          </div>
        </div>

        {/* Post-Meal Guideline Block */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-teal-600" />
            <span>Post-Meal Blood Glucose (After Breakfast, Lunch, Dinner)</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="font-bold text-emerald-800 block">In Target / Optimal</span>
                <span className="text-[11px] text-slate-500">Postprandial glycemic target</span>
              </div>
              <span className="font-bold text-slate-900 font-mono text-sm">&lt; 140 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="font-bold text-amber-800 block">Borderline / Elevated</span>
                <span className="text-[11px] text-slate-500">Mild post-meal excursion</span>
              </div>
              <span className="font-bold text-slate-900 font-mono text-sm">140 – 180 mg/dL</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="font-bold text-rose-800 block">High / Hyperglycemia</span>
                <span className="text-[11px] text-slate-500">Exceeds ADA postprandial goal</span>
              </div>
              <span className="font-bold text-slate-900 font-mono text-sm">&gt; 180 mg/dL</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>All readings are automatically categorized by Sweety using these exact criteria.</span>
        </div>
      </div>
    </div>
  );
};
