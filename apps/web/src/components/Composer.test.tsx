import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

const setup = (props: Partial<Parameters<typeof Composer>[0]> = {}) => {
  const onSubmit = vi.fn();
  render(
    <Composer
      value="hola"
      onChange={vi.fn()}
      onSubmit={onSubmit}
      placeholder="Pregunta lo que quieras…"
      {...props}
    />,
  );
  return { onSubmit, box: screen.getByPlaceholderText('Pregunta lo que quieras…') };
};

describe('Composer', () => {
  it('sends on Enter', async () => {
    const { onSubmit, box } = setup();
    await userEvent.type(box, '{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Without this the box can hold three lines it has no way to produce.
  it('breaks the line on Shift+Enter instead of sending', async () => {
    const { onSubmit, box } = setup();
    await userEvent.type(box, '{Shift>}{Enter}{/Shift}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('grows to fit the content', () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(44);
    const { box } = setup();
    expect(box.style.height).toBe('44px');
    vi.restoreAllMocks();
  });

  it('stops growing at three lines and scrolls instead', () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(300);
    const { box } = setup();
    expect(box.style.height).toBe('66px');
    vi.restoreAllMocks();
  });

  // The empty screen renders one Composer per breakpoint; the hidden one
  // measures 0 and must not be written, or it stays collapsed when shown.
  it('leaves the height alone while it is not laid out', () => {
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockReturnValue(0);
    const { box } = setup();
    expect(box.style.height).toBe('auto');
    vi.restoreAllMocks();
  });
});
