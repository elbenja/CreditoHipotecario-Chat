import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MortgageField, Listing } from '@chat/shared';
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

const ASPIRIA: Listing = {
  proyecto: 'ASPIRIA', constructora: 'GRUPO T&C', direccion: 'Av. El Sol Este 530', distrito: 'Barranco',
  entrega: 'febrero 2027', etapa: undefined,
  modelos: [
    { nombre: 'TIPO 3', area: '82.96', precioDesde: '664,806', dormitorios: '3' },
    { nombre: 'TIPO 7', area: '41.75', precioDesde: '363,906', dormitorios: '1' },
  ],
  fuente: { host: 'nexoinmobiliario.pe' }, dudosos: [],
};

describe('ConfirmExtraction — anuncio', () => {
  it('names the project, district and developer', () => {
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('ASPIRIA · Barranco · GRUPO T&C · entrega febrero 2027');
  });

  it('lists the models and keeps the CTA disabled until one is chosen', async () => {
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveAccessibleName('TIPO 3 · 82.96 m² · desde S/ 664,806');
    expect(screen.getByRole('button', { name: /fijar/i })).toBeDisabled();
    expect(screen.getByLabelText('Precio')).toHaveValue('');
  });

  it('choosing a model fills price and area; editing after choosing sticks', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('radio')[1]!);
    expect(screen.getByLabelText('Precio')).toHaveValue('363,906');
    expect(screen.getByLabelText('Área')).toHaveValue('41.75');
    const precio = screen.getByLabelText('Precio');
    await userEvent.clear(precio);
    await userEvent.type(precio, '370,000');
    await userEvent.click(screen.getByRole('button', { name: /fijar/i }));
    const fields = onConfirm.mock.calls[0]![0] as { key: string; value: string; provenance: string }[];
    expect(fields.find((f) => f.key === 'precio')).toMatchObject({ value: '370,000', provenance: 'user' });
    expect(fields.find((f) => f.key === 'area')).toMatchObject({ value: '41.75', provenance: 'anuncio' });
    expect(fields.find((f) => f.key === 'ubicacion')).toMatchObject({ value: 'Av. El Sol Este 530, Barranco' });
  });

  it('with one model shows no list and starts filled', () => {
    const one: Listing = { ...ASPIRIA, modelos: [ASPIRIA.modelos[1]!] };
    render(<ConfirmExtraction variant="anuncio" listing={one} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByLabelText('Precio')).toHaveValue('363,906');
    expect(screen.getByRole('button', { name: /fijar/i })).toBeEnabled();
  });

  it('warns that a "desde" is the model floor', () => {
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent(/desde.*precio más bajo/i);
  });

  it('highlights a dudoso field first', () => {
    const one: Listing = { ...ASPIRIA, modelos: [ASPIRIA.modelos[1]!], dudosos: ['precioDesde'] };
    render(<ConfirmExtraction variant="anuncio" listing={one} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Precio')).toHaveAttribute('data-dudoso', 'true');
    expect(screen.getByLabelText('Área')).toHaveAttribute('data-dudoso', 'false');
  });

  it('drops the model-specific note when the precio is edited, but keeps area\'s', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmExtraction variant="anuncio" listing={ASPIRIA} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('radio')[1]!);
    const precio = screen.getByLabelText('Precio');
    await userEvent.clear(precio);
    await userEvent.type(precio, '370,000');
    await userEvent.click(screen.getByRole('button', { name: /fijar/i }));
    const fields = onConfirm.mock.calls[0]![0] as { key: string; value: string; provenance: string; note: string }[];
    expect(fields.find((f) => f.key === 'precio')).toMatchObject({ value: '370,000', provenance: 'user', note: '' });
    // Untouched: still exactly what the listing said.
    expect(fields.find((f) => f.key === 'area')).toMatchObject({ value: '41.75', provenance: 'anuncio' });
  });
});
