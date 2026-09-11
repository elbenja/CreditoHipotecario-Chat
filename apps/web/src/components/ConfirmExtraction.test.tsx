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

  it('pins a corrected digit as user-stated, leaving an untouched field as read from the document', async () => {
    const bothRead: MortgageField[] = [
      { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
      {
        key: 'montoFinanciado', label: 'Monto financiado', value: '280,000', prefix: 'S/',
        provenance: 'documento', note: '',
      },
    ];
    const onConfirm = vi.fn();
    render(<ConfirmExtraction fields={bothRead} onConfirm={onConfirm} onCancel={vi.fn()} />);
    const tea = screen.getByLabelText('TEA');
    await userEvent.clear(tea);
    await userEvent.type(tea, '9.10');
    await userEvent.click(screen.getByRole('button', { name: /fijar/i }));
    const confirmed: MortgageField[] = onConfirm.mock.calls[0]![0];
    // Corrected: no longer what the bank's document said.
    expect(confirmed.find((f) => f.key === 'tea')).toMatchObject({
      value: '9.10',
      provenance: 'user',
    });
    // Left alone: still exactly what was read.
    expect(confirmed.find((f) => f.key === 'montoFinanciado')).toMatchObject({
      value: '280,000',
      provenance: 'documento',
    });
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

  it('moves focus into the dialog on mount, onto the first field rather than the confirm button', () => {
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('TEA')).toHaveFocus();
  });

  it('traps Tab within the dialog, cycling from the last focusable element back to the first', async () => {
    const user = userEvent.setup();
    render(<ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const tea = screen.getByLabelText('TEA');
    const confirmButton = screen.getByRole('button', { name: /fijar/i });

    confirmButton.focus();
    await user.tab();
    expect(tea).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { unmount } = render(
      <ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(trigger).not.toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('locks body scroll while mounted and releases it on unmount', () => {
    const { unmount } = render(
      <ConfirmExtraction fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    unmount();
    expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
  });
});
