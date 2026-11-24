import React from 'react';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20">
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-4">
        {children}
      </main>
    </div>
  );
};
