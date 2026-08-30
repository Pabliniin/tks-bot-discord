import { getSession } from '@/lib/session';
import { buildInviteUrl, userAvatarUrl } from '@/lib/discord';
import NavbarClient from './NavbarClient';

/**
 * Barra de navegación (componente de servidor).
 * Resuelve la sesión aquí para que el estado de "iniciar sesión" no parpadee.
 */
export default async function Navbar() {
  const session = await getSession();

  const user = session
    ? {
        id: session.userId,
        username: session.username,
        avatar: userAvatarUrl({ id: session.userId, avatar: session.avatar, discriminator: '0' }, 64),
      }
    : null;

  return (
    <NavbarClient
      user={user}
      inviteUrl={buildInviteUrl()}
      botName={process.env.NEXT_PUBLIC_BOT_NAME || 'TK$ Bot'}
    />
  );
}
