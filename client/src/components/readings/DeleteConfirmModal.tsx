import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Reading } from '../../types/reading';
import { SLOT_CONFIG } from '../../utils/clinical';
import { formatFullDate } from '../../utils/date';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  reading: Reading | null;
  loading: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  reading,
  loading,
}) => {
  if (!reading) return null;

  const slotLabel = SLOT_CONFIG[reading.slot]?.label || reading.slot;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Glucose Reading"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Are you sure you want to delete the{' '}
          <strong className="text-slate-900">{slotLabel}</strong> reading of{' '}
          <strong className="text-slate-900">{reading.value} mg/dL</strong> logged on{' '}
          <strong className="text-slate-900">{formatFullDate(reading.date)}</strong>?
        </p>

        <p className="text-xs text-rose-600 font-medium">
          This action cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={loading}
          >
            Delete Reading
          </Button>
        </div>
      </div>
    </Modal>
  );
};
