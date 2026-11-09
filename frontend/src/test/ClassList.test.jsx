import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api.js', () => ({
  api: { listClasses: vi.fn(), myHolds: vi.fn(), apply: vi.fn() },
}));
import { api } from '../api.js';
import ClassList from '../screens/ClassList.jsx';

const SID = '20152691234567890';
const classes = [
  { id: 'c1', name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 15, confirmedSeats: 80, availableSeats: 25 },
  { id: 'c2', name: 'Class 7 - Full', totalSeats: 10, heldSeats: 5, confirmedSeats: 5, availableSeats: 0 },
];

beforeEach(() => {
  vi.resetAllMocks();
  api.listClasses.mockResolvedValue(classes);
  api.myHolds.mockResolvedValue([]);
});

const rowOf = async (name) => within((await screen.findByText(name)).closest('tr'));

describe('ClassList', () => {
  it('shows seat numbers and disables apply when a class is full', async () => {
    render(<ClassList studentId={SID} onOpenHold={vi.fn()} />);

    const open = await rowOf('Class 6 - Morning Shift');
    expect(open.getByText('25')).toBeInTheDocument();
    expect(open.getByRole('button', { name: 'আবেদন করুন' })).toBeEnabled();

    const full = await rowOf('Class 7 - Full');
    expect(full.getByRole('button', { name: 'Seat নেই' })).toBeDisabled();
  });

  it('disables applying until a valid student id is entered', async () => {
    render(<ClassList studentId="" onOpenHold={vi.fn()} />);
    const row = await rowOf('Class 6 - Morning Shift');
    expect(row.getByRole('button', { name: 'আবেদন করুন' })).toBeDisabled();
    expect(screen.getByText(/১৭ অঙ্কের জন্ম নিবন্ধন নম্বর দিন/)).toBeInTheDocument();
  });

  it('applies for a seat and opens the new application', async () => {
    api.apply.mockResolvedValue({ holdId: 'h_1' });
    const onOpenHold = vi.fn();
    render(<ClassList studentId={SID} onOpenHold={onOpenHold} />);

    const row = await rowOf('Class 6 - Morning Shift');
    await userEvent.click(row.getByRole('button', { name: 'আবেদন করুন' }));

    expect(api.apply).toHaveBeenCalledWith('c1', SID);
    expect(onOpenHold).toHaveBeenCalledWith('h_1');
  });

  it('shows a readable error when applying fails', async () => {
    api.apply.mockRejectedValue(new Error('দুঃখিত, এই class-এ আর কোনো seat খালি নেই।'));
    render(<ClassList studentId={SID} onOpenHold={vi.fn()} />);

    const row = await rowOf('Class 6 - Morning Shift');
    await userEvent.click(row.getByRole('button', { name: 'আবেদন করুন' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('seat খালি নেই');
  });

  it('offers to view an existing application instead of applying twice', async () => {
    api.myHolds.mockResolvedValue([{ holdId: 'h_9', classId: 'c1', className: 'x', status: 'HELD', expiresAt: new Date(Date.now() + 60000).toISOString() }]);
    render(<ClassList studentId={SID} onOpenHold={vi.fn()} />);

    const row = await rowOf('Class 6 - Morning Shift');
    expect(await row.findByRole('button', { name: 'আপনার আবেদন দেখুন' })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'আবেদন করুন' })).toBeNull();
  });

  it('keeps showing data and a notice when the server stops answering', async () => {
    api.listClasses.mockResolvedValueOnce(classes).mockRejectedValue(new Error('সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না।'));
    const { rerender } = render(<ClassList studentId={SID} onOpenHold={vi.fn()} />);
    await rowOf('Class 6 - Morning Shift');
    // a new student id restarts polling; the failing call must not blank the page
    rerender(<ClassList studentId="20152691234567891" onOpenHold={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('যোগাযোগ করা যাচ্ছে না');
  });
});
