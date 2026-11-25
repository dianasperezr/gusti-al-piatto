"use client";

import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useRef, useState } from "react";
import { MediaPicker, type MediaOption } from "@/modules/media/picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { saveVisualForm } from "./layout-actions";
import { emptySection, sectionNames, type SectionKind, type VisualLayout, type VisualSection } from "./layout-schema";

type Resource = { id: string; name: string; mime?: string };
const pairs = Object.entries(sectionNames) as [SectionKind, string][];
const settings = {
  typography: [["classic", "Clásica"], ["modern", "Moderna"], ["editorial", "Editorial"]],
  icon: [["utensils", "Cubiertos"], ["leaf", "Hoja"], ["none", "Ocultar icono"]],
  headerStyle: [["minimal", "Minimalista"], ["photo", "Con fotografía"], ["banner", "Con banner"], ["compact", "Compacto"], ["integrated", "Navegación integrada"]],
  navigation: [["horizontal", "Horizontal"], ["side", "Lateral"], ["tabs", "Pestañas"], ["none", "Oculta"]],
  cartStyle: [["panel", "Panel lateral"], ["center", "Modal centrado"]],
} as const;

function SectionRow({ section, selected, onSelect }: { section: VisualSection; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  return <li ref={setNodeRef} className="visual-row" style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button type="button" className="button small drag-handle" {...attributes} {...listeners} aria-label={"Reordenar " + sectionNames[section.type]}><GripVertical size={18} /></button>
    <button type="button" className={selected ? "button small primary" : "button small"} onClick={onSelect} aria-pressed={selected}>
      {section.title || sectionNames[section.type]}{section.hidden ? " · Oculta" : ""}
    </button>
  </li>;
}

export function LayoutEditor({ initial, assets, categories, published }: {
  initial: VisualLayout; assets: MediaOption[]; categories: Resource[]; published: boolean;
}) {
  const [layout, setLayout] = useState(initial);
  const [knownAssets, setKnownAssets] = useState(assets);
  function rememberAssets(items: MediaOption[]) {
    setKnownAssets(previous => [...new Map([...previous, ...items].map(item => [item.id, item])).values()]);
  }
  const [selectedId, select] = useState(initial.sections[0]?.id ?? "");
  const [adding, setAdding] = useState<SectionKind>("banner");
  const [mode, setMode] = useState<"mobile" | "desktop">("desktop");
  const [preview, setPreview] = useState(false);
  const [state, action, pending] = useActionState(saveVisualForm, {});
  const removeDialog = useRef<HTMLDialogElement>(null);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const section = layout.sections.find(item => item.id === selectedId);
  const style = layout.style;

  function updateStyle<K extends keyof VisualLayout["style"]>(key: K, value: VisualLayout["style"][K]) {
    setLayout(current => ({ ...current, style: { ...current.style, [key]: value } }));
  }
  function updateSection<K extends keyof VisualSection>(key: K, value: VisualSection[K]) {
    setLayout(current => ({ ...current, sections: current.sections.map(item => item.id === selectedId ? { ...item, [key]: value } : item) }));
  }
  function insert(value: VisualSection) {
    setLayout(current => ({ ...current, sections: [...current.sections, value] }));
    select(value.id);
  }
  function reorder({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setLayout(current => {
      const from = current.sections.findIndex(item => item.id === active.id);
      const to = current.sections.findIndex(item => item.id === over.id);
      return from < 0 || to < 0 ? current : { ...current, sections: arrayMove(current.sections, from, to) };
    });
  }

  const labels = {
    typography: "Tipografía", icon: "Iconografía", headerStyle: "Estilo del encabezado",
    navigation: "Navegación", cartStyle: "Presentación del carrito",
  };
  const flags = {
    fixedHeader: "Encabezado fijo", fixedNavigation: "Navegación fija", compactMobile: "Navegación móvil compacta",
    categoryNavigation: "Navegación por categorías", cartVisible: "Habilitar carrito en este diseño",
  } as const;

  return <div className="visual-builder">
    <form action={action} className="panel visual-publish">
      <input type="hidden" name="layout" value={JSON.stringify(layout)} />
      <div><h2>Constructor visual</h2><p>{published ? "El menú público usa el último diseño publicado." : "El menú público usa su diseño inicial."}</p></div>
      <div className="export-links">
        <button className="button" name="operation" value="draft" disabled={pending}>Guardar borrador</button>
        <button className="button" name="operation" value="draft" disabled={pending} onClick={() => setPreview(true)}>Guardar y ver vista previa</button>
        <button className="button primary" name="operation" value="publish" disabled={pending}>
          {pending && <span className="loading-spinner" aria-hidden="true" />}{pending ? "Guardando…" : "Publicar diseño"}
        </button>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
    </form>

    <div className="visual-columns">
      <section className="panel">
        <h2>Secciones</h2>
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}
          accessibility={{ screenReaderInstructions: { draggable: "Pulsa espacio para tomar una sección, usa las flechas para moverla y espacio para soltarla." } }}>
          <SortableContext items={layout.sections.map(item => item.id)} strategy={verticalListSortingStrategy}>
            <ol className="visual-list">{layout.sections.map(item => <SectionRow key={item.id} section={item} selected={selectedId === item.id} onSelect={() => select(item.id)} />)}</ol>
          </SortableContext>
        </DndContext>
        <div className="action-form">
          <label>Componente<select value={adding} onChange={event => setAdding(event.target.value as SectionKind)}>
            {pairs.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
          <button className="button" type="button" disabled={layout.sections.length >= 32} onClick={() => insert(emptySection(crypto.randomUUID(), adding))}>Agregar sección</button>
        </div>
      </section>

      <div className="visual-properties">
        {section && <section className="panel"><h2>Propiedades de la sección</h2>
          <div className="action-form">
            <div className="field-grid">
              <label>Componente<select value={section.type} onChange={event => updateSection("type", event.target.value as SectionKind)}>{pairs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Presentación<select value={section.layout} onChange={event => updateSection("layout", event.target.value as VisualSection["layout"])}><option value="grid">Cuadrícula</option><option value="list">Lista</option><option value="wide">Ancha</option></select></label>
            </div>
            <label>Título<input maxLength={140} value={section.title} onChange={event => updateSection("title", event.target.value)} /></label>
            <label>Descripción<textarea maxLength={2000} rows={3} value={section.description} onChange={event => updateSection("description", event.target.value)} /></label>
            <div className="field-grid">
              <label>Categoría de origen<select value={section.categoryId} onChange={event => updateSection("categoryId", event.target.value)}>
                <option value="">Todas</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
              <label>Máximo de elementos<input type="number" min={1} max={48} value={section.limit} onChange={event => updateSection("limit", Number(event.target.value))} /></label>
            </div>
            <MediaPicker key={section.id} label="Multimedia" multiple ordered initial={knownAssets.filter(asset => section.media.includes(asset.id))}
              selected={section.media} onChange={(ids, items) => { rememberAssets(items); updateSection("media", ids); }} />
            <div className="field-grid">
              <label>Texto del enlace<input maxLength={140} value={section.button} onChange={event => updateSection("button", event.target.value)} /></label>
              <label>URL del enlace<input type="url" value={section.url} onChange={event => updateSection("url", event.target.value)} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={section.hidden} onChange={event => updateSection("hidden", event.target.checked)} /> Ocultar temporalmente</label>
            <div className="export-links">
              <button className="button" type="button" disabled={layout.sections.length >= 32} onClick={() => insert({ ...section, id: crypto.randomUUID() })}>Duplicar</button>
              <button className="button danger" type="button" onClick={() => removeDialog.current?.showModal()}>Eliminar sección</button>
            </div>
            <ConfirmDialog dialog={removeDialog} title="¿Eliminar esta sección del diseño?" label="Eliminar sección" onConfirm={() => {
              const next = layout.sections.filter(item => item.id !== section.id);
              setLayout({ ...layout, sections: next });
              select(next[0]?.id ?? "");
            }} />
          </div>
        </section>}

        <section className="panel"><h2>Configuración general</h2>
          <div className="action-form">
            <label>Nombre del restaurante<input required maxLength={140} value={style.name} onChange={event => updateStyle("name", event.target.value)} /></label>
            <label>Descripción<textarea maxLength={2000} rows={3} value={style.description} onChange={event => updateStyle("description", event.target.value)} /></label>
            <div className="field-grid">{(["logoId", "coverId"] as const).map(key => <MediaPicker key={key} label={key === "logoId" ? "Logotipo" : "Portada"}
              images={key === "logoId"} initial={knownAssets.filter(asset => asset.id === style[key])}
              selected={style[key] ? [style[key]] : []}
              onChange={(ids, items) => { rememberAssets(items); updateStyle(key, ids[0] ?? ""); }} />)}</div>
            <div className="field-grid">{(["primary", "secondary", "background"] as const).map(key => <label key={key}>{({ primary: "Color principal", secondary: "Color secundario", background: "Fondo" })[key]}
              <input type="color" value={style[key]} onChange={event => updateStyle(key, event.target.value)} />
            </label>)}</div>
            <div className="field-grid">{(Object.keys(settings) as (keyof typeof settings)[]).map(key => <label key={key}>{labels[key]}<select value={style[key]}
              onChange={event => updateStyle(key, event.target.value as VisualLayout["style"][typeof key])}>
              {settings[key].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>)}</div>
            {(Object.keys(flags) as (keyof typeof flags)[]).map(key => <label className="check" key={key}>
              <input type="checkbox" checked={style[key]} onChange={event => updateStyle(key, event.target.checked)} /> {flags[key]}</label>)}
            <label>Texto del botón de pedido<input maxLength={140} value={style.orderButton} onChange={event => updateStyle("orderButton", event.target.value)} /></label>
            <div className="export-links"><Link className="button small" href="/admin/pedidos">Contacto, redes y WhatsApp</Link>
              <Link className="button small" href="/admin/horarios">Horarios generales</Link><Link className="button small" href="/admin/monedas">Monedas y precios</Link></div>
          </div>
        </section>
      </div>
    </div>

    {preview && state.revision && <section className="panel preview-stage">
      <div className="panel-heading"><h2>Vista previa del borrador</h2>
        <div className="export-links">
          <button className="button small" type="button" aria-pressed={mode === "mobile"} onClick={() => setMode("mobile")}>Móvil</button>
          <button className="button small" type="button" aria-pressed={mode === "desktop"} onClick={() => setMode("desktop")}>Escritorio</button>
          <button className="button small" type="button" onClick={() => setPreview(false)}>Cerrar vista previa</button>
        </div>
      </div>
      <div className="preview-scroll"><iframe key={state.revision} title={"Vista previa " + mode} src={"/admin/preview?v=" + state.revision} width={mode === "mobile" ? 390 : 1100} height={mode === "mobile" ? 720 : 680} /></div>
    </section>}
  </div>;
}
