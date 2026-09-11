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

// `scrollHeight` is inherited from Element.prototype, not an own property of
// HTMLTextAreaElement.prototype. vi.spyOn(..., 'get') on an inherited
// accessor copies it onto HTMLTextAreaElement.prototype as an own property,
// and vi.restoreAllMocks() then leaves that own copy in place instead of
// removing it — every read after that recurses. Define and remove the own
// property ourselves so nothing survives the test.
const mockScrollHeight = (value: number) => {
  const owned = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight');
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => value,
  });
  return () => {
    if (owned) {
      Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', owned);
    } else {
      delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
  };
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
    const restore = mockScrollHeight(44);
    const { box } = setup();
    expect(box.style.height).toBe('44px');
    restore();
  });

  it('stops growing at three lines and scrolls instead', () => {
    const restore = mockScrollHeight(300);
    const { box } = setup();
    expect(box.style.height).toBe('66px');
    restore();
  });

  // The empty screen renders one Composer per breakpoint; the hidden one
  // measures 0 and must not be written, or it stays collapsed when shown.
  it('leaves the height alone while it is not laid out', () => {
    const restore = mockScrollHeight(0);
    const { box } = setup();
    expect(box.style.height).toBe('auto');
    restore();
  });
});

describe('attaching a cronograma', () => {
  it('offers an attach control', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      onAttach={vi.fn()} />);
    expect(screen.getByLabelText(/adjuntar cronograma/i)).toBeInTheDocument();
  });

  it('hands the chosen file up', async () => {
    const onAttach = vi.fn();
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      onAttach={onAttach} />);
    const file = new File([new Uint8Array(1)], 'cronograma.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('attach-input'), file);
    expect(onAttach).toHaveBeenCalledWith(file);
  });

  it('says what happens to the document, since every schedule carries personal data', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      onAttach={vi.fn()} />);
    expect(screen.getByLabelText(/adjuntar cronograma/i))
      .toHaveAttribute('title', expect.stringMatching(/no se sube|primera página/i));
  });

  it('has no attach control when the screen does not pass one', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x" />);
    expect(screen.queryByLabelText(/adjuntar cronograma/i)).not.toBeInTheDocument();
  });
});

// The empty screen's Composer (variant="empty") is a different branch of the
// component with its own JSX, so the attach control needs its own coverage —
// it is otherwise unreachable before the first message is sent.
describe('attaching a cronograma — empty variant', () => {
  it('offers an attach control in the empty variant too', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      variant="empty" onAttach={vi.fn()} />);
    expect(screen.getByLabelText(/adjuntar cronograma/i)).toBeInTheDocument();
  });

  it('hands the chosen file up from the empty variant', async () => {
    const onAttach = vi.fn();
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x"
      variant="empty" onAttach={onAttach} />);
    const file = new File([new Uint8Array(1)], 'cronograma.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByTestId('attach-input'), file);
    expect(onAttach).toHaveBeenCalledWith(file);
  });

  it('has no attach control in the empty variant when the screen does not pass one', () => {
    render(<Composer value="" onChange={vi.fn()} onSubmit={vi.fn()} placeholder="x" variant="empty" />);
    expect(screen.queryByLabelText(/adjuntar cronograma/i)).not.toBeInTheDocument();
  });
});
