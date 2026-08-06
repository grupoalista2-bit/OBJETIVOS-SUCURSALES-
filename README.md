# Control Diario — ALISTA AHORRO (versión Supabase)

Octava versión. Reemplaza el almacenamiento local (`localStorage`) por una base de datos real en Supabase, con login por usuario y contraseña. Esto resuelve el problema de fondo de las versiones anteriores: ahora el dueño puede cargar tickets desde su celular y cada encargado va a ver esos mismos datos desde el suyo, porque todos leen y escriben la misma base en internet, no una copia aislada por dispositivo.

## Qué cambió respecto de la v7

- **Datos compartidos entre dispositivos.** `js/data.js` ya no usa `localStorage`: habla con una base Postgres en Supabase a través de `supabaseClient`. El objeto `Repo` mantiene los mismos nombres de método que en v7 (`getEncargados`, `crearObjetivoProgreso`, `cargarTicketsDelDia`, etc.), así que ninguna pantalla tuvo que rediseñarse desde cero.
- **Login real.** Se reemplazó el PIN (que era solo una traba de interfaz) por Supabase Auth: cada persona entra con email y contraseña. La sesión la guarda el propio `supabase-js` en el navegador, así que no hace falta volver a loguearse cada vez que se abre la app.
- **Seguridad de verdad, no solo de pantalla.** Cada tabla tiene Row Level Security (RLS) activado en la base (ver `sql/schema.sql`): un encargado solo puede leer su propia fila y sus propios objetivos/historial, y el dueño es el único que puede crear o editar cualquier cosa. Esa regla vive en la base de datos, no en el HTML — no se puede saltear abriendo las herramientas de desarrollador.
- **Un encargado se "vincula" a su usuario.** Al crear o editar un encargado, hay un campo "ID de usuario" donde se pega el UUID del usuario de Supabase Auth que le corresponde. Así la app sabe qué fila de `encargados` le pertenece a quién cuando esa persona inicia sesión.
- **Se sacó el botón "Borrar datos de prueba".** Ya no tiene sentido: los datos viven en la nube, compartidos, y borrarlos con un botón desde el celular de cualquiera sería peligroso. Si en algún momento se necesita limpiar algo, se hace desde el Table Editor de Supabase.

## Módulo de Gastos por sucursal (actualización)

Se agregó, dentro de esta misma app (mismo login, mismo proyecto de Supabase), un módulo para que cada encargado cargue los gastos de su sucursal y el dueño los apruebe, controle el pago y saque informes por categoría y por fecha. Vive en su propia pestaña "Gastos" en la barra de abajo (separada de "Encargado" y "Dueño"), con un contenido distinto según el rol de quien esté logueado.

- **El encargado carga, no aprueba solo.** Desde la pestaña Gastos, cada encargado completa: categoría (de una lista que arma el dueño), proveedor/entidad (ídem), concepto, monto, fecha, y forma de pago (Efectivo, Transferencia o Cheque — si es cheque, pide también el número y a nombre de quién es la firma). El gasto queda en estado "Pendiente de aprobación": no cuenta como gasto real todavía.
- **Dos pasos de control, separados: aprobación y pago.** Primero el dueño revisa el gasto (puede corregir cualquier dato) y lo **Aprueba** o **Rechaza**. Un gasto aprobado pasa a la sección "Pagos pendientes", donde el dueño lo marca como **Pagado** una vez que efectivamente se abonó — pueden pasar días entre una cosa y la otra (por ejemplo, un cheque aprobado pero que todavía no se entregó). Esto separa "¿es un gasto legítimo?" de "¿ya se pagó?", que son preguntas distintas.
- **Categorías y proveedores los administra el dueño.** Dos listas independientes (Categorías de gasto, Proveedores) con el mismo patrón: se crean con un nombre y se pueden desactivar sin borrar el historial de gastos ya cargados con esa categoría o proveedor.
- **Informe por fechas.** Se elige un rango de fechas (por defecto, el mes en curso) y muestra el total gastado en ese rango, desglosado por categoría y por sucursal. Solo suma los gastos ya **aprobados** — los pendientes o rechazados no entran en el total, para que el número siempre refleje gasto confirmado (esté pagado o no).
- **El dueño también puede mirar la vista de un encargado.** En la pestaña "Encargado", el dueño ve un selector para elegir a cualquiera y consultar su progreso exactamente como lo ve esa persona (de solo lectura).
- **Seguridad igual que el resto de la app:** un encargado, por más que manipule el código del navegador, solo puede cargar gastos a su propio nombre, siempre en estado pendiente y sin marcar como pagados — nunca puede aprobarse ni pagarse un gasto a sí mismo, ni ver los gastos de otra sucursal. Eso está impuesto por Row Level Security en la base, no por la pantalla (ver `sql/gastos.sql` y `sql/gastos_v2.sql`).

Si ya tenías la app funcionando y agregás este módulo después, hace falta correr, en este orden, `sql/gastos.sql` y después `sql/gastos_v2.sql` una vez cada uno en el SQL Editor de Supabase (además del `sql/schema.sql` que ya corriste), y volver a subir los archivos actualizados a GitHub — el detalle está en "Actualizar la app ya desplegada", más abajo.

## Propósito, misión y visión + progreso semanal (actualización)

- **Identidad institucional.** En la pestaña Dueño hay una sección "Propósito, misión y visión" donde el dueño carga el texto de cada una. Por sí solo no le aparece a nadie: en la ficha de cada encargado (botón "Editar" dentro de "Encargados") hay 3 casilleros — Propósito, Misión, Visión — para elegir cuál de los tres puede ver esa persona en particular. Al que tiene alguno tildado, ese texto le aparece arriba de todo en su pestaña Encargado, cada vez que entra a la app.
- **Progreso semanal.** Cada tarjeta de objetivo (tanto en el dashboard del dueño como en la vista de solo lectura del encargado) tiene un botón "Progreso semanal" que reparte la meta del mes entre las semanas (lunes a domingo) en proporción a los días hábiles de cada una, y muestra una barra por semana comparando lo que tendría que llevar esa semana contra lo que efectivamente cargó.

Si ya tenías la app funcionando, hace falta correr `sql/identidad.sql` una vez en el SQL Editor de Supabase (además de los anteriores) y volver a subir los archivos de código actualizados a GitHub.

## Estructura del proyecto

```
control-diario-app-supabase/
  index.html                shell de la app: pantalla de login + las dos vistas + barra inferior
  css/styles.css             estilos mobile-first
  js/config.js                 acá se pegan la URL y la clave del proyecto de Supabase
  js/helpers.js                días hábiles exactos, ritmo, funciones de fecha, y utilidades de gastos
  js/data.js                   Repo (datos) y Auth (login/sesión), ambos hablando con Supabase
  js/ui-encargado.js           vista de solo lectura del propio progreso
  js/ui-dueno.js                alta/edición/pausa de encargados, objetivos, carga diaria, dashboard, comparativo
  js/app.js                     login, logout, y qué pestaña mostrar según el rol
  sql/schema.sql                script SQL para crear las tablas y las reglas de seguridad en Supabase
  sql/gastos.sql                 script SQL del módulo de gastos (categorías, gastos, RLS)
  sql/gastos_v2.sql               ampliación: proveedores, forma de pago, cheque, estado de pago
  sql/identidad.sql                identidad institucional (propósito/misión/visión) y flags de visibilidad
```

## Puesta en marcha, paso a paso

Vas a necesitar unos 15-20 minutos la primera vez. Después de esto, usar la app es tan simple como abrir la URL y loguearse.

### 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratis (podés usar tu cuenta de GitHub).
2. "New Project". Elegí un nombre (por ejemplo `alista-ahorro`), una contraseña para la base de datos (guardala, no hace falta para la app pero sí para tareas avanzadas), y una región cercana. Esperá un par de minutos a que el proyecto termine de crearse.

### 2. Crear las tablas y las reglas de seguridad

1. En el menú lateral del proyecto, andá a **SQL Editor** → **New query**.
2. Abrí el archivo `sql/schema.sql` de esta carpeta, copiá todo su contenido, pegalo en el editor y apretá **Run**.
3. Esto crea las cuatro tablas (`encargados`, `objetivos_progreso`, `cargas_tickets`, `duenos`) y todas las reglas de seguridad (RLS) que hacen que cada encargado solo vea lo suyo.

### 3. Crear tu propio usuario (el dueño)

1. Andá a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Cargá un email (puede ser el tuyo real) y una contraseña. Tildá **Auto Confirm User** (si no lo tildás, Supabase espera que confirmes el email antes de poder loguearte, y como no vamos a configurar el envío de emails, quedaría trabado).
3. Creado el usuario, hacé clic en él y copiá su **User UID** (un código largo tipo `a1b2c3d4-...`).
4. Volvé al **SQL Editor**, abrí una consulta nueva y ejecutá (reemplazando por tu UID real):

   ```sql
   insert into public.duenos (user_id) values ('TU-UUID-AQUI');
   ```

   Esto es lo que te da acceso al panel del dueño quien inicia sesión con ese usuario.

### 4. Crear un usuario por cada encargado

Repetí el paso 3.1-3.3 (Add user → Create new user, con Auto Confirm User tildado) por cada encargado, con un email y una contraseña que le vas a pasar vos. Si no tienen email real, podés inventar uno con cualquier formato, por ejemplo `laura@alista.local` — no hace falta que exista de verdad, Supabase no envía nada ahí porque confirmaste el usuario manualmente. Copiá el UID de cada uno; los vas a pegar en la app en el paso 6.

### 5. Conectar la app a tu proyecto

1. En el dashboard de Supabase, andá a **Settings** → **API Keys**.
2. Copiá el **Project URL** y la **Publishable key** (en proyectos más viejos puede llamarse **anon key**, dentro de la pestaña "Legacy API Keys" — cualquiera de las dos sirve).
3. Abrí `js/config.js` en esta carpeta y reemplazá:

   ```js
   const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
   const SUPABASE_KEY = 'TU-PUBLISHABLE-O-ANON-KEY';
   ```

   por tus valores reales.

### 6. Probarla en tu computadora

Abrí `index.html` haciendo doble clic. Iniciá sesión con el usuario que creaste para vos (el dueño) en el paso 3. Deberías ver el panel completo. Ahí:

1. Agregá cada encargado (nombre, sucursal, y el "ID de usuario" que copiaste para esa persona en el paso 4).
2. Creá sus objetivos del mes.
3. Cargá algún ticket de prueba y confirmá que el número se actualiza.

Si abrís la misma URL en otro navegador o dispositivo y te logueás con el usuario de un encargado, deberías ver solo el progreso de esa persona — nada más.

## Ponerla en internet (GitHub + Vercel)

### 1. Subirla a GitHub

```
cd control-diario-app-supabase
git init
git add .
git commit -m "Primera versión con Supabase"
git branch -M main
```

En github.com creá un repositorio nuevo (vacío, sin README ni .gitignore), copiá la URL que te da, y:

```
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

Si preferís no usar la terminal, GitHub también permite arrastrar los archivos directamente desde la web al crear el repositorio (botón "uploading an existing file").

### 2. Desplegarla en Vercel

1. Entrá a vercel.com y elegí "continuar con GitHub".
2. "Add New" → "Project" → elegí el repositorio.
3. Es un sitio estático: dejá el "Build Command" vacío y el "Output Directory" en la raíz.
4. "Deploy". En un minuto te da una URL pública que ya podés compartir con cada encargado, junto con su email y contraseña.

Cada `git push` posterior actualiza la página sola.

## "Olvidé mi contraseña" — recuperarla desde el mail

1. En el dashboard de Supabase: **Authentication → Users**, hacé clic en la persona, y en **"Reset password"** tocá **"Send password recovery"**. Le llega un mail a la casilla real que tenga cargada esa cuenta.
2. Al tocar el link del mail, la app lo detecta sola y muestra una pantalla para poner la contraseña nueva (dos veces, para confirmar). Al guardar, cierra esa sesión temporal y pide loguearse de nuevo ya con la contraseña nueva.
3. **Importante:** para que el link del mail redirija a tu app y no a otro lado (por ejemplo `localhost`), el proyecto de Supabase tiene que tener configurada la URL correcta. Andá a **Authentication → URL Configuration** y fijate que **Site URL** sea la URL pública de tu app (por ejemplo `https://objetivos-sucursales.vercel.app`), sin la barra `/` al final. Si la cambiás, los links que ya te llegaron por mail antes del cambio quedan viejos — pedí que te reenvíen uno nuevo después de corregir la URL.

Además, cualquiera que ya esté logueado (dueño o encargado) puede cambiar su propia contraseña sin pasar por el mail: botón **"Contraseña"** junto a "Cerrar sesión", arriba de todo.

## Sobre la seguridad

`js/config.js` queda visible para cualquiera que abra el código de la página — eso es normal y esperado en Supabase: la "Publishable key" (o "anon key") está diseñada para vivir en el navegador, no es un secreto. Lo que de verdad protege los datos es Row Level Security, definido en `sql/schema.sql`: aunque alguien copie esa clave y arme sus propias consultas contra tu proyecto, solo va a poder ver o modificar lo que las políticas le permitan según con qué usuario esté logueado (o nada, si no está logueado).

Nunca compartas la **Service Role key** de Supabase (aparece en la misma pantalla de API Keys) — esa sí es secreta, salta por encima de todas las reglas de seguridad, y no la usa esta app en ningún lado.

## Actualizar la app ya desplegada

Cuando se agrega un módulo nuevo (como el de Gastos) a una app que ya está en internet, hay dos partes para actualizar — la base de datos y el código:

1. **Base de datos:** si el módulo trae un script SQL nuevo (por ejemplo `sql/gastos.sql`), corrélo una vez en el SQL Editor de Supabase, igual que hiciste con `sql/schema.sql` al principio.
2. **Código:** en GitHub, entrá al repositorio, y por cada archivo que cambió o se agregó, subilo de nuevo:
   - Si subiste los archivos originalmente arrastrándolos ("uploading an existing file"), volvé a hacer lo mismo: arrastrá los archivos nuevos o modificados a la raíz del repositorio (GitHub los va a detectar como cambios sobre los que ya existen) y confirmá con **Commit changes**.
   - Vercel detecta el cambio en GitHub automáticamente y vuelve a desplegar la app sola, sin que haya que tocar nada en Vercel. En un minuto la URL ya sirve la versión actualizada.

## Pendiente para próximas versiones

- Botón dentro del panel del dueño para invitar/crear usuarios de encargados sin tener que ir manualmente al dashboard de Supabase (requiere un backend liviano, porque crear usuarios con permisos administrativos necesita la Service Role key, que nunca debe estar en el navegador).
- Recuperación de contraseña por email para los encargados (hoy, si alguien olvida la suya, el dueño se la resetea manualmente desde Authentication > Users en el dashboard).
- Multi-sucursal con datos separados por dueño, si algún día se vende a otra cadena.
- Gráfico de evolución del historial en vez de solo los últimos 7 días.
- Adjuntar foto del comprobante a cada gasto (queda para una próxima versión si hace falta).
