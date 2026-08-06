-- ============================================================
-- ALISTA AHORRO - Control Diario - Principios y valores
-- Correr esto DESPUÉS de sql/identidad.sql (que ya corriste). Agrega una
-- 4ta sección a la identidad institucional: Principios y valores, con el
-- mismo patrón de visibilidad por colaborador que Propósito/Misión/Visión.
-- Copiar y pegar TODO este archivo en el SQL Editor y ejecutar una sola vez.
-- ============================================================

alter table public.identidad_empresa
  add column valores text not null default '';

alter table public.encargados
  add column ve_valores boolean not null default false;

-- No hace falta tocar las políticas de RLS existentes: "identidad_select",
-- "identidad_update" y "encargados_update" ya cubren cualquier columna de
-- estas dos tablas, incluidas las nuevas.

-- ============================================================
-- Después de correr este script vas a ver, en el panel del dueño, dentro
-- de "Propósito, misión y visión", un cuarto campo "Principios y valores",
-- y en la ficha de cada encargado (al editarlo) un 4to casillero para
-- elegir si esa persona puede verlo en su pestaña Encargado.
-- ============================================================
