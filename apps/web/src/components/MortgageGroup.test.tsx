import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MortgageField } from '@chat/shared';
import { MORTGAGE_KEYS } from '@chat/shared';
import { MortgageGroup } from './MortgageGroup';

const make = (n: number): MortgageField[] =>
  Array.from({ length: n }, (_, i) => ({
    key: MORTGAGE_KEYS[i]!, label: `Campo ${i}`, value: String(i),
    provenance: 'documento' as const, note: '',
  }));

describe('MortgageGroup', () => {
  it('renders nothing when there is no mortgage', () => {
    const { container } = render(<MortgageGroup fields={[]} onEdit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts open at four fields or fewer', () => {
    render(<MortgageGroup fields={make(4)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('starts collapsed past four, so it does not bury the property', () => {
    render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles', async () => {
    render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /tu hipoteca/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the count while collapsed', () => {
    render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveTextContent('5');
  });

  // PinnedPanel mounts this group unconditionally, before an upload's fields
  // arrive — so the initializer alone (`useState(fields.length <= 4)`) sees
  // zero fields, opens, and then never re-evaluates once nine land. Only a
  // reload (a fresh mount with the fields already present) got this right.
  it('collapses once fields arrive after mounting with none, not only after a reload', () => {
    const { rerender } = render(<MortgageGroup fields={[]} onEdit={vi.fn()} />);
    rerender(<MortgageGroup fields={make(9)} onEdit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tu hipoteca/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the user’s own choice even as more fields arrive afterward', async () => {
    const { rerender } = render(<MortgageGroup fields={make(5)} onEdit={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /tu hipoteca/i });
    await userEvent.click(toggle); // opens it by hand, against the collapsed-above-4 rule
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    rerender(<MortgageGroup fields={make(9)} onEdit={vi.fn()} />);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
