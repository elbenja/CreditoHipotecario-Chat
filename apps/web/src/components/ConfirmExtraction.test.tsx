import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MortgageField } from '@chat/shared';
import { ConfirmExtraction } from './ConfirmExtraction';

const FIELDS: MortgageField[] = [
  { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
  { key: 'tcea', label: 'TCEA', value: '10.55', suffix: '%', provenance: 'assumed', note: '' },
];

describe('ConfirmExtraction', () => {
  it('warns that a confident-looking digit can still be wrong', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent(/puede leer mal/i);
  });

  it('marks the uncertain fields so they get looked at first', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('TCEA')).toHaveAttribute('data-dudoso', 'true');
    expect(screen.getByLabelText('TEA')).toHaveAttribute('data-dudoso', 'false');
  });

  it('confirms with the edited values, not the read ones', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const tea = screen.getByLabelText('TEA');
    await userEvent.clear(tea);
    await userEvent.type(tea, '9.10');
    await userEvent.click(screen.getByRole('button', { name: /fijar/i }));
    expect(onConfirm.mock.calls[0]![0][0].value).toBe('9.10');
  });

  it('cancels without confirming', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onCancel = vi.fn();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('is a modal dialog', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
