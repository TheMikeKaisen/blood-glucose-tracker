import React, { useState, useEffect, useCallback } from 'react';
import { DateBar } from '../components/readings/DateBar';
import { DailyProgress } from '../components/readings/DailyProgress';
import { ReadingSlotCard } from '../components/readings/ReadingSlotCard';
import { ReadingModal } from '../components/readings/ReadingModal';
import { DeleteConfirmModal } from '../components/readings/DeleteConfirmModal';
import { CHRONOLOGICAL_SLOTS } from '../utils/clinical';
import { getTodayDateString } from '../utils/date';
import type { TimeSlot, Reading } from '../types/reading';
import { api, ApiError } from '../services/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const ReadingsPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [targetSlot, setTargetSlot] = useState<TimeSlot | undefined>(undefined);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingReading, setDeletingReading] = useState<Reading | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchDailyReadings = useCallback(async (date: string) => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await api.readings.list({ date });
      setReadings(res.data || []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load readings.';
      setPageError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyReadings(selectedDate);
  }, [selectedDate, fetchDailyReadings]);

  // Handlers for Add, Edit, Delete
  const handleOpenAdd = (slot?: TimeSlot) => {
    setEditingReading(null);
    setTargetSlot(slot);
    setModalOpen(true);
  };

  const handleOpenEdit = (reading: Reading) => {
    setEditingReading(reading);
    setTargetSlot(reading.slot);
    setModalOpen(true);
  };

  const handleOpenDelete = (reading: Reading) => {
    setDeletingReading(reading);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingReading) return;
    setDeleteLoading(true);
    try {
      await api.readings.delete(deletingReading.id);
      setDeleteModalOpen(false);
      setDeletingReading(null);
      await fetchDailyReadings(selectedDate);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to delete reading.';
      setPageError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleModalSubmit = async (data: { date: string; slot: TimeSlot; value: number }) => {
    if (editingReading) {
      await api.readings.update(editingReading.id, data);
    } else {
      await api.readings.create(data);
    }
    // Refresh date if changed or refetch current date
    if (data.date !== selectedDate) {
      setSelectedDate(data.date);
    } else {
      await fetchDailyReadings(selectedDate);
    }
  };

  const readingMap = new Map<TimeSlot, Reading>();
  readings.forEach((r) => readingMap.set(r.slot, r));

  return (
    <div className="space-y-4">
      {/* Date Navigator */}
      <DateBar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {pageError && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pageError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDailyReadings(selectedDate)}
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-800"
            title="Retry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Circadian Overview Milestone Progress */}
      {loading ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-slate-200/90 shadow-xs">
          <div className="inline-block w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-500 font-medium">Loading readings for {selectedDate}...</p>
        </div>
      ) : (
        <DailyProgress
          readings={readings}
          onSlotClick={(slot) => {
            const existing = readingMap.get(slot);
            if (existing) {
              handleOpenEdit(existing);
            } else {
              handleOpenAdd(slot);
            }
          }}
        />
      )}

      {/* 4 Circadian Meal Slot Cards */}
      <div className="space-y-3">
        {CHRONOLOGICAL_SLOTS.map((slot) => {
          const reading = readingMap.get(slot);
          return (
            <ReadingSlotCard
              key={slot}
              slot={slot}
              reading={reading}
              onAdd={handleOpenAdd}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          );
        })}
      </div>

      {/* Modal for Add / Edit */}
      <ReadingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialSlot={targetSlot}
        initialDate={selectedDate}
        existingReading={editingReading}
        existingReadingsForDate={readings}
      />

      {/* Modal for Delete Confirmation */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingReading(null);
        }}
        onConfirm={handleConfirmDelete}
        reading={deletingReading}
        loading={deleteLoading}
      />
    </div>
  );
};
