import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api.js', () => ({
  api: { getHold: vi.fn(), getClass: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
}));
import { api } from '../api.js';
import Application from '../screens/Application.jsx';

const SID = '20152691234567890';
const inFuture = (ms) => new Date(Date.now() + ms).toISOString();
const holdOf = (over = {}) => ({ holdId: 'h_1', classId: 'c1', studentId: SID, status: 'HELD', expiresAt: inFuture(120000), ...over });

beforeEach(() => {
  vi.resetAllMocks();
  api.getClass.mockResolvedValue({ id: 'c1', name: 'Class 6 - Morning Shift' });
});

const renderApp = (studentId = SID) => render(<Application holdId="h_1" studentId={studentId} onBack={vi.fn()} />);
const payButton = () => screen.getByRole('button', { name: 'ভর্তি ফি দিন' });

describe('Application screen', () => {
  it('shows HELD with a countdown and enabled buttons', async () => {
    api.getHold.mockResolvedValue(holdOf());
    renderApp();

    expect(await screen.findByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent('HELD');
    expect(screen.getByTestId('countdown')).toHaveTextContent(/[12]:\d\d/);
    expect(payButton()).toBeEnabled();
  });

  it('confirms the admission when the fee button is pressed', async () => {
    let confirmed = false;
    api.getHold.mockImplementation(async () => holdOf({ status: confirmed ? 'CONFIRMED' : 'HELD' }));
    api.confirm.mockImplementation(async () => { confirmed = true; return { status: 'CONFIRMED' }; });
    renderApp();

    await screen.findByText('Class 6 - Morning Shift');
    await userEvent.click(payButton());

    expect(api.confirm).toHaveBeenCalledWith('h_1', SID);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('CONFIRMED'));
    expect(payButton()).toBeDisabled();
  });

  it('shows EXPIRED and disables payment when the time is already over', async () => {
    api.getHold.mockResolvedValue(holdOf({ expiresAt: inFuture(-5000) }));
    renderApp();

    await screen.findByText('Class 6 - Morning Shift');
    expect(screen.getByTestId('status')).toHaveTextContent('EXPIRED');
    expect(payButton()).toBeDisabled();
  });

  it('switches to EXPIRED by itself when the countdown ends (no reload)', async () => {
    api.getHold.mockResolvedValue(holdOf({ expiresAt: inFuture(1500) }));
    renderApp();

    await screen.findByText('Class 6 - Morning Shift');
    expect(screen.getByTestId('status')).toHaveTextContent('HELD');
    expect(payButton()).toBeEnabled();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('EXPIRED'), { timeout: 5000 });
    expect(payButton()).toBeDisabled();
  }, 10000);

  it('shows the server message if confirming fails', async () => {
    api.getHold.mockResolvedValue(holdOf());
    api.confirm.mockRejectedValue(new Error('আবেদনের মেয়াদ শেষ হয়ে গেছে। আবার আবেদন করুন।'));
    renderApp();

    await screen.findByText('Class 6 - Morning Shift');
    await userEvent.click(payButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('মেয়াদ শেষ হয়ে গেছে');
  });

  it('cancels after the user confirms the prompt', async () => {
    api.getHold.mockResolvedValue(holdOf());
    api.cancel.mockResolvedValue(null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp();

    await screen.findByText('Class 6 - Morning Shift');
    await userEvent.click(screen.getByRole('button', { name: 'বাতিল' }));

    expect(api.cancel).toHaveBeenCalledWith('h_1', SID);
  });

  it("does not let another student act on someone else's application", async () => {
    api.getHold.mockResolvedValue(holdOf());
    renderApp('20152691234567891');

    await screen.findByText('Class 6 - Morning Shift');
    expect(screen.getByText(/অন্য শিক্ষার্থীর/)).toBeInTheDocument();
    expect(payButton()).toBeDisabled();
  });
});
