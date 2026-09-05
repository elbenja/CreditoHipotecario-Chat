import { useState } from 'react';
import { Composer } from '../components/Composer';
import { EmptyPanel } from '../components/EmptyPanel';
import { Pill } from '../components/Pill';

const SUGGESTIONS = [
  '¿A cuánto puedo alquilarlo?',
  '¿Es un buen negocio?',
  '¿Cuánto me presta el banco?',
  '¿Me conviene amortizar?',
];

export function EmptyState({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex flex-1 flex-col justify-center px-14">
        <div className="mx-auto w-full max-w-transcript">
          <h1 className="font-jakarta text-[32px] font-extrabold leading-[1.2] tracking-[-.03em] text-white">
            ¿Qué depa estás evaluando?
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.6] text-slate-400">
            Cuéntamelo en tus palabras. Voy fijando los datos a la derecha y los puedes corregir
            cuando quieras.
          </p>

          <div className="mt-[26px]">
            <Composer
              variant="empty"
              value={value}
              onChange={setValue}
              onSubmit={() => onSubmit(value)}
              placeholder="Depa de 250 mil en Pueblo Libre, 40 m², tasa 8%…"
            />
          </div>

          <div className="mb-[14px] mt-[30px] text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
            O empieza por una pregunta
          </div>
          <div className="flex flex-wrap gap-[9px]">
            {SUGGESTIONS.map((s) => (
              <Pill key={s} onClick={() => onSubmit(s)}>
                {s}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <EmptyPanel />
    </div>
  );
}
