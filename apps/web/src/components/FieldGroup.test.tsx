import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FieldGroup } from './FieldGroup';

const rows = (n: number) => Array.from({ length: n }, (_, i) => <div key={i}>Fila {i}</div>);

describe('FieldGroup', () => {
  it('renders nothing when the count is zero', () => {
    const { container } = render(<FieldGroup title="Hipoteca" count={0}>{rows(0)}</FieldGroup>);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts open by default', () => {
    render(<FieldGroup title="Propiedad" count={6}>{rows(6)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /propiedad/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Fila 5')).toBeInTheDocument();
  });

  it('starts open at the collapse threshold or fewer', () => {
    render(<FieldGroup title="Hipoteca" count={4} collapseAbove={4}>{rows(4)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /hipoteca/i })).toHaveAttribute('aria-expanded', 'true');
  });

  it('starts collapsed past the threshold, so it does not bury the other group', () => {
    render(<FieldGroup title="Hipoteca" count={5} collapseAbove={4}>{rows(5)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /hipoteca/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Fila 0')).not.toBeInTheDocument();
  });

  it('toggles', async () => {
    render(<FieldGroup title="Hipoteca" count={5} collapseAbove={4}>{rows(5)}</FieldGroup>);
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Fila 0')).toBeInTheDocument();
  });

  it('shows the count in the header', () => {
    render(<FieldGroup title="Hipoteca" count={5} collapseAbove={4}>{rows(5)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /hipoteca/i })).toHaveTextContent('5');
  });

  // PinnedPanel mounts this group unconditionally, before an upload's fields
  // arrive — so the initializer alone (`useState(count <= n)`) sees zero,
  // opens, and then never re-evaluates once nine land. Only a reload (a fresh
  // mount with the fields already present) got this right.
  it('collapses once rows arrive after mounting with none, not only after a reload', () => {
    const { rerender } = render(<FieldGroup title="Hipoteca" count={0} collapseAbove={4}>{rows(0)}</FieldGroup>);
    rerender(<FieldGroup title="Hipoteca" count={9} collapseAbove={4}>{rows(9)}</FieldGroup>);
    expect(screen.getByRole('button', { name: /hipoteca/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the user’s own choice even as more rows arrive afterward', async () => {
    const { rerender } = render(<FieldGroup title="Hipoteca" count={5} collapseAbove={4}>{rows(5)}</FieldGroup>);
    const toggle = screen.getByRole('button', { name: /hipoteca/i });
    await userEvent.click(toggle); // opens it by hand, against the collapsed-above-4 rule
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    rerender(<FieldGroup title="Hipoteca" count={9} collapseAbove={4}>{rows(9)}</FieldGroup>);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
