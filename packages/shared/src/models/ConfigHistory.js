'use strict';

const { Schema, model, models } = require('mongoose');

/**
 * Historial de cambios del panel.
 *
 * Cada guardado deja constancia de **quién** cambió **qué** y **cuándo**, junto
 * con los valores anteriores para poder deshacer.
 *
 * Ningún otro bot del mercado lo ofrece: en un servidor con varios
 * administradores es la diferencia entre poder auditar una configuración rota
 * y tener que adivinar quién la tocó.
 */
const configHistorySchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },

    /** Quién hizo el cambio. */
    userId: { type: String, required: true },
    userTag: { type: String, default: '' },

    /**
     * Módulos afectados (`['logs', 'automod']`).
     * Se guarda aparte del diff para poder filtrar el historial sin recorrerlo.
     */
    modules: { type: [String], default: [], index: true },

    /**
     * Valores nuevos que se aplicaron, tal cual llegaron del panel.
     * Tipo `Mixed`: la forma depende del módulo editado.
     */
    changes: { type: Schema.Types.Mixed, default: {} },

    /**
     * Valores que había ANTES del cambio, limitados a las mismas ramas.
     * Es lo que se vuelve a aplicar al deshacer.
     */
    previous: { type: Schema.Types.Mixed, default: {} },

    /** Resumen legible («Logs · 3 campos»), calculado al guardar. */
    summary: { type: String, default: '' },

    /** Marca los registros creados al deshacer, para no encadenar deshaceres. */
    revert: { type: Boolean, default: false },
    /** Si es un deshacer, a qué entrada del historial revierte. */
    revertOf: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, minimize: false }
);

// Listado del historial de un servidor, del más reciente al más antiguo.
configHistorySchema.index({ guildId: 1, createdAt: -1 });

// El historial se conserva 180 días: suficiente para auditar sin crecer sin fin.
configHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 15_552_000 });

module.exports = models.ConfigHistory || model('ConfigHistory', configHistorySchema);
