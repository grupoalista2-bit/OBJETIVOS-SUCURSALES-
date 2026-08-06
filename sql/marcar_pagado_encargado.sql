-- ============================================================
-- ALISTA AHORRO - Control Diario - el encargado marca como pagado su
-- propio gasto (ya aprobado)
-- Correr esto DESPUÉS de los scripts anteriores. Copiar y pegar TODO este
-- archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

-- No se hace ampliando la política de UPDATE de "gastos" (esa sigue
-- siendo solo del dueño) porque una política de fila no puede impedir que,
-- de paso, alguien cambie OTRAS columnas del mismo gasto (el monto, la
-- categoría, etc.) en la misma operación. En cambio, esta función solo
-- toca las columnas de pago, y valida ella misma que el gasto sea del
-- encargado que la llama, que ya esté aprobado, y que todavía no esté
-- pagado -- exactamente lo mismo que ya hace el dueño desde su panel,
-- pero acotado al propio gasto.

create or replace function public.marcar_gasto_pagado_propio(
  p_gasto_id uuid,
  p_forma_pago text,
  p_cheque_numero text,
  p_cheque_firma text
)
returns public.gastos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fila public.gastos;
begin
  update public.gastos
  set estado_pago = 'pagado',
      forma_pago = coalesce(p_forma_pago, forma_pago),
      cheque_numero = coalesce(p_cheque_numero, cheque_numero),
      cheque_firma = coalesce(p_cheque_firma, cheque_firma)
  where id = p_gasto_id
    and encargado_id = (select public.mi_encargado_id())
    and estado = 'aprobado'
    and estado_pago = 'pendiente'
  returning * into v_fila;

  if v_fila.id is null then
    raise exception 'No se pudo marcar como pagado: el gasto no existe, no es tuyo, no está aprobado, o ya estaba pagado.';
  end if;

  return v_fila;
end;
$$;

-- Cualquier usuario logueado puede LLAMAR a la función (dueños y
-- encargados), pero la función en sí misma solo deja pasar el update si
-- el gasto es del encargado que la llama -- el dueño ya tiene su propio
-- camino (Repo.marcarGastoPagado, vía la política de UPDATE existente).
grant execute on function public.marcar_gasto_pagado_propio(uuid, text, text, text) to authenticated;

-- ============================================================
-- Después de correr este script, en la pestaña Gastos de cada encargado,
-- los gastos ya aprobados y todavía no pagados van a tener un botón
-- "Marcar como pagado" -- no hace falta tocar SQL para eso.
-- ============================================================
