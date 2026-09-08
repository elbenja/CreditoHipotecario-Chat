import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PinnedField, Scenario } from '@chat/shared';
import { describe, expect, it, vi } from 'vitest';
import { MobileBottomSheet } from './MobileBottomSheet';

const fields: PinnedField[] = [
  {
    key: 'precio',
    label: 'Precio',
    value: 'S/ 300,000',
    prefix: 'S/',
    suffix: undefined,
    provenance: 'user',
    note: '',
  },
  {
    key: 'area',
    label: 'Área',
    value: '80',
    prefix: undefined,
    suffix: 'm²',
    provenance: 'assumed',
    note: '',
  },
  {
    key: 'tasa',
    label: 'Tasa',
    value: '8.5',
    prefix: undefined,
    suffix: '%',
    provenance: 'market',
    note: '',
  },
];

const scenarios: Scenario[] = [
  {
    id: 'lower-rate',
    cause: 'Tasa menor',
    value: 'S/ 2,400',
    unit: 'S/ al mes',
    tone: 'good',
    note: '',
  },
];

function renderSheet(overrides: Partial<React.ComponentProps<typeof MobileBottomSheet>> = {}) {
  return render(
    <MobileBottomSheet
      fields={fields}
      savedScenarios={scenarios}
      dirtyKeys={['precio']}
      onEdit={vi.fn()}
      onRecalculate={vi.fn()}
      {...overrides}
    />,
  );
}

describe('MobileBottomSheet', () => {
  it('shows dynamic fixed, assumed, and saved summary counts', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: /Abrir datos de la operación/i })).toHaveTextContent(
      '3 fijados',
    );
    expect(screen.getByRole('button', { name: /Abrir datos de la operación/i })).toHaveTextContent(
      '2 asumidos',
    );
    expect(screen.getByRole('button', { name: /Abrir datos de la operación/i })).toHaveTextContent(
      '1 escenario guardado',
    );
  });

  it('opens from the summary, locks body scroll, and closes with Escape restoring focus', async () => {
    const user = userEvent.setup();
    renderSheet();
    const summary = screen.getByRole('button', { name: /Abrir datos de la operación/i });

    await user.click(summary);

    expect(screen.getByRole('dialog', { name: 'Datos de la operación' })).toBeInTheDocument();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Datos de la operación' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
    expect(screen.getByRole('button', { name: /Abrir datos de la operación/i })).toHaveFocus();
  });

  it('opens when the collapsed sheet is swiped upward', () => {
    renderSheet();
    const summary = screen.getByRole('button', { name: /Abrir datos de la operación/i });

    fireEvent.touchStart(summary, { touches: [{ clientY: 720 }] });
    fireEvent.touchEnd(summary, { changedTouches: [{ clientY: 500 }] });

    expect(screen.getByRole('dialog', { name: 'Datos de la operación' })).toBeInTheDocument();
  });

  it('forwards shared field edit and recalculate callbacks from the expanded panel', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRecalculate = vi.fn();
    renderSheet({ onEdit, onRecalculate });
    await user.click(screen.getByRole('button', { name: /Abrir datos de la operación/i }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Precio' }), {
      target: { value: 'S/ 320,000' },
    });
    expect(onEdit).toHaveBeenCalled();
    expect(onEdit).toHaveBeenLastCalledWith('precio', 'S/ 320,000');

    await user.click(screen.getByRole('button', { name: 'Recalcular' }));
    expect(onRecalculate).toHaveBeenCalledTimes(1);
  });
});
