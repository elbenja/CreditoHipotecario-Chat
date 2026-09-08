import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    const summary = screen.getByRole('button', { name: /Abrir datos de la operación/i });

    expect(summary.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '3 datos fijados 2 los asumí yo · 1 escenario guardado',
    );
  });

  it('opens from the summary, locks body scroll, and closes with Escape restoring focus', async () => {
    const user = userEvent.setup();
    renderSheet();
    const summary = screen.getByRole('button', { name: /Abrir datos de la operación/i });

    await user.click(summary);

    expect(screen.getByRole('dialog', { name: 'Datos de la operación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar datos de la operación' })).toHaveFocus();
    expect(summary).toHaveAttribute('tabindex', '-1');
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

    const dialog = screen.getByRole('dialog', { name: 'Datos de la operación' });
    expect(dialog).toBeInTheDocument();
    const grabber = screen.getByRole('button', { name: 'Cerrar datos de la operación' });
    expect(grabber).toHaveClass('mx-auto');
    fireEvent.touchStart(grabber, { touches: [{ clientY: 500 }] });
    fireEvent.touchEnd(grabber, { changedTouches: [{ clientY: 720 }] });
    expect(screen.queryByRole('dialog', { name: 'Datos de la operación' })).not.toBeInTheDocument();
  });

  it('traps Tab and Shift+Tab within the expanded sheet', async () => {
    const user = userEvent.setup();
    renderSheet();
    const summary = screen.getByRole('button', { name: /Abrir datos de la operación/i });
    await user.click(summary);

    const dialog = screen.getByRole('dialog', { name: 'Datos de la operación' });
    const grabber = screen.getByRole('button', { name: 'Cerrar datos de la operación' });
    const save = screen.getByRole('button', { name: 'Guardar como propiedad' });

    save.focus();
    await user.tab();
    expect(grabber).toHaveFocus();

    grabber.focus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes and restores body scroll when the viewport crosses to desktop', async () => {
    const user = userEvent.setup();
    let mediaChange: ((event: MediaQueryListEvent) => void) | null = null;
    const mediaList = {
      matches: false,
      media: '(min-width: 768px)',
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaChange = listener;
      },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => mediaList));

    try {
      renderSheet();
      await user.click(screen.getByRole('button', { name: /Abrir datos de la operación/i }));
      expect(screen.getByRole('dialog', { name: 'Datos de la operación' })).toBeInTheDocument();
      expect(mediaChange).toBeTypeOf('function');
      expect(document.body).toHaveStyle({ overflow: 'hidden' });

      Object.defineProperty(mediaList, 'matches', { configurable: true, value: true });
      const triggerChange = mediaChange as unknown as (event: MediaQueryListEvent) => void;
      triggerChange({ matches: true } as MediaQueryListEvent);

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Datos de la operación' })).not.toBeInTheDocument();
        expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
      });
    } finally {
      vi.unstubAllGlobals();
    }
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
