import { TopNav } from './components/TopNav';
import { EmptyState } from './screens/EmptyState';

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <TopNav />
      <EmptyState onSubmit={(t) => console.log('submit', t)} />
    </div>
  );
}
