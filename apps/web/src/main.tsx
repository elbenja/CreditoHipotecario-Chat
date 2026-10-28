import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getAccessToken, subscribeAccess } from './api/access';
import { AccessGate } from './screens/AccessGate';
import './index.css';

function Root() {
  const token = useSyncExternalStore(subscribeAccess, getAccessToken);
  return token ? <App /> : <AccessGate />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
