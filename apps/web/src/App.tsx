import { AssistantAnswer } from './components/AssistantAnswer';
import { TopNav } from './components/TopNav';

const fixture = {
  verdict:
    'Regular como negocio — y depende casi por completo de cuánta inicial pongas.',
  fields: [],
  metrics: [
    { label: 'Alquiler realista', value: 'S/ 1,750', delta: null, context: 'al mes, sin amoblar' },
    { label: 'Yield neto', value: '6.2%', delta: '↑ 1.0 pt sobre Lima Top', context: 'bruto 8.4%' },
    { label: 'Ingreso neto', value: 'S/ 1,400', delta: '↓ S/ 443 bajo tu cuota', context: 'cuota S/ 1,843 al mes' },
  ],
  scenarios: [
    { id: 'amoblado', cause: 'amoblado', value: '+S/ 250', unit: '/mes', tone: 'good' as const, note: 'sube el alquiler pero exige inversión inicial' },
    { id: 'plazo', cause: 'plazo', value: '−S/ 148', unit: '/mes', tone: 'tradeoff' as const, note: 'baja la cuota, sube el interés total' },
  ],
  sources: [],
  prose: [],
  followUps: [],
};

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <TopNav />
      <div className="mx-auto w-full max-w-transcript px-14 py-10">
        <AssistantAnswer envelope={fixture} onFollowUp={(t) => console.log('followup', t)} />
      </div>
    </div>
  );
}
