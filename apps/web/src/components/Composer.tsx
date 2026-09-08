import { useState } from 'react';
import { Icon } from './Icon';

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  variant = 'active',
  disabled = false,
  suggestions = [],
  onSuggestion,
  suggestionClassName = '',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  variant?: 'empty' | 'active';
  disabled?: boolean;
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  suggestionClassName?: string;
}) {
  const [focused, setFocused] = useState(false);

  const submit = () => {
    if (!disabled && value.trim()) onSubmit();
  };

  if (variant === 'empty') {
    return (
      <div className="rounded-xl border border-ch-border bg-ch-panel px-[18px] pb-[14px] pt-[18px] transition-colors duration-180 ease-ch focus-within:border-ch-accent focus-within:shadow-[0_0_0_3px_rgba(244,188,68,.35)] hover:border-ch-border-hover">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={placeholder}
          className="w-full bg-transparent text-[14.5px] text-white outline-none placeholder:text-slate-500"
        />
        <div className="mt-[14px] flex items-center">
          <span className="flex items-center gap-[6px] text-[11.5px] text-slate-400">
            <Icon name="link-02" size={13} />o pega el link de un anuncio
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={submit}
            className="grid h-[34px] w-[34px] place-items-center rounded-full bg-ch-card text-white transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px active:opacity-85"
            aria-label="Enviar"
          >
            <Icon name="arrow-right-01" size={17} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {focused && suggestions.length > 0 && (
        <div className={`ch-rise mb-2 flex flex-wrap gap-2 ${suggestionClassName}`}>
          {/* Exactly two. The composer is not a menu. */}
          {suggestions.slice(0, 2).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSuggestion?.(s)}
              className="rounded-full border border-ch-border-hover px-3 py-[6px] text-[12px] font-medium text-slate-300 transition-colors duration-180 ease-ch hover:border-slate-500"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div
        className={`flex items-center gap-[14px] rounded-xl border border-ch-border bg-ch-panel py-[15px] pl-[18px] pr-[15px] transition-colors duration-180 ease-ch focus-within:border-ch-accent focus-within:shadow-[0_0_0_3px_rgba(244,188,68,.35)] hover:border-ch-border-hover ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        {/* Disabled, not hidden: the message is pending, not lost. */}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-[14.5px] text-white outline-none placeholder:text-slate-500"
        />
        {/* Primary CTA: slate-50 background, per the product rule. */}
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-slate-50 text-ch-bg transition-opacity duration-120 ease-ch hover:opacity-90 active:translate-y-px active:opacity-85 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Icon name="arrow-right-01" size={17} />
        </button>
      </div>
    </>
  );
}
