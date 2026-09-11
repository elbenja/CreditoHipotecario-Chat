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
