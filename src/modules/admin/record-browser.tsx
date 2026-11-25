"use client";

import Image from "next/image";
import Link from "next/link";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArrowDown, ArrowUp, ChevronDown, CircleCheck, CircleMinus, FilePenLine, GripVertical, Image as ImageIcon, LayoutGrid, List, Maximize2, Pencil, Plus, SlidersHorizontal, Sparkles, Video } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { manageContent } from "./content-actions";
import "./record-browser.css";

type RecordRow = {
  id: string; name: string; meta: string; type?: string;
  published: boolean; active: boolean; featured: boolean; archived: boolean; mediaId: string | null;
  mediaIsVideo: boolean; mediaHasPreview: boolean;
};
const views = { list: ["Lista", List], grid: ["Cuadrícula", LayoutGrid], wide: ["Ancho completo", Maximize2] } as const;
type View = keyof typeof views;
type Command = Parameters<typeof manageContent>[2];
const batchActions = [
  ["publish", "Publicar"], ["unpublish", "Despublicar"], ["activate", "Activar"], ["deactivate", "Desactivar"],
  ["feature", "Destacar"], ["unfeature", "Quitar destacado"], ["duplicate", "Duplicar como borrador"], ["archive", "Archivar"],
] as const;

function CatalogRow({ record, path, current, cards, pending, selected, onSelect, changeStatus, up, down }: {
  record: RecordRow; path: string; current?: string; cards: boolean; pending: boolean;
  selected: boolean; onSelect: (checked: boolean) => void; up?: () => void; down?: () => void;
  changeStatus: (command: Command) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: record.id, disabled: pending });
  const published = record.published && record.active && !record.archived;
  const status = record.archived ? "Archivado" : !record.active ? "Desactivado" : published ? "Publicado" : "Borrador";
  const StatusIcon = record.archived ? Archive : !record.active ? CircleMinus : published ? CircleCheck : FilePenLine;
  const ThumbnailIcon = record.mediaIsVideo ? Video : ImageIcon;
  const statusActions: readonly (readonly [Command, string])[] = record.archived ? [["restore", "Restaurar"]] : [
    record.published ? ["unpublish", "Pasar a borrador"] : ["publish", "Publicar"],
    record.active ? ["deactivate", "Desactivar"] : ["activate", "Activar"],
    record.featured ? ["unfeature", "Quitar destacado"] : ["feature", "Destacar"],
  ];
  return <div className={cards ? "record-tile" : "record-row"} ref={setNodeRef} role={cards ? "listitem" : "row"}
    style={{ transform: CSS.Transform.toString(transform), transition }} data-dragging={isDragging}>
    <div role={cards ? undefined : "cell"} className="record-pick">
      <button type="button" className="record-grip drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners}
        aria-label={"Reordenar " + record.name} disabled={pending || (!up && !down)}><GripVertical size={16} /></button>
      <input type="checkbox" aria-label={"Seleccionar " + record.name} disabled={pending}
        checked={selected} onChange={event => onSelect(event.target.checked)} />
    </div>
    <div role={cards ? undefined : "cell"}>
      <Link className="record-link" href={path + record.id} scroll={false} aria-current={current === record.id ? "page" : undefined}>
        <span className="record-thumb" aria-hidden="true">
          {record.mediaId && record.mediaHasPreview ? <Image src={"/media/" + record.mediaId + "?thumbnail=1"} alt="" fill sizes="96px" unoptimized /> : <ThumbnailIcon size={19} />}
        </span>
        <span className="record-name"><strong>{record.name}</strong>{record.meta && <small>{record.meta}</small>}</span>
      </Link>
    </div>
    <div role={cards ? undefined : "cell"} className="record-type">
      {record.type && <Link className="button small" href={path + record.id} scroll={false}><SlidersHorizontal size={15} aria-hidden="true" />{record.type}</Link>}
    </div>
    <div role={cards ? undefined : "cell"}>
      <details className="record-status-menu" name="estado-registro">
        <summary className="status" data-published={published} aria-label={`Estado de ${record.name}: ${status}`}>
          <StatusIcon size={14} aria-hidden="true" />{status}
          {record.featured && <span className="record-featured"><Sparkles size={14} aria-hidden="true" /><span className="sr-only">Destacado</span></span>}
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="record-status-actions">{statusActions.map(([command, label]) => <button key={command} type="button" disabled={pending}
          onClick={event => {
            event.currentTarget.closest("details")?.removeAttribute("open");
            changeStatus(command);
          }}>{label}</button>)}</div>
      </details>
    </div>
    <div role={cards ? undefined : "cell"} className="record-actions">
      <Link className="button small" href={path + record.id} scroll={false} aria-label={"Editar " + record.name}><Pencil size={15} aria-hidden="true" />Editar</Link>
      <div className="record-order">
        <button type="button" disabled={!up || pending} aria-label={"Subir " + record.name} onClick={up}><ArrowUp size={15} /></button>
        <button type="button" disabled={!down || pending} aria-label={"Bajar " + record.name} onClick={down}><ArrowDown size={15} /></button>
      </div>
    </div>
  </div>;
}

export function RecordBrowser({ section, records, current, categories, filters, typeChoices }: {
  section: string; records: RecordRow[]; current?: string; categories: { id: string; name: string }[];
  filters: { q: string; estado: string; categoria: string; pagina: string; tipo: string };
  typeChoices: readonly (readonly [string, string])[];
}) {
  const { q: query, estado: filter, categoria: category, tipo: type } = filters;
  const [destination, setDestination] = useState("");
  const [view, setView] = useState<View>("list");
  const cards = view !== "list";
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

  return <section className="panel record-list record-library" aria-busy={pending}>
    <div className="panel-heading"><h2>Registros</h2><Link className="button primary" scroll={false}
      href={newPath + (params.size ? "&" : "?") + "nuevo=1"}><Plus size={17} aria-hidden="true" />Agregar nuevo registro</Link></div>
    <form method="get" action={path} className="action-form record-filters" role="search">
      <label>Buscar<input type="search" name="q" defaultValue={query} maxLength={120} placeholder="Nombre, slug o identificador" /></label>
      <label>Estado<select name="estado" defaultValue={filter}>
        <option value="">Todos los vigentes</option><option value="published">Publicados</option><option value="draft">Borradores</option><option value="active">Activos</option>
        <option value="inactive">Inactivos</option><option value="featured">Destacados</option><option value="archive">Archivados</option>
      </select></label>
      {section === "platillos" && <label>Categoría<select name="categoria" defaultValue={category}>
        <option value="">Todas</option>{categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </select></label>}
      {typeChoices.length > 0 && <label>Tipo<select name="tipo" defaultValue={type}>
        <option value="">Todos</option>{typeChoices.map(([value, title]) => <option value={value} key={value}>{title}</option>)}
      </select></label>}
      <button className="button small" type="submit">Filtrar</button>
    </form>
    <div className="record-toolbar">
      {shown.length > 0 ? <label className="batch-select"><input type="checkbox" disabled={pending}
        checked={selected.length === shown.length} onChange={event => setIds(event.target.checked ? shown.map(record => record.id) : [])} />
        {selected.length ? `${selected.length} seleccionados` : "Seleccionar todos"}</label> : <span />}
      <div className="record-views" role="group" aria-label="Presentación de registros">
        {(Object.keys(views) as View[]).map(mode => {
          const [label, Icon] = views[mode];
          return <button key={mode} className="button small" type="button" aria-pressed={view === mode} aria-label={label} title={label}
            onClick={() => setView(mode)}><Icon size={17} aria-hidden="true" /></button>;
        })}
      </div>
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
    {shown.length === 0 ? <p className="record-empty">{query || filter || category || type || filters.pagina ? "No hay registros que coincidan con estos filtros." : "Todavía no hay registros."}</p> :
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
        if (over) reorder(String(active.id), String(over.id));
      }} accessibility={{ screenReaderInstructions: {
        draggable: "Pulsa espacio para levantar el registro, usa las flechas para moverlo y pulsa espacio para soltarlo. Escape cancela.",
      } }}>
        <div className={"record-catalog " + (cards ? "record-cards record-view-" + view : "record-table")} role={cards ? "list" : "table"} aria-label="Registros del módulo">
          {!cards && <div className="record-row record-head" role="row">
            <span role="columnheader" aria-label="Selección" /><span role="columnheader">Nombre</span><span role="columnheader">Tipo</span><span role="columnheader">Estado</span><span role="columnheader">Acciones</span>
          </div>}
          <SortableContext items={shown.map(record => record.id)} strategy={rectSortingStrategy}>
            {shown.map((record, index) => <CatalogRow key={record.id} record={record} path={editPath} current={current} cards={cards} pending={pending}
              selected={ids.includes(record.id)} onSelect={checked => setIds(previous => checked ? [...previous, record.id] : previous.filter(value => value !== record.id))}
              changeStatus={command => perform(command, [record.id])}
              up={index > 0 ? () => reorder(record.id, shown[index - 1].id) : undefined}
              down={index < shown.length - 1 ? () => reorder(record.id, shown[index + 1].id) : undefined} />)}
          </SortableContext>
        </div>
      </DndContext>}
  </section>;
}
