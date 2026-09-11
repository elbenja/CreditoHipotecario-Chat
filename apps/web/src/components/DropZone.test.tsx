import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DropZone } from './DropZone';

// jsdom has no DataTransfer; a plain object with the fields the zone reads is
// what fireEvent attaches to the event.
const transfer = (files: File[], types = ['Files']) => ({
  items: files.map((f) => ({ kind: 'file', type: f.type })),
  files,
  types,
  dropEffect: 'none',
});

const pdf = () => new File([new Uint8Array(1)], 'cronograma.pdf', { type: 'application/pdf' });
const docx = () =>
  new File([new Uint8Array(1)], 'cronograma.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

const setup = (props: Partial<Parameters<typeof DropZone>[0]> = {}) => {
  const onDrop = vi.fn();
  render(
    <DropZone onDrop={onDrop} {...props}>
      <p>el chat</p>
    </DropZone>,
  );
  return { onDrop, zone: screen.getByText('el chat').parentElement!.parentElement! };
};

describe('DropZone', () => {
  it('shows nothing until a file is dragged in', () => {
    setup();
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument();
  });

  it('says what it accepts as soon as a PDF is dragged over', () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([pdf()]) });
    expect(screen.getByText('Suelta tu cronograma aquí')).toBeInTheDocument();
    expect(screen.getByText('PDF del banco · hasta 20 MB')).toBeInTheDocument();
    expect(screen.getByTestId('drop-overlay')).toHaveAttribute('data-variant', 'ok');
  });

  it('hands a dropped PDF up and clears the overlay', () => {
    const { zone, onDrop } = setup();
    const file = pdf();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([file]) });
    fireEvent.drop(zone, { dataTransfer: transfer([file]) });
    expect(onDrop).toHaveBeenCalledWith(file);
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument();
  });

  it('ignores a text drag — that is not a file', () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([], ['text/plain']) });
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument();
  });

  it('goes amber and names the extension while an unsupported file hovers', () => {
    const { zone } = setup();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([docx()]) });
    expect(screen.getByText('No puedo leer .docx todavía')).toBeInTheDocument();
    expect(screen.getByText('Exporta el cronograma como PDF y suéltalo de nuevo')).toBeInTheDocument();
    expect(screen.getByTestId('drop-overlay')).toHaveAttribute('data-variant', 'bad');
  });

  it('never hands an unsupported file up, even when dropped', () => {
    const { zone, onDrop } = setup();
    const file = docx();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([file]) });
    fireEvent.drop(zone, { dataTransfer: transfer([file]) });
    expect(onDrop).not.toHaveBeenCalled();
    // The reason stays on screen for a moment rather than vanishing with the drop.
    expect(screen.getByText('No puedo leer .docx todavía')).toBeInTheDocument();
  });

  it('ignores a drop while a read is already in flight', () => {
    const { zone, onDrop } = setup({ disabled: true });
    const file = pdf();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([file]) });
    fireEvent.drop(zone, { dataTransfer: transfer([file]) });
    expect(onDrop).not.toHaveBeenCalled();
  });

  // dragenter/dragleave fire once per child element crossed; the overlay
  // must not flicker off when the cursor moves from one child to another.
  it('keeps the overlay while the cursor crosses child elements', () => {
    const { zone } = setup();
    const dt = transfer([pdf()]);
    fireEvent.dragEnter(zone, { dataTransfer: dt });
    fireEvent.dragEnter(screen.getByText('el chat'), { dataTransfer: dt });
    fireEvent.dragLeave(zone, { dataTransfer: dt });
    expect(screen.getByTestId('drop-overlay')).toBeInTheDocument();
    fireEvent.dragLeave(screen.getByText('el chat'), { dataTransfer: dt });
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument();
  });
});

describe('DropZone rejection timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes the amber overlay down on its own after a bad drop', () => {
    const { zone } = setup();
    const file = docx();
    fireEvent.dragEnter(zone, { dataTransfer: transfer([file]) });
    fireEvent.drop(zone, { dataTransfer: transfer([file]) });
    expect(screen.getByTestId('drop-overlay')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument();
  });
});
