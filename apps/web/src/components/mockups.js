/**
 * Maquetas de la interfaz de Discord para ilustrar la portada.
 *
 * Están hechas con HTML y CSS en vez de imágenes: pesan menos, se ven nítidas
 * en cualquier pantalla y se adaptan al ancho disponible.
 */

/** Envoltorio con el aspecto de una ventana de Discord. */
function Frame({ children, channel = 'general' }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-700/40 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-800 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-danger/80" />
        <span className="h-3 w-3 rounded-full bg-warning/80" />
        <span className="h-3 w-3 rounded-full bg-success/80" />
        <span className="ml-2 text-xs font-medium text-ink-300"># {channel}</span>
      </div>
      <div className="space-y-3 bg-ink-600/50 p-4">{children}</div>
    </div>
  );
}

/** Cabecera de un mensaje: avatar, nombre y hora. */
function MessageHeader({ name = 'TK$ Bot', bot = true, color = 'bg-brand-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-9 w-9 shrink-0 rounded-full ${color}`} />
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">{name}</span>
        {bot && (
          <span className="rounded bg-brand-500 px-1.5 py-px text-[10px] font-bold text-white">BOT</span>
        )}
        <span className="text-[11px] text-ink-300">hoy a las 21:04</span>
      </div>
    </div>
  );
}

/** Tarjeta de bienvenida generada por el bot. */
export function WelcomeMockup() {
  return (
    <Frame channel="bienvenidas">
      <MessageHeader />
      <p className="pl-11 text-sm text-ink-100">
        ¡Bienvenido <span className="rounded bg-brand-500/25 px-1 text-brand-200">@Rogue</span> a{' '}
        <strong>TK$ Community</strong>! Ahora somos 1.337 miembros.
      </p>

      <div className="ml-11 overflow-hidden rounded-lg border border-brand-500/40 bg-gradient-to-br from-ink-900 to-brand-900/60">
        <div className="flex flex-col items-center px-6 py-7">
          <div className="h-16 w-16 rounded-full border-[3px] border-brand-400 bg-ink-500" />
          <p className="mt-3 text-lg font-black tracking-wide text-white">BIENVENIDO</p>
          <p className="text-base font-bold text-brand-300">Rogue</p>
          <p className="mt-0.5 text-[11px] text-ink-200">Miembro #1337</p>
        </div>
      </div>
    </Frame>
  );
}

/** Mensaje embed personalizado. */
export function EmbedMockup() {
  return (
    <Frame channel="anuncios">
      <MessageHeader />
      <div className="ml-11 flex gap-3 rounded border-l-4 border-brand-500 bg-ink-800 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-brand-300">Normas del servidor</p>
          <p className="mt-0.5 text-sm font-bold text-white">Lee antes de participar</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-200">
            Respeta a los demás, no hagas spam y usa cada canal para lo suyo. El AutoMod se encarga
            del resto.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase text-white">Canales</p>
              <p className="text-[12px] text-ink-200">28 disponibles</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase text-white">Soporte</p>
              <p className="text-[12px] text-ink-200">Abre un ticket</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-ink-300">TK$ Bot · hoy a las 21:04</p>
        </div>
        <div className="hidden h-16 w-16 shrink-0 rounded bg-brand-500/30 sm:block" />
      </div>
    </Frame>
  );
}

/** Panel de roles autoasignables con botones. */
export function SelfRolesMockup() {
  const roles = [
    { label: 'Anuncios', emoji: '📣', style: 'bg-brand-500 text-white' },
    { label: 'Eventos', emoji: '🎉', style: 'bg-ink-700 text-ink-50' },
    { label: 'Sorteos', emoji: '🎁', style: 'bg-ink-700 text-ink-50' },
    { label: 'Actualizaciones', emoji: '🔔', style: 'bg-ink-700 text-ink-50' },
  ];

  return (
    <Frame channel="roles">
      <MessageHeader />
      <div className="ml-11 rounded border-l-4 border-brand-500 bg-ink-800 p-3.5">
        <p className="text-sm font-bold text-white">Elige tus roles</p>
        <p className="mt-1 text-[13px] text-ink-200">
          Pulsa un botón para recibir notificaciones solo de lo que te interese.
        </p>
      </div>
      <div className="ml-11 flex flex-wrap gap-2">
        {roles.map((role) => (
          <button
            key={role.label}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`pointer-events-none rounded px-3 py-1.5 text-[13px] font-medium ${role.style}`}
          >
            {role.emoji} {role.label}
          </button>
        ))}
      </div>
    </Frame>
  );
}

/** Tarjeta de rango del sistema de niveles. */
export function LevelsMockup() {
  return (
    <Frame channel="niveles">
      <MessageHeader />
      <p className="pl-11 text-sm text-ink-100">
        ¡Felicidades <span className="rounded bg-brand-500/25 px-1 text-brand-200">@Rogue</span>, has
        subido al <strong>nivel 15</strong>!
      </p>

      <div className="ml-11 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="h-14 w-14 rounded-full border-[3px] border-brand-400 bg-ink-500" />
            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-ink-900 bg-success" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-bold text-white">Rogue</p>
              <p className="shrink-0 text-[11px] font-semibold text-ink-300">
                RANGO <span className="text-white">#4</span>
                <span className="ml-2">
                  NIVEL <span className="text-brand-400">15</span>
                </span>
              </p>
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full w-[34%] rounded-full bg-gradient-to-r from-brand-400 to-brand-500" />
            </div>
            <p className="mt-1 text-right text-[11px] text-ink-300">675 / 1.975 XP</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}
