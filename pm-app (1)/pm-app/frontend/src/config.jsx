import { createContext, useContext, useEffect, useState } from 'react';

// { mode: 'demo' | 'live', accounts: [...] } from GET /api/config
const ConfigCtx = createContext({ mode: 'live', accounts: [] });
export const useConfig = () => useContext(ConfigCtx);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState({ mode: 'live', accounts: [], loaded: false });
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => setConfig({ ...c, loaded: true }))
      .catch(() => setConfig((c) => ({ ...c, loaded: true })));
  }, []);
  return <ConfigCtx.Provider value={config}>{children}</ConfigCtx.Provider>;
}
