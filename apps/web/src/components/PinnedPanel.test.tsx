import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PinnedPanel } from './PinnedPanel';

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
