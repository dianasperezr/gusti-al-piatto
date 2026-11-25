"use client";

import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Boxes, CalendarDays, Clapperboard, Contact, Grid2X2, GripVertical, Image as ImageIcon, Images, LayoutList, Maximize2, PanelBottom, PanelTop, PanelsTopLeft, Sparkles, Tag, Utensils } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useRef, useState } from "react";
import { MediaPicker, type MediaOption } from "@/modules/media/picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { saveVisualForm } from "./layout-actions";
import { emptySection, sectionControls, sectionNames, sectionPresentations, sectionTitle, type SectionKind, type VisualLayout, type VisualSection } from "./layout-schema";
import "./layout-editor.css";

type Resource = { id: string; name: string; mime?: string };
const pairs = Object.entries(sectionNames) as [SectionKind, string][];
const sectionIcons = {
  hero: PanelTop, banner: ImageIcon, catalog: Utensils, daily: CalendarDays, featured: Sparkles,
  combos: Boxes, promotions: Tag, gallery: Images, videos: Clapperboard, info: PanelsTopLeft, contact: Contact, footer: PanelBottom,
};
const presentationIcons = { grid: Grid2X2, list: LayoutList, wide: Maximize2 };
const settings = {
  typography: [["classic", "Clásica"], ["modern", "Moderna"], ["editorial", "Editorial"]],
  icon: [["utensils", "Marca Gusti"], ["leaf", "Hoja"], ["none", "Ocultar icono"]],
  headerStyle: [["minimal", "Minimalista"], ["photo", "Con fotografía"], ["banner", "Con banner"], ["compact", "Compacto"], ["integrated", "Navegación integrada"]],
  navigation: [["horizontal", "Horizontal"], ["side", "Lateral"], ["tabs", "Pestañas"], ["none", "Oculta"]],
} as const;

function SectionRow({ section, restaurant, selected, onSelect }: { section: VisualSection; restaurant: string; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const Icon = sectionIcons[section.type];
  return <li ref={setNodeRef} className="visual-row" style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button type="button" className="button small drag-handle" {...attributes} {...listeners} aria-label={"Reordenar " + sectionNames[section.type]}><GripVertical size={18} /></button>
    <button type="button" className="visual-row-button" onClick={onSelect} aria-pressed={selected}>
      <span className="visual-row-icon"><Icon size={17} aria-hidden="true" /></span>
      <span><strong>{sectionTitle(section, restaurant) || "Del corazón a la mesa."}</strong>
        <small>{sectionNames[section.type]}{section.hidden ? " · Oculta" : ""}</small></span>
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
  const [previewSection, setPreviewSection] = useState("");
  const [state, action, pending] = useActionState(saveVisualForm, {});
  const removeDialog = useRef<HTMLDialogElement>(null);
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const section = layout.sections.find(item => item.id === selectedId);
  const style = layout.style;
  const controls = section && sectionControls[section.type];
  const useCover = ["photo", "banner", "integrated"].includes(style.headerStyle);
  const SectionIcon = section ? sectionIcons[section.type] : null;

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
    navigation: "Navegación",
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
        <button className="button" name="operation" value="draft" disabled={pending} onClick={() => {
          setPreview(true);
          setPreviewSection(section?.hidden ? "" : section?.id ?? "");
        }}>Guardar y ver vista previa</button>
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
            <ol className="visual-list">{layout.sections.map(item => <SectionRow key={item.id} section={item} restaurant={style.name} selected={selectedId === item.id} onSelect={() => select(item.id)} />)}</ol>
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
        {section && controls && SectionIcon && <section className="panel">
          <h2 className="visual-section-title"><span className="visual-row-icon"><SectionIcon size={20} aria-hidden="true" /></span> {sectionNames[section.type]}</h2>
          <div className="action-form">
            <label>Tipo de sección<select value={section.type} onChange={event => {
              const type = event.target.value as SectionKind;
              setLayout(current => ({ ...current, sections: current.sections.map(item => item.id === section.id
                ? { ...item, type, title: item.title === sectionNames[item.type] ? sectionNames[type] : item.title } : item) }));
            }}>{pairs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Título<input maxLength={140} value={section.title} placeholder={section.type === "hero" ? "Del corazón a la mesa." : sectionTitle({ ...section, title: "" }, style.name)}
              onChange={event => updateSection("title", event.target.value)} /></label>
            <label>Descripción<textarea maxLength={2000} rows={3} value={section.description}
              placeholder={section.type === "hero" ? style.description : section.type === "footer" ? "Del corazón a la mesa" : undefined}
              onChange={event => updateSection("description", event.target.value)} /></label>
            {controls.layout && <fieldset>
              <legend>Presentación</legend>
              <div className="visual-presentations">{(Object.keys(sectionPresentations) as VisualSection["layout"][]).map(value => {
                const Icon = presentationIcons[value];
                return <button type="button" key={value} className="button" aria-pressed={section.layout === value} onClick={() => updateSection("layout", value)}>
                  <Icon size={19} aria-hidden="true" /> {sectionPresentations[value]}
                </button>;
              })}</div>
            </fieldset>}
            {(controls.category || controls.limit) && <div className="field-grid">
              {controls.category && <label>Categoría<select value={section.categoryId} onChange={event => updateSection("categoryId", event.target.value)}>
                <option value="">Todas</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>}
              {controls.limit && <label>{section.type === "catalog" ? "Platillos por categoría" : "Máximo de elementos"}
                <input type="number" min={1} max={48} value={section.limit || ""} onChange={event => updateSection("limit", Number(event.target.value))} /></label>}
            </div>}
            {controls.media && (section.type !== "hero" || useCover) && <MediaPicker key={section.id + section.type}
              label={controls.media === "one" ? "Imagen o video de la sección" : controls.media === "images" ? "Imágenes" : controls.media === "videos" ? "Videos" : "Imágenes y videos"}
              multiple={controls.media !== "one"} ordered={controls.media !== "one"} maxSelections={16} images={controls.media === "images"} videos={controls.media === "videos"}
              initial={knownAssets.filter(asset => section.media.includes(asset.id))}
              selected={section.media.filter(id => {
                const asset = knownAssets.find(item => item.id === id);
                return controls.media === "images" ? asset?.mime.startsWith("image/") : controls.media === "videos" ? asset?.mime.startsWith("video/") : true;
              }).slice(0, controls.media === "one" ? 1 : 16)} onChange={(ids, items) => { rememberAssets(items); updateSection("media", ids); }} />}
            <div className="field-grid">
              <label>Texto del botón<input maxLength={140} value={section.button} placeholder={section.type === "hero" ? "Descubrir el menú" : section.type === "contact" ? "Cómo llegar" : undefined} onChange={event => updateSection("button", event.target.value)} /></label>
              <label>Destino del botón<input type="url" placeholder="https://" value={section.url} onChange={event => updateSection("url", event.target.value)} /></label>
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

        <details className="panel visual-global"><summary>Configuración general</summary>
          <div className="action-form">
            <label>Nombre del restaurante<input required maxLength={140} value={style.name} onChange={event => updateStyle("name", event.target.value)} /></label>
            <label>Descripción<textarea maxLength={2000} rows={3} value={style.description} onChange={event => updateStyle("description", event.target.value)} /></label>
            <div className="field-grid">{(["logoId", "coverId"] as const).filter(key => key === "logoId" || useCover).map(key => <MediaPicker key={key} label={key === "logoId" ? "Logotipo" : "Portada predeterminada"}
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
            <label>Texto predeterminado del botón de pedido<input maxLength={140} value={style.orderButton} onChange={event => updateStyle("orderButton", event.target.value)} /></label>
            <div className="export-links"><Link className="button small" href="/admin/pedidos">Contacto, redes y WhatsApp</Link>
              <Link className="button small" href="/admin/horarios">Horarios generales</Link><Link className="button small" href="/admin/monedas">Monedas y precios</Link></div>
          </div>
        </details>
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
      <div className="preview-scroll"><iframe key={state.revision} title={"Vista previa " + mode} src={"/admin/preview?v=" + state.revision + (previewSection ? "#" + previewSection : "")} width={mode === "mobile" ? 390 : 1100} height={mode === "mobile" ? 720 : 680} /></div>
    </section>}
  </div>;
}
