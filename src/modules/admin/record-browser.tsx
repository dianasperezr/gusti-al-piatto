"use client";

import Image from "next/image";
import Link from "next/link";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, LayoutGrid, List, Plus } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { manageContent } from "./content-actions";

type RecordRow = {
  id: string; name: string; slug: string | null; externalId: string | null; categoryId: string | null;
  published: boolean; active: boolean; featured: boolean; archived: boolean; mediaId: string | null;
};
type Command = Parameters<typeof manageContent>[2];
const batchActions = [
  ["publish", "Publicar"], ["unpublish", "Despublicar"], ["activate", "Activar"], ["deactivate", "Desactivar"],
  ["feature", "Destacar"], ["unfeature", "Quitar destacado"], ["duplicate", "Duplicar como borrador"], ["archive", "Archivar"],
] as const;

function CatalogRow({ record, path, current, cards, pending, selected, onSelect, up, down }: {
  record: RecordRow; path: string; current?: string; cards: boolean; pending: boolean;
  selected: boolean; onSelect: (checked: boolean) => void; up?: () => void; down?: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: record.id, disabled: pending });
  const published = record.published && record.active && !record.archived;
  const status = record.archived ? "Archivado" : !record.active ? "Inactivo" : published ? "Publicado" : "Borrador";
  return <div className={cards ? "record-tile" : "record-row"} ref={setNodeRef} role={cards ? "listitem" : "row"}
    style={{ transform: CSS.Transform.toString(transform), transition }} data-dragging={isDragging}>
    <div role={cards ? undefined : "cell"} className="record-pick">
      <button type="button" className="record-grip drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners}
        aria-label={"Reordenar " + record.name} disabled={pending || (!up && !down)}><GripVertical size={16} /></button>
      <input type="checkbox" aria-label={"Seleccionar " + record.name} disabled={pending}
        checked={selected} onChange={event => onSelect(event.target.checked)} />
    </div>
    <div role={cards ? undefined : "cell"}>
      <Link className="record-link" href={path + record.id + "#editor-registro"} aria-current={current === record.id ? "page" : undefined}>
        {cards && record.mediaId && <Image src={"/media/" + record.mediaId + "?thumbnail=1"} alt="" width={110} height={85} unoptimized />}
        <span>{record.name}</span>
      </Link>
    </div>
    <div role={cards ? undefined : "cell"} className="status" data-published={published}>{status}{record.featured ? " · Destacado" : ""}</div>
    <div role={cards ? undefined : "cell"} className="record-order">
      <button type="button" disabled={!up || pending} aria-label={"Subir " + record.name} onClick={up}><ArrowUp size={15} /></button>
      <button type="button" disabled={!down || pending} aria-label={"Bajar " + record.name} onClick={down}><ArrowDown size={15} /></button>
    </div>
  </div>;
}

export function RecordBrowser({ section, records, current, categories, filters }: {
  section: string; records: RecordRow[]; current?: string; categories: { id: string; name: string }[];
  filters: { q: string; estado: string; categoria: string; pagina: string };
}) {
  const { q: query, estado: filter, categoria: category } = filters;
  const [destination, setDestination] = useState("");
  const [cards, setCards] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [batch, setBatch] = useState<Command | "">("");
  const confirm = useRef<HTMLDialogElement>(null);
  const [pending, submit] = useTransition();
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const path = "/admin/" + section;
  const shown = records;
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const newPath = path + (params.size ? "?" + params : "");
  const editPath = newPath + (params.size ? "&" : "?") + "editar=";
  const selected = ids.filter(id => shown.some(record => record.id === id));

  function perform(command: Command, selection = selected, target?: string) {
    submit(async () => {
      const result = await manageContent(section, selection, command, target);
      setMessage(result);
      if (!result.error) {
        setIds([]);
        setBatch("");
      }
    });
  }
  function reorder(id: string, target: string) {
    if (id === target || !id) return;
    const order = shown.map(record => record.id);
    const index = order.indexOf(id);
    const to = order.indexOf(target);
    if (index < 0 || to < 0) return;
    perform("order", arrayMove(order, index, to));
  }

  return <aside className="panel record-list" aria-busy={pending}>
    <div className="panel-heading"><h2>Registros</h2><Link className="button small primary" href={newPath + "#editor-registro"}><Plus size={16} />Nuevo</Link></div>
    <form method="get" action={path} className="action-form record-filters" role="search">
      {current && <input type="hidden" name="editar" value={current} />}
      <label>Buscar<input type="search" name="q" defaultValue={query} maxLength={120} placeholder="Nombre, slug o identificador" /></label>
      <label>Estado<select name="estado" defaultValue={filter}>
        <option value="">Todos los vigentes</option><option value="published">Publicados</option><option value="draft">Borradores</option>
        <option value="inactive">Inactivos</option><option value="featured">Destacados</option><option value="archive">Archivados</option>
      </select></label>
      {section === "platillos" && <label>Categoría<select name="categoria" defaultValue={category}>
        <option value="">Todas</option>{categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>}
      <button className="button small" type="submit">Filtrar</button>
    </form>
    <div className="record-toolbar">
      {shown.length > 0 ? <label className="batch-select"><input type="checkbox" disabled={pending}
        checked={selected.length === shown.length} onChange={event => setIds(event.target.checked ? shown.map(record => record.id) : [])} />
        {selected.length ? `${selected.length} seleccionados` : "Seleccionar todos"}</label> : <span />}
      <button className="button small" type="button" onClick={() => setCards(!cards)}>
        {cards ? <List size={16} /> : <LayoutGrid size={16} />}{cards ? "Tabla" : "Tarjetas"}
      </button>
    </div>
    {selected.length > 0 && <div className="action-form batch-actions">
      {filter === "archive" ? <button className="button small" type="button" disabled={pending} onClick={() => perform("restore")}>Restaurar</button> :
        <div className="batch-operation">
          <label><span className="sr-only">Acción en lote</span><select value={batch} disabled={pending} onChange={event => setBatch(event.target.value as Command | "")}>
            <option value="">Acción en lote</option>
            {batchActions.map(([action, label]) => <option key={action} value={action}>{label}</option>)}
            {section === "platillos" && <option value="move">Mover a otra categoría</option>}
          </select></label>
          {batch === "move" && <label><span className="sr-only">Categoría de destino</span><select value={destination} disabled={pending} onChange={event => setDestination(event.target.value)}>
            <option value="">Sin categoría</option>{categories.filter(item => !("categoryId" in item && item.categoryId)).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select></label>}
          <button className="button small primary" type="button" disabled={pending || !batch} onClick={() => {
            if (batch === "archive") confirm.current?.showModal();
            else if (batch) perform(batch, selected, batch === "move" ? destination : undefined);
          }}>Aplicar</button>
        </div>}
    </div>}
    <ConfirmDialog dialog={confirm} title={`¿Archivar ${selected.length === 1 ? "el registro seleccionado" : `los ${selected.length} registros seleccionados`}?`} label="Archivar" onConfirm={() => perform("archive")} />
    {pending && <p role="status">Guardando cambios…</p>}
    {message.error && <p className="form-error" role="alert">{message.error}</p>}
    {message.success && <p className="form-success" role="status">{message.success}</p>}
    {shown.length === 0 ? <p className="record-empty">{query || filter || category || filters.pagina ? "No hay registros que coincidan con estos filtros." : "Todavía no hay registros."}</p> :
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
        if (over) reorder(String(active.id), String(over.id));
      }} accessibility={{ screenReaderInstructions: {
        draggable: "Pulsa espacio para levantar el registro, usa las flechas para moverlo y pulsa espacio para soltarlo. Escape cancela.",
      } }}>
        <div className={cards ? "record-cards" : "record-table"} role={cards ? "list" : "table"} aria-label="Registros del módulo">
          {!cards && <div className="record-row record-head" role="row">
            <span role="columnheader" aria-label="Selección" /><span role="columnheader">Nombre</span><span role="columnheader">Estado</span><span role="columnheader" aria-label="Orden" />
          </div>}
          <SortableContext items={shown.map(record => record.id)} strategy={rectSortingStrategy}>
            {shown.map((record, index) => <CatalogRow key={record.id} record={record} path={editPath} current={current} cards={cards} pending={pending}
              selected={ids.includes(record.id)} onSelect={checked => setIds(previous => checked ? [...previous, record.id] : previous.filter(value => value !== record.id))}
              up={index > 0 ? () => reorder(record.id, shown[index - 1].id) : undefined}
              down={index < shown.length - 1 ? () => reorder(record.id, shown[index + 1].id) : undefined} />)}
          </SortableContext>
        </div>
      </DndContext>}
  </aside>;
}
