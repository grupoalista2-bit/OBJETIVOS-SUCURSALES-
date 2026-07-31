# Control Diario — ALISTA AHORRO (versión Supabase)

Octava versión. Reemplaza el almacenamiento local (`localStorage`) por una base de datos real en Supabase, con login por usuario y contraseña. Esto resuelve el problema de fondo de las versiones anteriores: ahora el dueño puede cargar tickets desde su celular y cada encargado va a ver esos mismos datos desde el suyo, porque todos leen y escriben la misma base en internet, no una copia aislada por dispositivo.

## Qué cambió respecto de la v7

- **Datos compartidos entre dispositivos.** `js/data.js` ya no usa `localStorage`: habla con una base Postgres en Supabase a través de `supabaseClient`. El objeto `Repo` mantiene los mismos nombres de método que en v7 (`getEncargados`, `crearObjetivoProgreso`, `cargarTicketsDelDia`, etc.), así que ninguna pantalla tuvo que rediseñarse desde cero.
- **Login real.** Se reemplazó el PIN (que era solo una traba de interfaz) por Supabase Auth: cada persona entra con email y contraseña. La sesión la guarda el propio `supabase-js` en el navegador, así que no hace falta volver a loguearse cada vez que se abre la app.
- **Seguridad de verdad, no solo de pantalla.** Cada tabla tiene Row Level Security (RLS) activado en la base (ver `sql/schema.sql`): un encargado solo puede leer su propia fila y sus propios objetivos/historial, y el dueño es el único que puede crear o editar cualquier cosa. Esa regla vive en la base de datos, no en el HTML — no se puede saltear abriendo las herramientas de desarrollador.
- **Un encargado se "vincula" a su usuario.** Al crear o editar un encargado, hay un campo "ID de usuario" donde se pega el UUID del usuario de Supabase Auth que le corresponde. Así la app sabe qué fila de `encargados` le pertenece a quién cuando esa persona inicia sesión.
- **Se sacó el botón "Borrar datos de prueba".** Ya no tiene sentido: los datos viven en la nube, compartidos, y borrarlos con un botón desde el celular de cualquiera sería peligroso. Si en algún momento se necesita limpiar algo, se hace desde el Table Editor de Supabase.

## Estructura del proyecto

```
control-diario-app-supabase/
  index.html                shell de la app: pantalla de login + las dos vistas + barra inferior
  css/styles.css             estilos mobile-first
  js/config.js                 acá se pegan la URL y la clave del proyecto de Supabase
  js/helpers.js                días hábiles exactos, ritmo, funciones de fecha (sin cambios respecto de v7)
  js/data.js                   Repo (datos) y Auth (login/sesión), ambos hablando con Supabase
  js/ui-encargado.js           vista de solo lectura del propio progreso
  js/ui-dueno.js                alta/edición/pausa de encargados, objetivos, carga diaria, dashboard, comparativo
  js/app.js                     login, logout, y qué pestaña mostrar según el rol
  sql/schema.sql                script SQL para crear las tablas y las reglas de seguridad en Supabase
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

## Sobre la seguridad

`js/config.js` queda visible para cualquiera que abra el código de la página — eso es normal y esperado en Supabase: la "Publishable key" (o "anon key") está diseñada para vivir en el navegador, no es un secreto. Lo que de verdad protege los datos es Row Level Security, definido en `sql/schema.sql`: aunque alguien copie esa clave y arme sus propias consultas contra tu proyecto, solo va a poder ver o modificar lo que las políticas le permitan según con qué usuario esté logueado (o nada, si no está logueado).

Nunca compartas la **Service Role key** de Supabase (aparece en la misma pantalla de API Keys) — esa sí es secreta, salta por encima de todas las reglas de seguridad, y no la usa esta app en ningún lado.

## Pendiente para próximas versiones

- Botón dentro del panel del dueño para invitar/crear usuarios de encargados sin tener que ir manualmente al dashboard de Supabase (requiere un backend liviano, porque crear usuarios con permisos administrativos necesita la Service Role key, que nunca debe estar en el navegador).
- Recuperación de contraseña por email para los encargados (hoy, si alguien olvida la suya, el dueño se la resetea manualmente desde Authentication > Users en el dashboard).
- Multi-sucursal con datos separados por dueño, si algún día se vende a otra cadena.
- Gráfico de evolución del historial en vez de solo los últimos 7 días.
