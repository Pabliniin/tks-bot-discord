import { notFound } from 'next/navigation';
import { getGuildSettings, premiumTier, premiumLimits } from '@tkbot/shared';
import { AlertTriangle } from 'lucide-react';

import ModuleForm from '@/components/dashboard/ModuleForm';
import { getSchema } from '@/lib/moduleSchemas';
import { getGuildData, getCommands } from '@/lib/botApi';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { module: moduleId } = await params;
  const schema = getSchema(moduleId);
  return { title: schema ? schema.title : 'Módulo' };
}

/**
 * Página de configuración de un módulo.
 *
 * Todos los módulos comparten esta página: el formulario se construye a partir
 * del esquema declarado en `lib/moduleSchemas.js`.
 */
export default async function ModulePage({ params }) {
  const { guildId, module: moduleId } = await params;

  const schema = getSchema(moduleId);
  if (!schema) notFound();

  let settings;
  try {
    settings = await getGuildSettings(guildId);
  } catch (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-5">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-danger" />
        <div className="text-sm text-danger">
          <p className="font-semibold">No se ha podido cargar la configuración.</p>
          <p className="mt-1 text-danger/80">{error.message}</p>
        </div>
      </div>
    );
  }

  const [guildData, commands] = await Promise.all([getGuildData(guildId), getCommands()]);

  // El documento de mongoose no se puede pasar a un componente de cliente:
  // se convierte a JSON plano (esto también convierte el Map de logs en objeto).
  const plain = JSON.parse(JSON.stringify(settings.toObject()));

  return (
    <ModuleForm
      schema={schema}
      initialSettings={plain}
      guildId={guildId}
      guildData={guildData}
      botPresent={Boolean(guildData)}
      premium={{ tier: premiumTier(settings), limits: premiumLimits(settings) }}
      commands={commands || []}
    />
  );
}
