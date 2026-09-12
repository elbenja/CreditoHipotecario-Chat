import { useEffect, useReducer } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PinnedPanel } from './PinnedPanel';
import { chatReducer, initialState, type ChatState } from '../state/chatReducer';

describe('PinnedPanel', () => {
  it('shows the third legend state once something was read from a document', () => {
    render(<PinnedPanel fields={[]} mortgage={[{
      key: 'tea', label: 'TEA', value: '8.99', provenance: 'documento', note: '',
    }]} onEdit={vi.fn()} />);
    expect(screen.getByText(/lo leí del banco/i)).toBeInTheDocument();
  });

  it('hides that legend state when nothing came from a document', () => {
    render(<PinnedPanel fields={[]} onEdit={vi.fn()} />);
    expect(screen.queryByText(/lo leí del banco/i)).not.toBeInTheDocument();
  });

  // The property and the credit are two different things, and each gets its
  // own collapsible group — a flat list of nine rows reads as one blob.
  it('splits the rows into a Propiedad group and a Hipoteca group', () => {
    render(<PinnedPanel
      fields={[{ key: 'precio', label: 'Precio', value: '300000', provenance: 'user', note: '' }]}
      mortgage={[{ key: 'tea', label: 'TEA', value: '8.99', provenance: 'documento', note: '' }]}
      onEdit={vi.fn()}
    />);
    expect(screen.getByRole('button', { name: /^propiedad/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hipoteca/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Precio')).toBeInTheDocument();
    expect(screen.getByLabelText('TEA')).toBeInTheDocument();
  });

  it('counts the credit rows in the header too', () => {
    render(<PinnedPanel
      fields={[{ key: 'precio', label: 'Precio', value: '300000', provenance: 'user', note: '' }]}
      mortgage={[{ key: 'tea', label: 'TEA', value: '8.99', provenance: 'documento', note: '' }]}
      onEdit={vi.fn()}
    />);
    expect(screen.getByText('2 fijados')).toBeInTheDocument();
  });

  // Card 13: a row the last schedule changed says what it replaced.
  it('shows the value a schedule replaced, struck through, under the row', () => {
    render(<PinnedPanel
      fields={[]}
      mortgage={[{ key: 'tea', label: 'TEA', value: '6.80', suffix: '%', provenance: 'documento', note: '' }]}
      mortgageChanges={{ tea: '8.00' }}
      onEdit={vi.fn()}
    />);
    expect(screen.getByText('8.00 %')).toBeInTheDocument();
    expect(screen.getByText(/leído del PDF/)).toBeInTheDocument();
  });

  it('says nothing under a row that was simply new', () => {
    render(<PinnedPanel
      fields={[]}
      mortgage={[{ key: 'tea', label: 'TEA', value: '6.80', suffix: '%', provenance: 'documento', note: '' }]}
      mortgageChanges={{ tea: null }}
      onEdit={vi.fn()}
    />);
    expect(screen.queryByText(/leído del PDF/)).not.toBeInTheDocument();
  });

  it('omits a group that has nothing in it', () => {
    render(<PinnedPanel fields={[]} mortgage={[{ key: 'tea', label: 'TEA', value: '8.99', provenance: 'documento', note: '' }]} onEdit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^propiedad/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hipoteca/i })).toBeInTheDocument();
  });
});

// Regression coverage for the defect where mortgage rows shared the property
// rows' `onEdit`, which dispatches an action `editField` cannot match against
// a mortgage key: the reducer's no-op guard silently discarded every
// keystroke. These drive a real reducer through real inputs, not mocks.
describe('typing into a pinned row (regression: mortgage rows must not share onEdit)', () => {
  const seeded: ChatState = {
    ...initialState,
    fields: {
      precio: { key: 'precio', label: 'Precio', value: '300000', provenance: 'user', note: '' },
    },
    mortgage: {
      tea: { key: 'tea', label: 'TEA', value: '8.99', suffix: '%', provenance: 'documento', note: '' },
    },
  };

  function Harness({ onState }: { onState: (s: ChatState) => void }) {
    const [state, dispatch] = useReducer(chatReducer, seeded);
    useEffect(() => onState(state), [state, onState]);
    return (
      <PinnedPanel
        fields={Object.values(state.fields)}
        mortgage={Object.values(state.mortgage)}
        onEdit={(key, value) => dispatch({ type: 'editField', key, value })}
        onEditMortgage={(key, value) => dispatch({ type: 'editMortgageField', key, value })}
      />
    );
  }

  it('typing into a mortgage row updates state.mortgage and leaves state.fields untouched', async () => {
    let latest = seeded;
    render(<Harness onState={(s) => { latest = s; }} />);
    const input = screen.getByLabelText('TEA');
    await userEvent.clear(input);
    await userEvent.type(input, '9.5');
    expect(latest.mortgage.tea!.value).toBe('9.5');
    expect(latest.fields.precio!.value).toBe('300000');
  });

  it('typing into a property row updates state.fields and leaves state.mortgage untouched', async () => {
    let latest = seeded;
    render(<Harness onState={(s) => { latest = s; }} />);
    const input = screen.getByLabelText('Precio');
    await userEvent.clear(input);
    await userEvent.type(input, '350000');
    expect(latest.fields.precio!.value).toBe('350000');
    expect(latest.mortgage.tea!.value).toBe('8.99');
  });
});

describe('anuncio provenance', () => {
  const precio = { key: 'precio' as const, label: 'Precio', value: '363,906', prefix: 'S/', suffix: undefined, provenance: 'anuncio' as const, note: '' };

  it('shows the page legend only while a field carries anuncio', () => {
    const { rerender } = render(<PinnedPanel fields={[precio]} onEdit={vi.fn()} />);
    expect(screen.getByText('Lo leí de la página')).toBeInTheDocument();
    rerender(<PinnedPanel fields={[{ ...precio, provenance: 'user' }]} onEdit={vi.fn()} />);
    expect(screen.queryByText('Lo leí de la página')).toBeNull();
  });

  it('marks the row as read from the page, not assumed', () => {
    render(<PinnedPanel fields={[precio]} onEdit={vi.fn()} />);
    expect(screen.getByTitle('Lo leí de la página')).toBeInTheDocument();
    expect(screen.queryByTitle('Lo asumí yo')).toBeNull();
  });
});
