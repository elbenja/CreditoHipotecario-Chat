import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SideNav } from './SideNav';

describe('SideNav', () => {
  it('marks Dito as the current page', () => {
    render(<SideNav expanded />);
    expect(screen.getByRole('link', { name: 'Dito' }).getAttribute('aria-current')).toBe('page');
  });

  // Nothing to forget on the empty screen.
  it('disables "Nuevo" without a conversation', () => {
    render(<SideNav expanded />);
    expect((screen.getByRole('button', { name: 'Nuevo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts over from "Nuevo"', async () => {
    const onNew = vi.fn();
    render(<SideNav expanded onNew={onNew} />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
