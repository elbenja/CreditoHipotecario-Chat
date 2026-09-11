import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FieldGroup } from './FieldGroup';

const rows = (n: number) => Array.from({ length: n }, (_, i) => <div key={i}>Fila {i}</div>);

describe('FieldGroup', () => {
  it('renders nothing when the count is zero', () => {
    const { container } = render(<FieldGroup title="Hipoteca" count={0}>{rows(0)}</FieldGroup>);
    expect(container).toBeEmptyDOMElement();
  });

  // The credit is what the user just uploaded; hiding it behind a chevron
  // made "Fijar estos datos" look like it had done nothing.
  it('starts open, however many rows it holds', () => {
    render(<FieldGroup title="Hipoteca" count={9}>{rows(9)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /hipoteca/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Fila 8')).toBeInTheDocument();
  });

  it('toggles', async () => {
    render(<FieldGroup title="Hipoteca" count={5}>{rows(5)}</FieldGroup>);
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Fila 0')).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the count in the header', () => {
    render(<FieldGroup title="Hipoteca" count={5}>{rows(5)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /hipoteca/i })).toHaveTextContent('5');
  });

  it('keeps the user’s choice to close it even as rows arrive afterward', async () => {
    const { rerender } = render(<FieldGroup title="Hipoteca" count={5}>{rows(5)}</FieldGroup>);
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    await userEvent.click(toggle);
    rerender(<FieldGroup title="Hipoteca" count={9}>{rows(9)}</FieldGroup>);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

// Card 12: a change that lands while the group is shut is a task the user
// still owes a look, so a pill stays on the header until they open it. The
// group never opens itself.
describe('FieldGroup notice', () => {
  it('shows nothing while the group is open — the rows show the change', () => {
    render(
      <FieldGroup title="Hipoteca" count={4} notice={{ count: 4, revision: 1 }}>{rows(4)}</FieldGroup>,
    );
    expect(screen.queryByText('4 del PDF')).not.toBeInTheDocument();
  });

  it('flags a change that lands while shut, and does not auto-expand', async () => {
    const { rerender } = render(
      <FieldGroup title="Hipoteca" count={7} notice={{ count: 7, revision: 1 }}>{rows(7)}</FieldGroup>,
    );
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    await userEvent.click(toggle);

    rerender(
      <FieldGroup title="Hipoteca" count={11} notice={{ count: 4, revision: 2 }}>{rows(11)}</FieldGroup>,
    );
    expect(screen.getByText('4 del PDF')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('clears the pill once the group is opened', async () => {
    const { rerender } = render(
      <FieldGroup title="Hipoteca" count={7} notice={{ count: 7, revision: 1 }}>{rows(7)}</FieldGroup>,
    );
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    await userEvent.click(toggle);
    rerender(
      <FieldGroup title="Hipoteca" count={11} notice={{ count: 4, revision: 2 }}>{rows(11)}</FieldGroup>,
    );
    await userEvent.click(toggle);
    expect(screen.queryByText('4 del PDF')).not.toBeInTheDocument();
    // And it stays cleared if they close it again: it was seen.
    await userEvent.click(toggle);
    expect(screen.queryByText('4 del PDF')).not.toBeInTheDocument();
  });

  it('crossfades the count instead of counting up', () => {
    const { rerender } = render(<FieldGroup title="Hipoteca" count={7}>{rows(7)}</FieldGroup>);
    rerender(<FieldGroup title="Hipoteca" count={11}>{rows(11)}</FieldGroup>);
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    // Both numbers are in the DOM for the 180ms crossfade; the old one is
    // hidden from assistive tech and goes when its animation ends.
    expect(toggle).toHaveTextContent('11');
    const old = screen.getByText('7');
    expect(old).toHaveAttribute('aria-hidden', 'true');
    fireEvent.animationEnd(old);
    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });
});
