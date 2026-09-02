# Cobrar con Stripe

Guía para pasar de repartir premium a mano a que la gente lo compre sola.

> **Sin configurar esto todo sigue funcionando.** La página de premium enseña
> los planes sin botones de compra, y tú repartes con `/premiumuser add`.

---

## Cómo encaja con lo que ya hay

El premium de alguien vive en un solo sitio: `User.premium`. Da igual cómo
llegue ahí.

```
/premiumuser add  ──┐
                    ├──►  User.premium { tier, until }  ──►  el usuario lo
Pago con Stripe   ──┘                                        aplica a un servidor
```

Por eso los comandos siguen funcionando igual después de conectar Stripe, y
puedes regalar premium a un amigo sin que la pasarela se entere ni le cobre.

---

## 1. Crear la cuenta y los productos

1. Entra en [dashboard.stripe.com](https://dashboard.stripe.com) y crea la cuenta.
2. Deja activado el **modo de prueba** (interruptor arriba a la derecha) hasta
   que lo tengas todo montado.
3. Ve a **Catálogo de productos** → **Añadir producto**.

Crea **dos productos**, cada uno con **dos precios**:

| Producto | Precio mensual | Precio anual |
| --- | --- | --- |
| TK$ Premium 1 | 4,99 € recurrente / mes | 49,90 € recurrente / año |
| TK$ Premium 2 | 9,99 € recurrente / mes | 99,90 € recurrente / año |

> Los importes tienen que coincidir con los de
> `packages/shared/src/plans.js`. Si cambias uno, cambia el otro: si no, la web
> enseñará un precio y Stripe cobrará otro.

Al guardar cada precio, copia su identificador. Empiezan por `price_`.

## 2. Coger las claves

En **Desarrolladores** → **Claves de API**:

- Copia la **clave secreta** (`sk_test_...`).

> **No compartas esta clave con nadie, ni la pegues en un chat.** Quien la tenga
> puede cobrar y devolver dinero en tu nombre. Va directa del panel de Stripe a
> las variables de entorno.

## 3. Crear el webhook

Es lo que le dice a tu web que alguien ha pagado. **Sin esto los pagos entran
pero el premium no se activa.**

En **Desarrolladores** → **Webhooks** → **Añadir endpoint**:

- **URL:** `https://tudominio.com/api/stripe/webhook`
- **Eventos a escuchar:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Al crearlo, copia el **secreto de firma** (`whsec_...`).

## 4. Rellenar las variables

En Easypanel, en el servicio **web**:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_TIER1_MENSUAL=price_...
STRIPE_PRICE_TIER1_ANUAL=price_...
STRIPE_PRICE_TIER2_MENSUAL=price_...
STRIPE_PRICE_TIER2_ANUAL=price_...
```

Redespliega el servicio `web`. Los botones de compra aparecen solos.

## 5. Activar el portal del cliente

En **Ajustes** → **Facturación** → **Portal del cliente**, actívalo y permite:

- Cancelar la suscripción
- Actualizar el método de pago
- Ver el historial de facturas

Es lo que hace el botón «Gestionar suscripción», y evita que cada baja acabe
siendo un mensaje tuyo a mano. En la Unión Europea, además, poder darse de baja
fácilmente es obligatorio.

---

## 6. Probar antes de cobrar de verdad

Con el modo de prueba activado, usa estas tarjetas:

| Tarjeta | Qué pasa |
| --- | --- |
| `4242 4242 4242 4242` | El pago funciona |
| `4000 0000 0000 0002` | La tarjeta se rechaza |
| `4000 0000 0000 3220` | Pide autenticación (3D Secure) |

Cualquier fecha futura y cualquier CVC valen.

**Comprueba esto:**

1. Compras un plan → al volver, la página de gracias dice que está activo.
2. En Discord, `/premiumuser info` te lo enseña.
3. Puedes aplicarlo a un servidor.
4. Desde «Gestionar suscripción» puedes darte de baja.
5. Tras la baja, en Stripe la suscripción sale como cancelada al final del
   periodo, y en la web sigue activa hasta esa fecha (es lo correcto: lo ha
   pagado).

### Probar el webhook en tu PC

El webhook necesita una URL pública. Para probar en local, usa la CLI de Stripe:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Te da un `whsec_...` temporal para el `.env` local.

---

## 7. Pasar a cobrar de verdad

1. Completa la verificación de tu cuenta en Stripe (te pedirán datos fiscales).
2. Quita el modo de prueba.
3. **Vuelve a crear los productos y precios**: los del modo de prueba no
   existen en el modo real.
4. **Crea otro webhook** apuntando al mismo sitio: el secreto también cambia.
5. Cambia las seis variables por las de producción (`sk_live_`, `whsec_`,
   `price_`).

---

## Cómo se protege esto

Cuatro cosas, y ninguna sobra:

**La firma del webhook.** Se verifica con el cuerpo de la petición en crudo.
Sin ello, cualquiera podría enviar un «este ha pagado» falso a tu web y
regalarse el premium. Es la protección más importante de todas.

**El nivel nunca viene del navegador.** El cliente solo elige un plan de
nuestro catálogo; el precio y el nivel que da los pone el servidor a partir de
lo que Stripe confirma.

**Deduplicación.** Stripe reintenta durante 72 horas si tu web tarda en
responder, así que el mismo evento llega varias veces. Se guardan los eventos
ya procesados (30 días) para no aplicarlos dos veces.

**Orden.** Los webhooks no llegan ordenados. Cada evento trae su fecha y se
descarta el que sea más antiguo que lo último aplicado, para que una
«creación» que llega tarde no reviva una suscripción cancelada.

---

## Decisiones que conviene conocer

**Un pago fallido no corta el acceso.** Cuando una tarjeta caduca, Stripe
reintenta varios días. Cortar al primer fallo es la forma más rápida de perder
a un cliente que sí quería pagar. El panel le avisa y el acceso sigue hasta que
Stripe se rinde.

**Al darse de baja, el acceso dura hasta el final del periodo.** Ha pagado ese
mes: le corresponde usarlo.

**El acceso lleva dos días de margen** sobre el fin del periodo, por si una
renovación se retrasa unas horas.

**Cancelar no quita el premium de los servidores.** El premium del servidor
tiene su propia fecha y caduca solo. Quitarlo de golpe dejaría un servidor sin
Anti-Raid en mitad de la noche, sin avisar a nadie.

**El premium regalado gana.** Si alguien tiene premium por `/premiumuser add`
y luego cancela una suscripción, se le respeta lo que le regalaste.

---

## Si algo no funciona

**Pago hecho pero sin premium**
El webhook no está llegando. En Stripe, **Desarrolladores → Webhooks**, mira
los intentos: verás el error. Lo más común es que la URL esté mal o que
`STRIPE_WEBHOOK_SECRET` no sea el de ese endpoint.

**«Firma no válida» en los registros**
El secreto no corresponde a ese webhook. Si tienes uno de prueba y otro real,
asegúrate de usar el que toca.

**No salen los botones de compra**
Falta `STRIPE_SECRET_KEY` o los `price_`. Con que falte uno, ese plan
desaparece de la lista; sin la clave, no sale ninguno.

**«Ese plan no está a la venta ahora mismo»**
Falta la variable `STRIPE_PRICE_...` de ese plan concreto.
