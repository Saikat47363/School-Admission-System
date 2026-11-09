import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../api.js', () => ({
  api: {
    listClasses: vi.fn(), myHolds: vi.fn(), createClass: vi.fn(),
    apply: vi.fn(), getHold: vi.fn(), getClass: vi.fn(), confirm: vi.fn(), cancel: vi.fn(),
  },
}));
import { api } from '../api.js';
import App from '../App.jsx';

beforeEach(() => {
  vi.resetAllMocks();
  api.listClasses.mockResolvedValue([]);
  api.myHolds.mockResolvedValue([]);
});

describe('App', () => {
  it('accepts digits only, max 17, and shows progress', async () => {
    render(<App />);
    const input = screen.getByTestId('student-id');

    await userEvent.type(input, 'ab12-3');
    expect(input).toHaveValue('123');
    expect(screen.getByText(/3\/১৭/)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '201526912345678901234');
    expect(input).toHaveValue('20152691234567890');
    expect(screen.getByText('নম্বর ঠিক আছে।')).toBeInTheDocument();
  });

  it('remembers the student id after a refresh', async () => {
    localStorage.setItem('studentId', '20152691234567890');
    render(<App />);
    expect(screen.getByTestId('student-id')).toHaveValue('20152691234567890');
  });

  it('switches between screens with the tabs', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Class তালিকা' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'আমার আবেদন' }));
    expect(screen.getByRole('heading', { name: 'আমার আবেদন' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Class তৈরি (Admin)' }));
    expect(screen.getByRole('heading', { name: 'নতুন Class তৈরি' })).toBeInTheDocument();
  });

  it('validates the create-class form, then sends it', async () => {
    api.createClass.mockResolvedValue({ id: 'c1', name: 'Class 6 - Morning Shift', totalSeats: 120 });
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Class তৈরি (Admin)' }));

    await userEvent.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(screen.getByRole('alert')).toHaveTextContent('নাম লিখুন');
    expect(api.createClass).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Class-এর নাম'), 'Class 6 - Morning Shift');
    await userEvent.type(screen.getByLabelText('মোট Seat'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Seat সংখ্যা');

    await userEvent.clear(screen.getByLabelText('মোট Seat'));
    await userEvent.type(screen.getByLabelText('মোট Seat'), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Class তৈরি করুন' }));
    expect(api.createClass).toHaveBeenCalledWith('Class 6 - Morning Shift', 120);
    expect(await screen.findByText(/তৈরি হয়েছে/)).toBeInTheDocument();
  });
});
