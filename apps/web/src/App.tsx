import { useState } from 'react';
import { PinnedPanel } from './components/PinnedPanel';
import { TopNav } from './components/TopNav';
import type { PinnedField } from '@chat/shared';

const initialFields: PinnedField[] = [
  { key: 'ubicacion', label: 'Ubicación', value: 'Pueblo Libre, Lima', provenance: 'user', note: '' },
  { key: 'precio', label: 'Precio', value: '250,000', prefix: 'S/', provenance: 'user', note: '' },
  { key: 'area', label: 'Área', value: '40', suffix: 'm²', provenance: 'user', note: '' },
  { key: 'tasa', label: 'Tasa TEA', value: '8.0', suffix: '%', provenance: 'user', note: '' },
  { key: 'inicial', label: 'Cuota inicial', value: '10', suffix: '%', provenance: 'assumed', note: '' },
  { key: 'plazo', label: 'Plazo', value: '20', suffix: 'años', provenance: 'assumed', note: '' },
  { key: 'alquiler', label: 'Alquiler estimado', value: '1,750', prefix: 'S/', suffix: '/mes', provenance: 'assumed', note: '' },
];

const proposals: Record<string, PinnedField> = {
  tasa: { key: 'tasa', label: 'Tasa TEA', value: '8.5', suffix: '%', provenance: 'market', note: '' },
};

export default function App() {
  const [fields, setFields] = useState(initialFields);

  const onEdit = (key: string, value: string) =>
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));

  return (
    <div className="flex h-full flex-col">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        <div className="flex-1" />
        <PinnedPanel fields={fields} proposals={proposals} onEdit={onEdit} />
      </div>
    </div>
  );
}
