/**
 * Configuración de PM2 para el VPS.
 *
 * PM2 mantiene los dos procesos encendidos, los reinicia si se caen y los
 * vuelve a levantar al reiniciar el servidor.
 *
 *   pm2 start ecosystem.config.js     arrancar los dos
 *   pm2 restart tkbot-bot             reiniciar solo el bot
 *   pm2 logs tkbot-bot                ver los registros del bot
 *   pm2 monit                         panel en vivo de CPU y memoria
 */

module.exports = {
  apps: [
    {
      name: 'tkbot-bot',
      cwd: './apps/bot',
      script: 'src/index.js',

      // `fork` y una sola instancia: el bot mantiene UNA conexión con Discord.
      // Con `cluster` habría varias copias respondiendo al mismo comando.
      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      // Si algo pierde memoria, se reinicia antes de agotar el VPS.
      max_memory_restart: '600M',
      // Evita bucles de reinicio si el fallo es de configuración.
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 5000,

      env: {
        NODE_ENV: 'production',
      },

      error_file: '../../logs/bot-error.log',
      out_file: '../../logs/bot-out.log',
      time: true,
    },

    {
      name: 'tkbot-web',
      cwd: './apps/web',
      // El binario de Next está izado a la raíz del monorepo.
      script: '../../node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      interpreter: 'node',

      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      max_memory_restart: '500M',
      min_uptime: '30s',
      max_restarts: 10,
      restart_delay: 5000,

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      time: true,
    },
  ],
};
