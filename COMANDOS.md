# Comandos de TK$ Bot

Guía de los 44 comandos, con ejemplos. Actualizada el 30 de agosto de 2026.

> Este archivo lo genera `npm run gen:docs` leyendo los comandos reales.
> Si añades o cambias alguno, vuelve a ejecutarlo y se actualiza solo.

---

## Cómo se escriben

Todos los comandos funcionan **de dos formas**, la que prefieras:

| Forma | Ejemplo | Cuándo usarla |
|---|---|---|
| **Con prefijo** | `-ban @Rogue spam` | Más rápido de escribir |
| **Con barra** | `/ban usuario:@Rogue razon:spam` | Discord te va guiando |

El prefijo por defecto es `-` y puedes cambiarlo en el panel, en **Ajustes generales**.

### Cómo leer los ejemplos

| Símbolo | Significa |
|---|---|
| `<algo>` | **Obligatorio**: hay que ponerlo |
| `[algo]` | **Opcional**: puedes omitirlo |
| `a\|b` | Elige una de las dos |

Para referirte a alguien puedes mencionarle (`@Rogue`), poner su nombre
(`Rogue`) o su ID (`123456789012345678`). Con los canales igual: `#general`.

Si un texto lleva espacios y no va al final, ponlo entre comillas:

```
-warn @Rogue "spam en varios canales"
```

---

## Índice

**🎮 General** (8) — `color` · `colors` · `credits` · `help` · `moveme` · `rep` · `roll` · `short`

**📈 Niveles** (6) — `profile` · `rank` · `setlevel` · `setxp` · `title` · `top`

**ℹ️ Información** (4) — `avatar` · `roles` · `server` · `user`

**🛡️ Moderación** (22) — `ban` · `clear` · `kick` · `lock` · `move` · `mute` · `points` · `reset` · `role` · `setcolor` · `setnick` · `slowmode` · `starboard` · `timeout` · `unban` · `unlock` · `unmute` · `untimeout` · `vkick` · `warn` · `warn_remove` · `warnings`

**💎 Premium** (4) — `premium` · `premiumuser` · `staff` · `vip`

---

## 🎮 General

*Comandos para todo el mundo.*

### `-color`

Cambia tu color en el servidor.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-color <nombre del color>` |
| **También responde a** | `-micolor` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-color Rojo
-color quitar
```

### `-colors`

Enumera todos los colores disponibles.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **También responde a** | `-colores`, `-listacolores` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-colors
```

### `-credits`

Muestra tus créditos o el de otra persona.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-credits [usuario]` |
| **También responde a** | `-creditos`, `-créditos`, `-bal`, `-balance` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-credits
-credits @Rogue
```

### `-help`

Muestra la lista de comandos y cómo usarlos.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-help [comando]` |
| **También responde a** | `-ayuda`, `-comandos`, `-h` |
| **Espera entre usos** | 3 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Ejemplos:**

```
-help
-help ban
```

### `-moveme`

Te mueve a un canal de voz.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-moveme <canal>` |
| **También responde a** | `-muevame`, `-mover` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-moveme General
```

### `-rep`

Otorga a alguien un punto de reputación. Solo se puede utilizar una vez cada 24 horas.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-rep <usuario>` |
| **También responde a** | `-reputacion`, `-reputación` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-rep @Rogue
```

### `-roll`

Tira un dado.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-roll [dados]` |
| **También responde a** | `-dado`, `-dados`, `-dice` |
| **Espera entre usos** | 3 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Ejemplos:**

```
-roll
-roll 2d20
-roll 3d6+2
```

### `-short`

Acorta una URL.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-short <url>` |
| **También responde a** | `-acortar`, `-shorten` |
| **Espera entre usos** | 10 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Ejemplos:**

```
-short https://ejemplo.com/una/ruta/muy/larga
```

---

## 📈 Niveles

*Experiencia, rangos y perfiles.*

### `-profile`

Mira tu tarjeta de perfil personal o la de otra persona.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-profile [usuario]` |
| **También responde a** | `-perfil` |
| **Espera entre usos** | 8 segundos |

**Ejemplos:**

```
-profile
-profile @Rogue
```

### `-rank`

Mira tu tarjeta de rango de servidor o la de otra persona.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-rank [usuario]` |
| **También responde a** | `-rango`, `-nivel`, `-level` |
| **Espera entre usos** | 8 segundos |

**Ejemplos:**

```
-rank
-rank @Rogue
```

### `-setlevel`

Establece el nivel del usuario.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar servidor** en el servidor |
| **Uso** | `-setlevel <usuario> <nivel>` |
| **También responde a** | `-establecernivel` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-setlevel @Rogue 25
```

### `-setxp`

Establece el xp del usuario.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar servidor** en el servidor |
| **Uso** | `-setxp <usuario> <cantidad>` |
| **También responde a** | `-establecerxp` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-setxp @Rogue 5000
```

### `-title`

Cambia el título de tu perfil.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-title <texto>` |
| **También responde a** | `-titulo`, `-título` |
| **Espera entre usos** | 10 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Ejemplos:**

```
-title Fundador de TK$
-title quitar
```

### `-top`

Muestra los miembros principales por texto o voz.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-top [texto|voz|invitaciones]` |
| **También responde a** | `-ranking`, `-leaderboard`, `-lb` |
| **Espera entre usos** | 10 segundos |

**Ejemplos:**

```
-top
-top voz
-top invitaciones
```

---

## ℹ️ Información

*Datos de usuarios, roles y del servidor.*

### `-avatar`

Te muestra el avatar de un usuario.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-avatar [usuario]` |
| **También responde a** | `-av`, `-pfp`, `-foto` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-avatar
-avatar @Rogue
```

### `-roles`

Obtener una lista de roles de servidor y los miembros dentro.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-roles [rol]` |
| **También responde a** | `-listaroles`, `-roleinfo` |
| **Espera entre usos** | 8 segundos |

**Ejemplos:**

```
-roles
-roles @Moderador
```

### `-server`

Muestra información sobre el servidor.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **También responde a** | `-servidor`, `-serverinfo`, `-si` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-server
```

### `-user`

Muestra información, como el ID y la fecha de registro, sobre ti o un usuario.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **Uso** | `-user [usuario]` |
| **También responde a** | `-usuario`, `-userinfo`, `-ui` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-user
-user @Rogue
```

---

## 🛡️ Moderación

*Sanciones y control del servidor. Requieren permisos.*

### `-ban`

Banea a un miembro.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Banear miembros** en el servidor |
| **Uso** | `-ban <usuario> [razón]` |
| **También responde a** | `-banear`, `-banip` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-ban @Rogue spam repetido
-ban 123456789012345678 raid
```

### `-clear`

Limpia los mensajes del canal.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar mensajes** en el servidor |
| **Uso** | `-clear <cantidad> [usuario]` |
| **También responde a** | `-purge`, `-limpiar`, `-borrar` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-clear 50
-clear 100 @Rogue
```

### `-kick`

Expulsa a un miembro.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Expulsar miembros** en el servidor |
| **Uso** | `-kick <usuario> [razón]` |
| **También responde a** | `-expulsar`, `-echar` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-kick @Rogue comportamiento tóxico
```

### `-lock`

Prohíbe a @everyone enviar mensajes en un canal específico.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar canales** en el servidor |
| **Uso** | `-lock [canal] [razón]` |
| **También responde a** | `-bloquear`, `-cerrar` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-lock
-lock #general limpieza
```

### `-move`

Mueve a un miembro a un canal de voz.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Mover miembros** en el servidor |
| **Uso** | `-move <usuario> <canal>` |
| **También responde a** | `-mover-a`, `-moverusuario` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-move @Rogue General
```

### `-mute`

Silencia a un miembro en los canales de texto o de voz.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-mute <text|voice> <usuario> [duración] [razón]` |
| **También responde a** | `-silenciar` |
| **Espera entre usos** | 3 segundos |

**Opciones disponibles:**

- `-mute text` — Silenciar a un miembro para que no pueda escribir en los canales de texto.
- `-mute voice` — Silenciar a un miembro para que no pueda hablar en los canales de voz.

**Ejemplos:**

```
-mute text @Rogue 1h spam
-mute voice @Rogue gritar
```

### `-points`

Un servidor basado en puntos que pueden ser dados por los moderadores.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-points <add|remove|view|top> [usuario] [cantidad]` |
| **También responde a** | `-puntos` |
| **Espera entre usos** | 3 segundos |

**Opciones disponibles:**

- `-points add` — Da puntos a un miembro.
- `-points remove` — Quita puntos a un miembro.
- `-points view` — Consulta los puntos de un miembro.
- `-points top` — Muestra el ranking de puntos del servidor.

**Ejemplos:**

```
-points add @Rogue 5
-points view @Rogue
-points top
```

### `-reset`

Restablece texto/voz/invitaciones/puntos de XP para todos los miembros.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Administrador** en el servidor |
| **Uso** | `-reset <text|voice|invites|points|all> [usuario]` |
| **También responde a** | `-reiniciar`, `-restablecer` |
| **Espera entre usos** | 10 segundos |

**Ejemplos:**

```
-reset text
-reset all @Rogue
```

### `-role`

Agregar/Quitar role/s para un miembro.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar roles** en el servidor |
| **Uso** | `-role <add|remove> <usuario> <rol>` |
| **También responde a** | `-rol`, `-darrol` |
| **Espera entre usos** | 3 segundos |

**Opciones disponibles:**

- `-role add` — Agrega un rol a un miembro.
- `-role remove` — Quita un rol a un miembro.
- `-role all` — Añade un rol a todos los miembros del servidor.

**Ejemplos:**

```
-role add @Rogue Moderador
-role remove @Rogue Moderador
```

### `-setcolor`

Cambia el color del rol por códigos hexadecimales.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar roles** en el servidor |
| **Uso** | `-setcolor <rol> <#hex>` |
| **También responde a** | `-colorrol`, `-rolcolor` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-setcolor @Moderador #5865F2
-setcolor Miembro f00
```

### `-setnick`

Cambia el apodo de un miembro.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar apodos** en el servidor |
| **Uso** | `-setnick <usuario> [apodo]` |
| **También responde a** | `-nick`, `-apodo`, `-nickname` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-setnick @Rogue Fundador
-setnick @Rogue
```

### `-slowmode`

Habilita o deshabilita el modo lento en un canal.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar canales** en el servidor |
| **Uso** | `-slowmode <duración|off> [canal]` |
| **También responde a** | `-modolento`, `-lento` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-slowmode 10s
-slowmode 5m #general
-slowmode off
```

### `-starboard`

Resaltar mensajes destacados.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar servidor** en el servidor |
| **Uso** | `-starboard <config|channel|emoji|threshold|toggle> [valor]` |
| **También responde a** | `-destacados`, `-tablero` |
| **Espera entre usos** | 3 segundos |

**Opciones disponibles:**

- `-starboard config` — Muestra la configuración actual del starboard.
- `-starboard channel` — Elige el canal donde se publican los mensajes destacados.
- `-starboard emoji` — Cambia el emoji que destaca los mensajes.
- `-starboard threshold` — Cuántas reacciones hacen falta para destacar un mensaje.
- `-starboard toggle` — Activa o desactiva el starboard.

**Ejemplos:**

```
-starboard config
-starboard channel #destacados
-starboard threshold 5
```

### `-timeout`

Aísla a un usuario.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-timeout <usuario> <duración> [razón]` |
| **También responde a** | `-aislar`, `-tempmute` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-timeout @Rogue 1h spam
-timeout @Rogue 30m
```

### `-unban`

Desbanea a un miembro.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Banear miembros** en el servidor |
| **Uso** | `-unban <id o nombre> [razón]` |
| **También responde a** | `-desbanear` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-unban 123456789012345678
-unban Rogue perdón concedido
```

### `-unlock`

Permite a @everyone hablar en un canal específico.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Gestionar canales** en el servidor |
| **Uso** | `-unlock [canal] [razón]` |
| **También responde a** | `-desbloquear`, `-abrir` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-unlock
-unlock #general
```

### `-unmute`

Remueve el silencio de un miembro, en texto o en voz.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-unmute <text|voice> <usuario> [razón]` |
| **También responde a** | `-desilenciar`, `-quitarsilencio` |
| **Espera entre usos** | 3 segundos |

**Opciones disponibles:**

- `-unmute text` — Remover el silencio de un miembro en los canales de texto.
- `-unmute voice` — Quita el silencio de un miembro en los canales de voz.

**Ejemplos:**

```
-unmute text @Rogue
-unmute voice @Rogue
```

### `-untimeout`

Elimina el aislamiento de un usuario.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-untimeout <usuario> [razón]` |
| **También responde a** | `-desaislar`, `-quitaraislamiento` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-untimeout @Rogue
```

### `-vkick`

Expulsa a un miembro de un canal de voz.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Mover miembros** en el servidor |
| **Uso** | `-vkick <usuario> [razón]` |
| **También responde a** | `-voicekick`, `-expulsarvoz` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-vkick @Rogue molestar en voz
```

### `-warn`

Advierte a un miembro.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-warn <usuario> [razón]` |
| **También responde a** | `-advertir`, `-aviso` |
| **Espera entre usos** | 3 segundos |

**Ejemplos:**

```
-warn @Rogue no hagas spam
```

### `-warn_remove`

Eliminar advertencias para el servidor o usuario.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-warn_remove <case|user|server> [valor]` |
| **También responde a** | `-delwarn`, `-quitaradvertencia`, `-unwarn` |
| **Espera entre usos** | 3 segundos |

**Opciones disponibles:**

- `-warn_remove case` — Elimina una advertencia concreta por su número de caso.
- `-warn_remove user` — Elimina todas las advertencias de un usuario.
- `-warn_remove server` — Elimina todas las advertencias del servidor.

**Ejemplos:**

```
-warn_remove case 12
-warn_remove user @Rogue
-warn_remove server
```

### `-warnings`

Obtiene la lista de advertencias del servidor o de un usuario.

| | |
|---|---|
| **Quién puede usarlo** | Requiere el permiso **Aislar miembros** en el servidor |
| **Uso** | `-warnings [usuario]` |
| **También responde a** | `-advertencias`, `-warns` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-warnings
-warnings @Rogue
```

---

## 💎 Premium

*Suscripciones y administración del bot.*

### `-premiumuser`

Gestiona el premium personal de los usuarios.

| | |
|---|---|
| **Quién puede usarlo** | `add` y `remove`, solo el personal del bot. `info`, `activar` y `desactivar`, cualquiera sobre su propia suscripcion. |
| **Uso** | `-premiumuser <add|remove|info|activar|desactivar> [usuario] [nivel] [duración]` |
| **También responde a** | `-pu`, `-premiumusuario` |
| **Espera entre usos** | 3 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Opciones disponibles:**

- `-premiumuser add` — [Personal] Concede premium personal a alguien.
- `-premiumuser remove` — [Personal] Retira el premium personal de alguien.
- `-premiumuser info` — Consulta un premium personal.
- `-premiumuser activar` — Activa tu premium personal en este servidor.
- `-premiumuser desactivar` — Quita tu premium personal de este servidor.

**Ejemplos:**

```
-premiumuser add @Rogue 2 365d
-premiumuser info
-premiumuser activar
-premiumuser desactivar
```

### `-vip`

Muestra información sobre tu bot premium.

| | |
|---|---|
| **Quién puede usarlo** | Cualquiera |
| **También responde a** | `-membresia`, `-membresía`, `-miplan` |
| **Espera entre usos** | 5 segundos |

**Ejemplos:**

```
-vip
```

### `-premium`

Concede o retira suscripciones premium a los servidores.

| | |
|---|---|
| **Quién puede usarlo** | 🛡️ **Solo el personal del bot** (dueños incluidos) |
| **Uso** | `-premium <add|remove|info|list> [servidor] [nivel] [duración]` |
| **También responde a** | `-prem`, `-vipadmin` |
| **Espera entre usos** | 3 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Opciones disponibles:**

- `-premium add` — Concede premium a un servidor.
- `-premium remove` — Retira el premium de un servidor.
- `-premium info` — Consulta el premium de un servidor.
- `-premium list` — Lista todos los servidores con premium activo.

**Ejemplos:**

```
-premium add 123456789012345678 2 30d
-premium add 123456789012345678 1
-premium remove 123456789012345678
-premium info
-premium list
```

### `-staff`

Gestiona quién puede repartir premium con el comando premium.

| | |
|---|---|
| **Quién puede usarlo** | 👑 **Solo los dueños del bot** (`BOT_OWNERS`) |
| **Uso** | `-staff <add|remove|list> [usuario]` |
| **También responde a** | `-personal`, `-equipo` |
| **Espera entre usos** | 3 segundos |
| **Por privado** | Sí, funciona también en mensajes directos |

**Opciones disponibles:**

- `-staff add` — Permite a alguien repartir premium.
- `-staff remove` — Retira a alguien el permiso de repartir premium.
- `-staff list` — Muestra quién puede repartir premium.

**Ejemplos:**

```
-staff add @Amigo
-staff remove @Amigo
-staff list
```

---

## Cómo gestionar el premium, paso a paso

### 1. Ponte como dueño del bot

En Discord: **Ajustes de usuario → Avanzado → Modo desarrollador**.
Después, clic derecho sobre tu nombre → **Copiar ID de usuario**.

Ese ID va en la variable `BOT_OWNERS` (en Easypanel: servicio `bot` →
**Entorno**). Si sois varios, sepáralos por comas:

```
BOT_OWNERS=996608567750541392,111111111111111111
```

Guarda y pulsa **Implementar**. Sin esto no podrás usar `/staff`.

### 2. Nombra a quien quieras que reparta premium

```
-staff add @Amigo
-staff list
```

El personal puede repartir premium, pero **no** puede tocar la lista de
personal ni destituirte. Eso solo lo pueden hacer los dueños.

### 3. Reparte premium

Hay dos maneras, según lo que quieras:

**A. Activarlo directamente en un servidor**

```
-premium add 123456789012345678 2 30d
```

El servidor tendrá Premium 2 durante 30 días. Sin la duración, no caduca.

**B. Dárselo a una persona, para que lo active donde quiera**

```
-premiumuser add @Rogue 2 365d
```

Esa persona recibe un mensaje privado y luego, en el servidor que elija:

```
-premiumuser activar
```

Es lo más parecido a "comprar" premium: la suscripción es suya y puede
moverla de un servidor a otro con `-premiumuser desactivar`.

| Nivel | Servidores que puede activar |
|---|---|
| Premium 1 | 1 |
| Premium 2 | 3 |

### 4. Comprueba cómo va

```
-premium list              todos los servidores con premium
-premium info 1234...      un servidor concreto
-premiumuser info @Rogue   la suscripción de una persona
```

Todo esto se ve también en la web: en **/premium** aparece tu suscripción
con su caducidad, y en el panel de cada servidor, su plan.

### Duraciones que se admiten

| Escribes | Significa |
|---|---|
| `30d` | 30 días |
| `12h` | 12 horas |
| `2semanas` | 2 semanas |
| `365d` | Un año |
| `1d 12h` | Día y medio |
| *(vacío)* | Para siempre |

---

## Si algo no funciona

**Un comando no responde**
Comprueba que no esté desactivado en el panel (Ajustes generales → Comandos
desactivados) y que el canal no esté en la lista de canales ignorados.

**Los comandos con `/` no aparecen en Discord**
Los comandos globales tardan hasta una hora en propagarse. Mientras tanto,
usa la forma con prefijo, que funciona al instante.

**`-staff add` dice que sí pero luego `-staff list` sale vacío**
Casi seguro tienes el bot encendido en **dos sitios a la vez** (tu PC y el
servidor). Cada uno usa su propia base de datos, así que guardas en una y
lees de la otra. Deja encendido solo uno: el bot avisa de esto en sus
registros al arrancar.

**El bot no da roles ni sanciona**
Su rol tiene que estar **por encima** de los roles que gestiona.
Ajustes del servidor → Roles, y arrástralo arriba.

