import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the mobile prompt, suggestions, and empty summary', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<EmptyState onSubmit={onSubmit} />);

    expect(
      screen.getByText(
        'Cuéntamelo en tus palabras. Voy fijando los datos abajo y los puedes corregir cuando quieras.',
      ),
    ).toBeInTheDocument();

    const suggestions = screen.getByRole('region', {
      name: 'Preguntas sugeridas para móvil',
    });
    const questionButtons = within(suggestions).getAllByRole('button');

    expect(questionButtons).toHaveLength(3);
    await user.click(questionButtons[1]!);
    expect(onSubmit).toHaveBeenCalledWith('¿Es un buen negocio?');
    expect(screen.getByText('Ningún dato fijado todavía')).toBeInTheDocument();
  });
});
