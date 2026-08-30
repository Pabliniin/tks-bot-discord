'use client';

import { createContext, useContext, useMemo } from 'react';

/**
 * Datos en vivo del servidor (canales, roles, emojis) que necesitan los
 * selectores del formulario. Se pasan por contexto para no repetirlos en cada
 * campo anidado.
 */
const GuildDataContext = createContext({
  channels: [],
  roles: [],
  emojis: [],
  commands: [],
  premium: { tier: 0, limits: {} },
  botPresent: false,
  guildId: null,
});

export function GuildDataProvider({ children, value }) {
  // Se memoiza para que los hijos no se redibujen en cada render del padre.
  const memo = useMemo(
    () => ({
      channels: value?.guildData?.channels || [],
      roles: value?.guildData?.roles || [],
      emojis: value?.guildData?.emojis || [],
      commands: value?.commands || [],
      premium: value?.premium || { tier: 0, limits: {} },
      botPresent: Boolean(value?.botPresent),
      guildId: value?.guildId || null,
      botRolePosition: value?.guildData?.botRolePosition ?? 0,
    }),
    [value]
  );

  return <GuildDataContext.Provider value={memo}>{children}</GuildDataContext.Provider>;
}

export function useGuildData() {
  return useContext(GuildDataContext);
}

export default GuildDataContext;
