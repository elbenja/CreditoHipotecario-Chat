import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TopNav } from './TopNav';

describe('TopNav', () => {
  it('offers to start over once there is a conversation', () => {
    render(<TopNav context="Depa Pueblo Libre · sin guardar" onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Nueva consulta' })).toBeTruthy();
  });

  // Nothing to forget on the empty screen — the button would be a dead control.
  it('hides it when there is no conversation', () => {
    render(<TopNav onReset={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Nueva consulta' })).toBeNull();
  });

  it('resets on click', async () => {
    const onReset = vi.fn();
    render(<TopNav context="Depa Pueblo Libre · sin guardar" onReset={onReset} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nueva consulta' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('TopNav navigation', () => {
  it('collapses and expands the side nav', async () => {
    const onToggleNav = vi.fn();
    const { rerender } = render(<TopNav navExpanded onToggleNav={onToggleNav} />);
    await userEvent.click(screen.getByRole('button', { name: 'Colapsar navegación' }));
    expect(onToggleNav).toHaveBeenCalledTimes(1);
    rerender(<TopNav navExpanded={false} onToggleNav={onToggleNav} />);
    expect(screen.getByRole('button', { name: 'Expandir navegación' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the account menu and closes it with Escape', async () => {
    render(<TopNav />);
    await userEvent.click(screen.getByRole('button', { name: 'Tu cuenta' }));
    expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
