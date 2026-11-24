import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReadingModal } from '../components/readings/ReadingModal';
import type { Reading } from '../types/reading';

describe('ReadingModal – Form Validation & ADA Target Evaluation', () => {
  const dummyReadings: Reading[] = [
    {
      id: '1',
      userId: '1',
      date: '2026-10-15',
      slot: 'morning_fasting',
      value: 95,
      createdAt: '2026-10-15T07:00:00Z',
      updatedAt: '2026-10-15T07:00:00Z',
    },
  ];

  it('renders modal with required form fields and accessible labels', () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="after_breakfast"
        existingReadingsForDate={dummyReadings}
      />
    );

    expect(screen.getByText('Record Blood Glucose')).toBeInTheDocument();
    expect(screen.getByLabelText(/Circadian Meal Slot/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Blood Glucose (mg/dL)')).toBeInTheDocument();
  });

  it('validates empty glucose value with exact error message', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="after_breakfast"
        existingReadingsForDate={dummyReadings}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter a glucose value.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates out-of-range glucose values (<40 or >600) with exact error message', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="after_breakfast"
        existingReadingsForDate={dummyReadings}
      />
    );

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });

    // Test value < 40
    fireEvent.change(valueInput, { target: { value: '35' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Value must be between 40 and 600 mg/dl.')).toBeInTheDocument();

    // Test value > 600
    fireEvent.change(valueInput, { target: { value: '650' } });
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Value must be between 40 and 600 mg/dl.')).toBeInTheDocument();

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates future date with exact error message', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2099-01-01"
        initialSlot="after_breakfast"
        existingReadingsForDate={dummyReadings}
      />
    );

    const dateInput = screen.getByLabelText('Date');
    fireEvent.change(dateInput, { target: { value: '2099-01-01' } });

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '120' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Date cannot be in the future.')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates duplicate slot on the same day with exact error message', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting" // morning_fasting is in dummyReadings
        existingReadingsForDate={dummyReadings}
      />
    );

    const slotSelect = screen.getByLabelText(/Circadian Meal Slot/i);
    fireEvent.change(slotSelect, { target: { value: 'morning_fasting' } });

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '110' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('You already have an Morning (fasting) reading for this date.')
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('validates maximum 4 readings per day limit with exact error message', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    const fourReadings: Reading[] = [
      { id: '1', userId: '1', date: '2026-10-15', slot: 'morning_fasting', value: 95, createdAt: '', updatedAt: '' },
      { id: '2', userId: '1', date: '2026-10-15', slot: 'after_breakfast', value: 130, createdAt: '', updatedAt: '' },
      { id: '3', userId: '1', date: '2026-10-15', slot: 'after_lunch', value: 140, createdAt: '', updatedAt: '' },
      { id: '4', userId: '1', date: '2026-10-15', slot: 'after_dinner', value: 160, createdAt: '', updatedAt: '' },
    ];

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="after_lunch"
        existingReadingsForDate={fourReadings}
      />
    );

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '120' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('You can add only 4 readings per day.')
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('rejects decimal / non-integer values with exact error message', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting"
        existingReadingsForDate={[]}
      />
    );

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });

    fireEvent.change(valueInput, { target: { value: '105.5' } });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Value must be between 40 and 600 mg/dl.')
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('handles and trims leading/trailing whitespaces in glucose value', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting"
        existingReadingsForDate={[]}
      />
    );

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '   125   ' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        date: '2026-10-15',
        slot: 'morning_fasting',
        value: 125,
      });
    });
  });

  it('validates invalid calendar date (e.g. Feb 29 in non-leap year)', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting"
        existingReadingsForDate={[]}
      />
    );

    const dateInput = screen.getByLabelText('Date');
    fireEvent.change(dateInput, { target: { value: '2025-02-29' } });

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '100' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Please provide a valid date in YYYY-MM-DD format.')
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('allows valid leap year date (2024-02-29)', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting"
        existingReadingsForDate={[]}
      />
    );

    const dateInput = screen.getByLabelText('Date');
    fireEvent.change(dateInput, { target: { value: '2024-02-29' } });

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '110' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        date: '2024-02-29',
        slot: 'morning_fasting',
        value: 110,
      });
    });
  });

  it('allows submitting reading when switching from full day to another date in modal', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    const fullDayReadings: Reading[] = [
      { id: '1', userId: '1', date: '2026-10-15', slot: 'morning_fasting', value: 95, createdAt: '', updatedAt: '' },
      { id: '2', userId: '1', date: '2026-10-15', slot: 'after_breakfast', value: 130, createdAt: '', updatedAt: '' },
      { id: '3', userId: '1', date: '2026-10-15', slot: 'after_lunch', value: 140, createdAt: '', updatedAt: '' },
      { id: '4', userId: '1', date: '2026-10-15', slot: 'after_dinner', value: 160, createdAt: '', updatedAt: '' },
    ];

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting"
        existingReadingsForDate={fullDayReadings}
      />
    );

    // Switch date to yesterday where user wants to log
    const dateInput = screen.getByLabelText('Date');
    fireEvent.change(dateInput, { target: { value: '2026-10-14' } });

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '118' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        date: '2026-10-14',
        slot: 'morning_fasting',
        value: 118,
      });
    });
  });

  it('displays real-time ADA clinical target preview badge as user types', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="morning_fasting"
        existingReadingsForDate={[]}
      />
    );

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');

    // Normal fasting: 70–99
    fireEvent.change(valueInput, { target: { value: '88' } });
    expect(await screen.findByText('In Target')).toBeInTheDocument();

    // Borderline fasting: 100–125
    fireEvent.change(valueInput, { target: { value: '115' } });
    expect(await screen.findByText('Borderline')).toBeInTheDocument();

    // High fasting: >= 126
    fireEvent.change(valueInput, { target: { value: '145' } });
    expect(await screen.findByText('High')).toBeInTheDocument();

    // Low: < 70
    fireEvent.change(valueInput, { target: { value: '62' } });
    expect(await screen.findByText('Low')).toBeInTheDocument();
  });

  it('calls onSubmit with parsed integer value on valid submission', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ReadingModal
        isOpen={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialDate="2026-10-15"
        initialSlot="after_lunch"
        existingReadingsForDate={[]}
      />
    );

    const valueInput = screen.getByLabelText('Blood Glucose (mg/dL)');
    fireEvent.change(valueInput, { target: { value: '135' } });

    const submitBtn = screen.getByRole('button', { name: /Record Reading/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        date: '2026-10-15',
        slot: 'after_lunch',
        value: 135,
      });
    });
  });
});
