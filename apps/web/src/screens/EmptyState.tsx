import { useState } from 'react';
import { Composer } from '../components/Composer';
import { EmptyPanel } from '../components/EmptyPanel';
import { Icon } from '../components/Icon';
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
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-5 pt-3 md:hidden">
        <div className="mx-auto w-full max-w-transcript">
          <h1 className="font-jakarta text-[27px] font-extrabold leading-[1.18] tracking-[-.03em] text-white">
            ¿Qué depa estás evaluando?
          </h1>
          <p className="mt-[10px] text-[13.5px] leading-[1.6] text-slate-400">
            Cuéntamelo en tus palabras. Voy fijando los datos abajo y los puedes corregir cuando
            quieras.
          </p>

          <div className="mb-3 mt-7 text-[10px] font-semibold uppercase leading-none tracking-[.1em] text-slate-500">
            O empieza por una pregunta
          </div>
          <div
            role="region"
            aria-label="Preguntas sugeridas para móvil"
            className="flex flex-col gap-2"
          >
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <Pill
                key={s}
                onClick={() => onSubmit(s)}
                className="min-h-[45px] w-full !rounded-xl border-ch-border-hover px-[15px] py-3 text-left text-[13.5px]"
              >
                {s}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-none px-5 pt-[14px] md:hidden">
        <Composer
          value={value}
          onChange={setValue}
          onSubmit={() => onSubmit(value)}
          placeholder="Describe tu depa…"
        />
      </div>

      <div className="mobile-safe-bottom mt-3 flex min-h-[62px] flex-none items-center gap-3 border-t border-ch-border px-5 text-[12.5px] font-medium text-slate-400 md:hidden">
        <span className="flex-1">Ningún dato fijado todavía</span>
        <Icon name="arrow-up-01" size={16} className="text-ch-border-hover" />
      </div>

      <div className="hidden flex-1 flex-col justify-center px-14 md:flex">
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
