-- ============================================================
-- ALISTA AHORRO - Control Diario - Notificaciones del dueño a un colaborador
-- Correr esto DESPUÉS de los scripts anteriores. Copiar y pegar TODO este
-- archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

-- Mensajes cortos que el dueño le manda a un colaborador puntual (por
-- ejemplo, al cargar su ticket del día, como recordatorio de que revise
-- la app). Solo el dueño puede crearlas; cada colaborador solo ve y marca
-- como leídas las suyas -- nunca las de otro.

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  encargado_id uuid not null references public.encargados (id) on delete cascade,
  mensaje text not null,
  creado_por text not null default 'Dueño',
  creado_en timestamptz not null default now(),
  leida boolean not null default false,
  leida_en timestamptz
);

alter table public.notificaciones enable row level security;

create policy "notificaciones_select" on public.notificaciones
  for select to authenticated
  using (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

create policy "notificaciones_insert" on public.notificaciones
  for insert to authenticated
  with check ( (select public.es_dueno()) );

-- update: el dueño puede corregir cualquiera; el colaborador solo puede
-- marcar como leída la suya propia (no puede tocar el mensaje ni las de
-- otro).
create policy "notificaciones_update" on public.notificaciones
  for update to authenticated
  using (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  )
  with check (
    (select public.es_dueno())
    or encargado_id = (select public.mi_encargado_id())
  );

grant select, insert, update on public.notificaciones to authenticated;

-- ============================================================
-- Después de correr este script, al cargar un ticket (desde "Carga
-- rápida" o desde "Cargar / corregir un día" en el Dashboard) vas a ver
-- un casillero para avisarle al colaborador correspondiente. A ese
-- colaborador le va a aparecer el mensaje arriba de todo en su pestaña
-- Encargado, apenas entre a la app.
-- ============================================================
