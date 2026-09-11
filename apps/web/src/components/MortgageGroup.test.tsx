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
});
