import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UploadingRow } from './UploadingRow';

const FILE = { name: 'cronograma-bcp-2026.pdf', size: 248 * 1024 };

describe('UploadingRow', () => {
  it('names the file and its size while the browser reads it', () => {
    render(<UploadingRow attachment={FILE} status="thinking" steps={[]} />);
    expect(screen.getByText('cronograma-bcp-2026.pdf')).toBeInTheDocument();
    expect(screen.getByText('248 KB')).toBeInTheDocument();
    expect(screen.getByText('Leyendo tu cronograma…')).toBeInTheDocument();
  });

  it('reports megabytes past 1 MB', () => {
    render(<UploadingRow attachment={{ name: 'x.pdf', size: 2.5 * 1024 * 1024 }} status="thinking" steps={[]} />);
    expect(screen.getByText('2.5 MB')).toBeInTheDocument();
  });

  // Once the server takes over, the page is read: that step goes green and
  // the server's own step spins beneath it, so the user learns what is
  // happening to their file instead of watching a bar sit at 100%.
  it('marks the read done and shows the server step once analysis starts', () => {
    render(
      <UploadingRow
        attachment={FILE}
        status="analyzing"
        steps={[{ label: 'Extrayendo las condiciones', done: false }]}
      />,
    );
    expect(screen.getByText('Primera página leída')).toBeInTheDocument();
    expect(screen.getByText('Extrayendo las condiciones…')).toBeInTheDocument();
    expect(screen.queryByText('Leyendo tu cronograma…')).not.toBeInTheDocument();
  });

  it('keeps the read step green while the reply streams in', () => {
    render(<UploadingRow attachment={FILE} status="streaming" steps={[]} />);
    expect(screen.getByText('Primera página leída')).toBeInTheDocument();
  });
});

describe('link mode (size 0)', () => {
  it('shows the host and the server step, with no size, bar or page-read line', () => {
    render(
      <UploadingRow
        attachment={{ name: 'nexoinmobiliario.pe', size: 0 }}
        status="analyzing"
        steps={[{ label: 'Leyendo el anuncio', done: false }]}
      />,
    );
    expect(screen.getByText('nexoinmobiliario.pe')).toBeInTheDocument();
    expect(screen.getByText(/Leyendo el anuncio/)).toBeInTheDocument();
    expect(screen.queryByText(/KB|MB/)).toBeNull();
    expect(screen.queryByText(/Primera página leída/)).toBeNull();
    expect(screen.queryByText(/Leyendo tu cronograma/)).toBeNull();
  });
});
