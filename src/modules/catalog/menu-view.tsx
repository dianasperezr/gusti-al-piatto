"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ItemMedia, ProductGallery, ProductThumbnail } from "./item-media";
import type { Selections } from "../products/options";
import { cartIdentity, parseCart, type Cart } from "../orders/cart";
import type { QuoteReply } from "../orders/checkout";
import { sectionControls, sectionTitle, type VisualSection } from "../appearance/layout-schema";
import { ArrowLeft, Clock3, GlassWater, Leaf, MapPin, MessageCircle, Minus, Package, Plus, Search, ShoppingBag, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { MenuData } from "./menu";
import { formatPrice, unitCents, quoteCart, convertCents, itemMediaList, previewMedia, type CatalogItem, type Currency, type PublicMedia } from "./pricing";
import "./menu-theme.css";

const cartKey = "gusti-cart-v1";
const empty = "{}";
const cartEvent = "gusti-cart-change";
const uncategorized = "sin-categoria";
const menuAssets = "/gusti-menu";
const searchText = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const ItemOptions = dynamic(() => import("./item-options").then(module => module.ItemOptions), {
  loading: () => <p role="status">Cargando opciones…</p>,
});
const ValidatedSummary = dynamic(() => import("../orders/summary").then(module => module.ValidatedSummary), {
  loading: () => <p role="status">Cargando resumen…</p>,
});

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(cartEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(cartEvent, callback);
  };
}

let memoryCart: string | undefined;
function readCart() {
  try { return memoryCart ?? localStorage.getItem(cartKey) ?? empty; }
  catch { return memoryCart ?? empty; }
}

function writeCart(value: Cart) {
  const state = JSON.stringify(value);
  try { localStorage.setItem(cartKey, state); memoryCart = undefined; }
  catch { memoryCart = state; }
  window.dispatchEvent(new Event(cartEvent));
}

const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function luminance(hex: string) {
  const colors = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return colors[0] * 0.2126 + colors[1] * 0.7152 + colors[2] * 0.0722;
}

function contrastingInk(background: string, preferred?: string) {
  const light = luminance(background);
  if (preferred) {
    const ink = luminance(preferred);
    if ((Math.max(light, ink) + 0.05) / (Math.min(light, ink) + 0.05) >= 4.5) return preferred;
  }
  return light > 0.179 ? "#000000" : "#ffffff";
}

const currencyEvent = "gusti-currency-change";
let memoryCurrency = "";
function subscribeCurrency(callback: () => void) {
  window.addEventListener(currencyEvent, callback);
  return () => window.removeEventListener(currencyEvent, callback);
}
function savedCurrency() {
  try { return sessionStorage.getItem("gusti-currency") ?? memoryCurrency; } catch { return memoryCurrency; }
}

export function MenuView({ menu, preview = false }: { menu: MenuData; preview?: boolean }) {
  const storedCurrency = useSyncExternalStore(subscribeCurrency, savedCurrency, () => "");
  const [previewCurrency, setPreviewCurrency] = useState<Currency>(menu.base);
  const preference = preview ? previewCurrency : storedCurrency;
  const currency = (preference === "MXN" || preference === "USD") && menu.money.enabled.includes(preference) ? preference : menu.base;
  const [previewCart, setPreviewCart] = useState<Cart>({});
  const style = menu.visual?.style;
  const price = (amount: number) => formatPrice(amount, currency, menu.money);
  function setCurrency(value: Currency) {
    if (preview) { setPreviewCurrency(value); return; }
    memoryCurrency = value;
    try { sessionStorage.setItem("gusti-currency", value); } catch {}
    window.dispatchEvent(new Event(currencyEvent));
  }
  const [detailId, setDetailId] = useState("");
  const [detailNotice, setDetailNotice] = useState("");
  const detailsDialog = useRef<HTMLDialogElement>(null);
  const detailItem = menu.items.find(item => item.id === detailId);
  useEffect(() => {
    if (detailId && !detailItem) detailsDialog.current?.close();
  }, [detailId, detailItem]);
  const [tabCategory, setTabCategory] = useState("");
  const [query, setQuery] = useState("");
  const search = searchText(query.trim());
  const router = useRouter();
  useEffect(() => {
    if (!menu.refresh) return;
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [menu.refresh, router]);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState("");
  const [notice, setNotice] = useState("");
  const [feedbackSequence, incrementFeedback] = useState(0);
  const [review, setReview] = useState<(QuoteReply & { signature: string }) | null>(null);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cartContent = useRef<HTMLDivElement>(null);
  const clearDialog = useRef<HTMLDialogElement>(null);
  const storedCart = useSyncExternalStore(subscribe, readCart, () => empty);
  const savedCart = useMemo(() => parseCart(storedCart), [storedCart]);
  const cart = preview ? previewCart : savedCart;
  const cartEnabled = style?.cartVisible !== false && (preview || menu.contact.cartEnabled);
  const ordersEnabled = cartEnabled && (preview || menu.contact.ordering && !!menu.contact.whatsapp);
  const canOrder = ordersEnabled && (preview || menu.orderOpen);
  const { itemsById, productsByCategory, combos } = useMemo(() => {
    const itemsById = new Map<string, CatalogItem>();
    const productsByCategory = new Map<string, CatalogItem[]>();
    const combos: CatalogItem[] = [];
    for (const item of menu.items) {
      itemsById.set(item.id, item);
      if (item.kind === "COMBO") combos.push(item);
      else {
        const category = item.categoryId ?? uncategorized;
        const products = productsByCategory.get(category) ?? [];
        products.push(item);
        productsByCategory.set(category, products);
      }
    }
    return { itemsById, productsByCategory, combos };
  }, [menu.items]);
  const entries = Object.entries(cart).map(([key, line]) => ({
    key, line, item: itemsById.get(line.id),
  }));
  const quotes = quoteCart(entries.map(({ line, item }) => ({ ...line, item: item?.available ? item : undefined })), currency, menu.rate, menu.base, menu.money);
  const selected = entries.map((entry, index) => ({ ...entry, quote: quotes[index] }));
  const valid = selected.filter(row => row.item && row.quote);
  const invalid = valid.length !== selected.length;
  const total = valid.reduce((sum, row) => sum + (row.quote?.total ?? 0), 0);
  const signature = JSON.stringify({ currency, name, note, cart });
  const current = review?.signature === signature ? review : null;
  const count = selected.reduce((sum, row) => sum + row.line.quantity, 0);
  const currentId = current?.id;
  useEffect(() => { if (cartContent.current) cartContent.current.scrollTop = 0; }, [currentId]);

  function store(next: Cart) {
    if (preview) setPreviewCart(next);
    else writeCart(next);
    setReview(null);
    setOpened(false);
    setError("");
  }

  function update(key: string, amount: number) {
    const line = cart[key];
    if (!line || line.quantity + amount > 20) return;
    const next = { ...cart };
    if (line.quantity + amount <= 0) delete next[key];
    else next[key] = { ...line, quantity: line.quantity + amount };
    store(next);
  }

  function add(item: CatalogItem, selections: Selections = []) {
    const matching = Object.entries(cart).find(([, line]) => cartIdentity(line.id, line.selections, line.note) === cartIdentity(item.id, selections));
    if (matching) {
      if (matching[1].quantity >= 20) { cartLimit("El carrito admite hasta 20 unidades por selección."); return; }
      update(matching[0], 1);
    } else {
      if (selected.length >= 25) { cartLimit("El carrito admite hasta 25 selecciones distintas."); return; }
      const observedBaseUnit = quoteCart([{ item, quantity: 1, selections }], menu.base, menu.rate, menu.base, menu.money)[0]?.unit;
      store({ ...cart, [crypto.randomUUID()]: { id: item.id, quantity: 1, selections, note: "", observedBaseUnit } });
    }
    setNotice(item.name + " se agregó al carrito.");
    incrementFeedback(value => value + 1);
    detailsDialog.current?.close();
  }

  function cartLimit(message: string) {
    if (detailsDialog.current?.open) setDetailNotice(message);
    else {
      setNotice(message);
      incrementFeedback(value => value + 1);
    }
  }

  function editLine(key: string, selections: Selections) {
    const line = cart[key];
    const item = menu.items.find(entry => entry.id === line.id);
    const observedBaseUnit = quoteCart([{ item, quantity: 1, selections }], menu.base, menu.rate, menu.base, menu.money)[0]?.unit;
    store({ ...cart, [key]: { ...line, selections, observedBaseUnit } });
    setEditing("");
  }

  function requestLines() {
    const merged = new Map<string, (typeof valid)[number]["line"]>();
    for (const { line } of valid) {
      const identity = cartIdentity(line.id, line.selections, line.note);
      const quantity = (merged.get(identity)?.quantity ?? 0) + line.quantity;
      if (quantity > 20) throw new Error("Reduce las unidades de las selecciones idénticas a un máximo de 20.");
      merged.set(identity, { ...line, quantity });
    }
    return [...merged.values()].map(({ id, quantity, selections, note }) => ({ id, quantity, selections, note }));
  }

  async function prepare(confirm = false) {
    if (preview || busy || !canOrder || invalid) return;
    setBusy(true);
    setError("");
    setOpened(false);
    try {
      const response = await fetch("/api/order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, name, note, lines: requestLines(), confirmation: confirm && current
          ? { id: current.id, fingerprint: current.fingerprint } : undefined }),
      });
      const result = await response.json() as QuoteReply & { error?: string };
      if (!response.ok) {
        setReview(null);
        if (response.status === 409) router.refresh();
        throw new Error(result.error ?? "No se pudo validar la solicitud.");
      }
      setReview({ ...result, signature });
      const changedSinceAdd = !confirm && result.summary.lines.some(serverLine => valid.some(({ line }) =>
        line.observedBaseUnit !== undefined && line.observedBaseUnit !== serverLine.baseUnit &&
        cartIdentity(line.id, line.selections, line.note) === cartIdentity(serverLine.id, serverLine.selections, serverLine.note)));
      if (result.changed || (!confirm && result.summary.total !== total) || changedSinceAdd) {
        setError("El importe cambió. Revisa el resumen actualizado antes de confirmar.");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo preparar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  const categoryNames = new Map(menu.categories.map(category => [category.id, category.name]));
  function itemKind(item: CatalogItem) {
    if (item.kind === "COMBO") return "combo";
    const category = item.categoryId ? categoryNames.get(item.categoryId) : "";
    const label = searchText([category, item.subcategory].join(" "));
    return /\b(bebidas?|refrescos?|cocteles?|cafes?|vinos?|cervezas?|jugos?|licuados?)\b/.test(label) ? "drink" : "dish";
  }

  function showDetails(item: CatalogItem) {
    setDetailId(item.id);
    setDetailNotice("");
    detailsDialog.current?.showModal();
  }

  function card(item: CatalogItem, anchor = false) {
    const kind = itemKind(item);
    const assets = itemMediaList(item);
    return (
      <article key={item.id} id={anchor && item.slug ? "platillo-" + item.slug : undefined} className="menu-card product-card">
        {assets.length > 1 ? <ProductGallery assets={assets} name={item.name} kind={kind} onOpen={() => showDetails(item)} />
          : <ProductThumbnail media={assets[0]} kind={kind} />}
        {(item.featured || kind !== "dish") && <div className="product-badges">
          {item.featured && <span className="product-badge"><Sparkles size={15} aria-hidden="true" /><span className="sr-only">Destacado</span></span>}
          {kind === "combo" && <span className="product-badge"><Package size={15} aria-hidden="true" /><span className="sr-only">Combo</span></span>}
          {kind === "drink" && <span className="product-badge"><GlassWater size={15} aria-hidden="true" /><span className="sr-only">Bebida</span></span>}
        </div>}
        <div className="item-body">
          <h3><button className="product-open" type="button" onClick={() => showDetails(item)} aria-haspopup="dialog">{item.name}</button></h3>
          {item.description && <p className="product-description">{item.description}</p>}
          <div className="item-footer">
            <span className="item-price">{price(unitCents(item, currency, menu.rate, menu.base, menu.money))}</span>
            {canOrder && item.available
              ? <button className="button small add-to-cart product-add" type="button" onClick={() => item.groups.length ? showDetails(item) : add(item)} aria-label={`Agregar ${item.name} al carrito`}><Plus size={17} aria-hidden="true" /></button>
              : !item.available && <span className="muted">No disponible</span>}
          </div>
        </div>
      </article>
    );
  }

  function cartThumbnail(id: string) {
    const item = itemsById.get(id);
    return <ProductThumbnail media={item && previewMedia(item)} kind={item ? itemKind(item) : "dish"} />;
  }

  const categories = [...menu.categories, {
    id: uncategorized, name: menu.categories.length ? "Otros platillos" : "Platillos", description: "", media: null,
  }].filter(category => productsByCategory.has(category.id));

  function catalog(categoryId = "", limit = Infinity, anchorFor: (id: string) => boolean = () => true) {
    const groups = categories.filter(group => !categoryId || group.id === categoryId).flatMap(group => {
      const items = (productsByCategory.get(group.id) ?? []).filter(item => !search || searchText(
        [item.name, item.description, item.details, group.name, item.subcategory, ...(item.ingredients ?? [])].join(" "),
      ).includes(search)).slice(0, limit);
      if (!items.length) return [];
      const anchor = anchorFor(group.id);
      return [<section key={group.id} className="menu-group" id={anchor ? group.id : undefined}>
        <h3 className="group-title">{group.name}</h3>
        {group.media && <div className="section-image"><ItemMedia media={group.media} name={group.name} /></div>}
        {group.description && <p className="muted">{group.description}</p>}
        <div className="menu-grid">{items.map(item => card(item, anchor))}</div>
      </section>];
    });
    return groups.length > 0 ? groups : <p className="empty-menu" role="status">
      {search ? "No encontramos platillos con esa búsqueda." : "Todavía no hay platillos publicados."}
    </p>;
  }

  function promotions(limit = Infinity) {
    return <div className="menu-grid">{menu.promotions.slice(0, limit).map(promotion => <article className={promotion.banner ? "menu-card promo-banner" : "menu-card"} key={promotion.id}>
      {promotion.media && <div className={"item-image" + (promotion.media.video ? " item-video" : "")}><ItemMedia media={promotion.media} name={promotion.name} /></div>}
      <div className="item-body"><h3>{promotion.name}</h3><p>{promotion.description}</p>
        {promotion.method === "percent" && <strong>{promotion.amount}% de descuento</strong>}
        {(promotion.method === "fixed" || promotion.method === "price") && <strong>{promotion.method === "fixed" ? "Descuento de " : "Precio promocional "}
          {price(convertCents(promotion.amount, menu.base, currency, menu.rate, menu.money))}</strong>}{promotion.restrictions && <small>{promotion.restrictions}</small>}</div>
    </article>)}</div>;
  }

  const customTypes = new Set(menu.sections.map(section => section.type));
  const showCatalog = !customTypes.has("catalog");
  const navigation = style && style.navigation !== "none" && style.categoryNavigation;
  const integrated = navigation && style.headerStyle === "integrated";
  const menuTabs = !style || navigation && !integrated && ["horizontal", "tabs"].includes(style.navigation);
  const visualCatalogs = menu.visual?.sections.filter(section => section.type === "catalog") ?? [];
  const activeCategories = style ? categories.filter(category => visualCatalogs.some(section => !section.categoryId || section.categoryId === category.id)) : categories;
  const categoryButtons = menuTabs || navigation && style.navigation === "tabs";
  const selectedTab = !search && categoryButtons && activeCategories.some(category => category.id === tabCategory) ? tabCategory : "";
  const menuAnchor = visualCatalogs[0]?.id ?? "menu-digital";
  const contactAnchor = menu.visual ? menu.visual.sections.find(section => section.type === "contact")?.id : "visitanos";
  const pastaCategory = activeCategories.find(category => searchText(category.name).includes("pasta"));
  function selectCategory(id: string) {
    setTabCategory(id);
    setQuery("");
  }
  const gallery = (assets: PublicMedia[], name: string) => assets.length > 0 && <div className="menu-grid section-assets">{assets.map((asset, index) =>
    <div className="item-image" key={asset.src + index}><ItemMedia media={asset} name={name} /></div>)}</div>;
  const categoryNav = (location: string) => activeCategories.length > 0 && <nav className={"category-nav visual-nav visual-nav-" + location} aria-label="Categorías">
    {categoryButtons ? <>
      <button type="button" aria-pressed={!search && !selectedTab} onClick={() => selectCategory("")}>Todas</button>
      {activeCategories.map(category => <button type="button" aria-pressed={selectedTab === category.id} onClick={() => selectCategory(category.id)} key={category.id}>{category.name}</button>)}
    </> : activeCategories.map(category => <a href={"#" + category.id} key={category.id} onClick={() => setQuery("")}>{category.name}</a>)}
  </nav>;
  const menuTools = <div className="menu-tools">
    {menuTabs && categoryNav("in-menu")}
    <label className="menu-search">
      <Search size={17} aria-hidden="true" /><span className="sr-only">Buscar un platillo o ingrediente</span>
      <input type="search" placeholder="Platillo o ingrediente" value={query} onChange={event => setQuery(event.target.value)} />
    </label>
  </div>;
  const outsideHours = ordersEnabled && !canOrder && <p className="empty-menu">{menu.contact.outsideText || "El restaurante está fuera de su horario de pedidos."}</p>;

  function hero(title: string, description: string, asset = menu.cover, section?: VisualSection) {
    const photo = !style || ["photo", "banner", "integrated"].includes(style.headerStyle);
    const cover = asset ?? { src: menuAssets + "/pizza.webp", video: false };
    const ctaUrl = section?.url || (!menu.visual || visualCatalogs.length > 0 ? "#" + menuAnchor : "");
    return <><section className={"restaurant-hero" + (photo ? "" : " hero-plain")} id={section?.id}>
      <div className="hero-copy">
        <span className="eyebrow">{menu.appearance.eyebrow === "Cocina italiana" || !menu.appearance.eyebrow ? "Pizza a la leña · Narvarte" : menu.appearance.eyebrow}</span>
        <h1>{title || <>Del corazón<br />a la <em>mesa.</em></>}</h1>
        {description && <p>{description}</p>}
        {ctaUrl && <a href={ctaUrl} className="hero-link">{section?.button || "Descubrir el menú"}</a>}
        <span className="hero-location">{menu.name} · Ciudad de México</span>
      </div>
      {photo && <div className="hero-media">
        <ItemMedia media={cover} name={menu.name} hero />
        {!cover.video && <div className="photo-note">El gusto de compartir<span>Hecho para disfrutarse juntos</span></div>}
      </div>}
    </section>
    <div className="restaurant-ribbon">
      <span>Al horno de leña</span><span aria-hidden="true">✦</span><span>Del corazón a la mesa</span><span aria-hidden="true">✦</span><span>{menu.name}</span>
    </div></>;
  }
  function story() {
    return <section className="restaurant-story">
      <div className="story-photo"><Image src={menuAssets + "/pasta.webp"} alt="Pasta de Gusti Al Piatto" fill sizes="(max-width: 800px) 100vw, 50vw" className="cover-media" /></div>
      <div className="story-copy">
        <p className="eyebrow">Para disfrutar a tu ritmo</p>
        <h2>Hoy se come<br /><em>con gusto.</em></h2>
        <p>De las entradas al último bocado de postre. Encuentra lo que se te antoja hoy.</p>
        {(!menu.visual || visualCatalogs.length > 0) && <a className="story-link" href={"#" + (pastaCategory && !categoryButtons ? pastaCategory.id : menuAnchor)} onClick={() => selectCategory(pastaCategory?.id ?? "")}>
          {pastaCategory ? "Explorar las pastas" : "Explorar el menú"}
        </a>}
      </div>
    </section>;
  }
  function contact(title = "Tu próxima mesa.", section?: VisualSection) {
    const address = menu.contact.address;
    return <section className="visit" id={section?.id ?? "visitanos"}>
      <div><p className="eyebrow">Visítanos</p><h2>{title}</h2>{section?.description && <p>{section.description}</p>}
        {address && <>
          <p>{address}</p>
          {!section?.url && <a className="hero-link" href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address)} target="_blank" rel="noopener noreferrer"><MapPin size={17} aria-hidden="true" /> {section?.button || "Cómo llegar"}</a>}
        </>}
        {section?.url && <a href={section.url} className="hero-link">{section.button || "Cómo llegar"}</a>}
        {menu.contact.phone && <p>{menu.contact.phone}</p>}
        <div className="socials">
          {menu.contact.instagram && <a href={menu.contact.instagram}>Instagram</a>}
          {menu.contact.facebook && <a href={menu.contact.facebook}>Facebook</a>}
          {menu.contact.whatsapp && !preview && <a href={"https://wa.me/" + menu.contact.whatsapp}>WhatsApp</a>}
        </div>
      </div>
      <div className="visit-hours"><h3>Horario</h3>{menu.hours.length ? <dl>{menu.hours.map(day => <div key={day.id}>
        <dt>{day.date || (day.days.length ? day.days.map(index => weekdays[index]).join(", ") : "Todos los días")}</dt>
        <dd>{day.mode === "closed" ? "Cierre especial · " : ""}{day.opens === day.closes ? "Todo el día" : day.opens + "–" + day.closes}</dd>
      </div>)}</dl> : <p>Por publicar.</p>}</div>
    </section>;
  }
  function footer(title = menu.name, section?: VisualSection) {
    return <footer className="restaurant-footer" id={section?.id}>
      <div className="menu-container">
        <strong>{title}</strong><span>{section?.description || "Del corazón a la mesa"}</span>
        {section?.button && section.url && <a href={section.url}>{section.button}</a>}
        {!preview && <Link href="/admin">Administración</Link>}
      </div>
    </footer>;
  }
  const visualSections = menu.visual?.sections.map(section => {
    const controls = sectionControls[section.type];
    const title = sectionTitle(section, menu.name);
    const categoryId = controls.category ? section.categoryId : "";
    const items = menu.items.filter(item => !categoryId || item.categoryId === categoryId);
    const catalogVisible = section.type !== "catalog" || !selectedTab || !categoryId || categoryId === selectedTab;
    const firstCatalog = section.id === visualCatalogs[0]?.id;
    if (section.type === "catalog" && !catalogVisible && !firstCatalog) return null;
    if (section.type === "hero") return <div key={section.id}>{hero(title, section.description || menu.headline, section.assets[0] ?? menu.cover, section)}</div>;
    if (section.type === "contact") return <div key={section.id}>
      {section.id === contactAnchor && story()}
      {contact(title, section)}
    </div>;
    if (section.type === "footer") return <div key={section.id}>{footer(title, section)}</div>;
    const cards = (filter: (item: CatalogItem) => boolean) => <div className="menu-grid">{items.filter(filter).slice(0, section.limit).map(item => card(item))}</div>;
    const content = {
      catalog: () => catalogVisible && catalog(selectedTab || categoryId, section.limit, id => visualCatalogs.find(candidate => !candidate.categoryId || candidate.categoryId === id)?.id === section.id),
      daily: () => cards(item => item.kind === "PRODUCT" && item.available),
      featured: () => cards(item => item.featured),
      combos: () => cards(item => item.kind === "COMBO"),
      promotions: () => promotions(section.limit),
      gallery: () => gallery(section.assets.filter(asset => !asset.video).slice(0, section.limit), title),
      videos: () => gallery(section.assets.filter(asset => asset.video).slice(0, section.limit), title),
      banner: () => null,
      info: () => gallery(section.assets.slice(0, section.limit), title),
    };
    const cover = controls.media === "one" ? section.assets[0] : undefined;
    return <section className={"visual-section section-" + (controls.layout ? section.layout : "wide") + " component-" + section.type} key={section.id} id={section.id}>
      {firstCatalog ? <div className="menu-title"><div>
        <span className="eyebrow">Elige tu antojo</span>
        <h2>{catalogVisible ? title : "Nuestro menú"}</h2>
      </div>{menu.hours.length > 0 && contactAnchor && <a className="hours-link" href={"#" + contactAnchor}><Clock3 size={17} aria-hidden="true" /> Horarios</a>}</div>
        : title && <h2 className="group-title">{title}</h2>}
      {catalogVisible && section.description && <p>{section.description}</p>}
      {catalogVisible && cover && <div className="item-image section-cover"><ItemMedia media={cover} name={title} /></div>}
      {firstCatalog && <>{outsideHours}{menuTools}</>}
      {content[section.type]()}
      {catalogVisible && section.button && section.url && <a className="button" href={section.url}>{section.button}</a>}
    </section>;
  });
  const background = style?.background ?? menu.appearance.background;
  const accent = style?.primary ?? menu.appearance.accent;
  const secondary = style?.secondary ?? "#56603b";
  return (
    <div className={`restaurant menu-theme header-${style?.headerStyle ?? "photo"} type-${style?.typography ?? "classic"}${style?.compactMobile ? " nav-mobile-compact" : ""}${style?.fixedNavigation ? " nav-fixed" : ""}`} style={{
      "--restaurant-accent": accent, "--restaurant-background": background, "--restaurant-secondary": secondary,
      "--restaurant-accent-ink": contrastingInk(accent, "#fff8eb"),
      "--restaurant-secondary-ink": contrastingInk(secondary, "#fff5d8"), "--restaurant-ink": contrastingInk(background, "#29291f"),
      "--restaurant-muted": contrastingInk(background, "#605f55"), "--restaurant-accent-text": contrastingInk(background, accent),
      "--restaurant-paper-accent": contrastingInk("#fffdf8", accent),
    } as CSSProperties}>
      <a className="skip-menu button" href={"#" + menuAnchor}>Saltar al menú</a>
      <header className={"restaurant-header" + (style?.fixedHeader === false ? " header-static" : "")}>
        <div className="menu-container topbar">
          <a href="#inicio" className="restaurant-brand" aria-label={menu.name + ", inicio"}>
            {menu.logo ? <><Image src={menu.logo} width={44} height={44} alt="" loading="eager" unoptimized /><span>{menu.name}</span></>
              : !style || style.icon === "utensils" ? <Image src={menuAssets + "/logo.png"} width={675} height={197} alt={menu.name} className="gusti-logo" loading="eager" unoptimized />
              : <>{style.icon === "leaf" && <span className="brand-icon"><Leaf size={17} /></span>}<span>{menu.name}</span></>}
          </a>
          <div className="top-actions">
            <nav className="header-links" aria-label="Navegación principal">
              {(!menu.visual || visualCatalogs.length > 0) && <a href={"#" + menuAnchor}>Nuestro menú</a>}
              {contactAnchor && <a href={"#" + contactAnchor}>Visítanos</a>}
            </nav>
            {menu.money.enabled.length > 1 && <label className="currency-select"><span className="sr-only">Moneda</span><select value={currency} onChange={event => {
              setCurrency(event.target.value === "USD" ? "USD" : "MXN");
              setReview(null); setOpened(false);
            }}>{menu.money.enabled.map(code => <option key={code} value={code}>{code} {code === "MXN" ? menu.money.mxnSymbol || "$" : menu.money.usdSymbol || "US$"}</option>)}</select></label>}
            {(cartEnabled && (ordersEnabled || count > 0)) && <button type="button" className="cart-trigger" aria-haspopup="dialog" aria-label={`Carrito, ${count} artículos`} onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }}>
              <ShoppingBag size={17} /> <span>Carrito</span><strong>{count}</strong>
            </button>}
          </div>
        </div>
        {integrated && <div className="menu-container">{categoryNav("integrated")}</div>}
      </header>
      <main id="inicio">
        {menu.visual ? <div id="menu-digital" className={navigation && !integrated && style.navigation === "side" ? "visual-page visual-with-sidebar" : "visual-page"}>
          {navigation && !integrated && !menuTabs && categoryNav(style.navigation)}
          <div className="visual-content">{!visualCatalogs.length && outsideHours}{visualSections}</div>
        </div> : <>
          {hero("", menu.headline)}
        <section className="menu-content" id="menu-digital">
          <div className="menu-title"><div><span className="eyebrow">Elige tu antojo</span><h2>Nuestro menú</h2></div>
            {menu.hours.length > 0 && <a className="hours-link" href="#visitanos"><Clock3 size={17} /> Horarios</a>}
          </div>
          {outsideHours}
          {menuTools}
          {showCatalog && catalog(selectedTab)}
          {!customTypes.has("promotions") && menu.promotions.length > 0 && <section className="menu-group"><h3 className="group-title">Promociones</h3>{promotions()}</section>}
          {!customTypes.has("combos") && combos.length > 0 && <section className="menu-group"><h3 className="group-title">Paquetes</h3><div className="menu-grid">{combos.map(item => card(item))}</div></section>}
          {menu.sections.map(section => <section className="menu-group" key={section.id}>
            <h3 className="group-title">{section.name}</h3>
            {section.description && <p>{section.description}</p>}
            {section.media && <div className="section-image"><ItemMedia media={section.media} name={section.name} /></div>}
            {section.type === "catalog" && catalog(selectedTab)}
            {section.type === "promotions" && promotions()}
            {section.type === "combos" && <div className="menu-grid">{combos.map(item => card(item))}</div>}
            {section.label && section.url && <a className="button" href={section.url}>{section.label}</a>}
          </section>)}
        </section>
        {story()}
        {contact()}
        {footer()}
        </>}
      </main>
      {cartEnabled && (count > 0 || style?.fixedHeader === false && ordersEnabled) &&
        <button type="button" className={`cart-trigger cart-floating${style?.fixedHeader === false ? "" : " cart-mobile-only"}`}
          aria-haspopup="dialog" aria-label={`Ver carrito, ${count} artículos`} onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }}>
          <ShoppingBag size={19} aria-hidden="true" /> Ver carrito <strong>{count}</strong>
        </button>}
      <dialog ref={detailsDialog} className="product-dialog" aria-labelledby="product-title" onClick={event => {
        if (event.target === event.currentTarget) detailsDialog.current?.close();
      }} onClose={() => setDetailId("")}>
        <div className="product-sheet">
          <header className="product-sheet-heading">
            <div>
              {detailItem && <p className="eyebrow">{detailItem.kind === "COMBO" ? "Combo" : detailItem.categoryId ? categoryNames.get(detailItem.categoryId) : "Platillo"}</p>}
              <h2 id="product-title">{detailItem?.name}</h2>
            </div>
            <button type="button" className="button product-close" aria-label="Cerrar detalle" onClick={() => detailsDialog.current?.close()}><X size={20} aria-hidden="true" /></button>
          </header>
          {detailItem && <>
            <ProductGallery key={detailItem.id} assets={itemMediaList(detailItem)} name={detailItem.name} kind={itemKind(detailItem)} />
            {detailItem.description && <p>{detailItem.description}</p>}
            {detailItem.details && detailItem.details !== detailItem.description && <p>{detailItem.details}</p>}
            {!!detailItem.ingredients?.length && <div><h3>Ingredientes</h3><p>{detailItem.ingredients.join(", ")}</p></div>}
            {detailItem.nutrition && <div><h3>Información alimentaria</h3><p>{detailItem.nutrition}</p></div>}
            {detailItem.components.length > 0 && <div><h3>Incluye</h3><ul>{detailItem.components.map(component =>
              <li key={component.id}>{component.quantity} × {component.name}</li>)}</ul></div>}
            {detailItem.offers.some(offer => offer.method !== "notice") && <p>{detailItem.offers.filter(offer => offer.method !== "notice").map(offer => offer.name).join(" · ")}</p>}
            <p className="item-price">{price(unitCents(detailItem, currency, menu.rate, menu.base, menu.money))}</p>
            {!detailItem.available ? <p className="muted">No disponible</p> : canOrder && (detailItem.groups.length > 0
              ? <ItemOptions key={detailItem.id} item={detailItem} currency={currency} base={menu.base} rate={menu.rate} money={menu.money} onAdd={picks => add(detailItem, picks)} />
              : <button className="button primary" type="button" onClick={() => add(detailItem)}><Plus size={17} aria-hidden="true" /> Agregar al carrito</button>)}
            {detailNotice && <p className="form-error" role="alert">{detailNotice}</p>}
          </>}
        </div>
      </dialog>
      <dialog ref={dialog} className="cart-dialog cart-page-dialog" aria-labelledby="cart-title">
        <div className="cart-panel">
          <header className="cart-page-header"><div>
            <button type="button" className="cart-back" onClick={() => dialog.current?.close()}><ArrowLeft size={17} aria-hidden="true" /> Volver al menú</button>
            <h2 id="cart-title">Tu carrito</h2>
          </div><button type="button" className="button cart-close" aria-label="Cerrar carrito" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button></header>
          <div className="cart-content" ref={cartContent}>
          {!canOrder && <p className="muted">{ordersEnabled ? menu.contact.outsideText || "El restaurante está fuera de su horario de pedidos." : "Los pedidos están desactivados."}</p>}
          {!selected.length ? <p className="empty-menu">Tu carrito está vacío.</p> : <div className="action-form">
            {menu.contact.customerInstructions && <p>{menu.contact.customerInstructions}</p>}
            {menu.money.enabled.length > 1 && <label>Moneda del carrito<select disabled={busy} value={currency} onChange={event => {
              setCurrency(event.target.value === "USD" ? "USD" : "MXN"); setReview(null); setOpened(false);
            }}>{menu.money.enabled.map(code => <option key={code}>{code}</option>)}</select></label>}
            {invalid && <p role="alert" className="form-error">Algunos artículos o complementos ya no están disponibles. Actualiza la selección.</p>}
            {current ? <>
              <ValidatedSummary summary={current.summary} thumbnail={cartThumbnail} />
              <p>{opened ? (menu.contact.confirmationText || "Tu solicitud está preparada para que la envíes por WhatsApp.") : "Se abrirá WhatsApp con tu pedido preparado. Revisa el mensaje y presiona Enviar para compartirlo con el restaurante."}</p>
              {opened && <p role="status">La recepción se confirma directamente con el restaurante en WhatsApp.</p>}
            </> : <>
              <ul className="cart-items">{selected.map(({ key, item, line, quote }) => <li className="cart-editable-line" key={key}>
                {cartThumbnail(line.id)}
                <div className="cart-item-copy"><strong>{item?.name ?? "Artículo no disponible"}</strong>
                  {!quote && <span>No disponible</span>}
                  {quote?.labels.map(label => <small key={label}>{label}</small>)}
                  <label>Nota del platillo<input value={line.note} maxLength={160} disabled={busy}
                    onChange={event => store({ ...cart, [key]: { ...line, note: event.target.value } })} /></label>
                  {item?.available && item.groups.length > 0 && <button type="button" className="button small" disabled={busy} onClick={() => setEditing(editing === key ? "" : key)}>Editar variantes y complementos</button>}
                  {item?.available && editing === key && <ItemOptions item={item} currency={currency} base={menu.base} rate={menu.rate} money={menu.money}
                    initial={line.selections} submitLabel="Guardar selección" onAdd={selections => editLine(key, selections)} />}
                </div>
                <div className="quantities">
                  <button className="circle-button" type="button" aria-label={"Quitar una unidad de " + (item?.name ?? "artículo")} onClick={() => update(key, -1)} disabled={busy}><Minus size={14} /></button>
                  <span>{line.quantity}</span>
                  <button className="circle-button" type="button" aria-label={"Agregar una unidad de " + (item?.name ?? "artículo")} onClick={() => update(key, 1)} disabled={busy || !quote || line.quantity >= 20}><Plus size={14} /></button>
                  <button className="button small" type="button" onClick={() => update(key, -line.quantity)} disabled={busy}>Eliminar</button>
                </div>
              </li>)}</ul>
              <label>Nombre (opcional)<input maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
              <label>Notas generales (opcional)<textarea maxLength={300} rows={2} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
              {menu.contact.logRequests && <p className="muted">El restaurante guarda un registro de las solicitudes preparadas y sus notas.</p>}
            </>}
          </div>}
          </div>
          {selected.length > 0 && <div className="cart-actions" aria-busy={busy}>
            {error && <p role="alert" className="form-error">{error}</p>}
            {current ? <>
              {current.url && canOrder && !invalid ? <a className="button primary" href={current.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
                <MessageCircle size={19} aria-hidden="true" />{menu.contact.actionText || style?.orderButton || "Abrir WhatsApp"}
              </a> : <button className="button primary" type="button" disabled={busy || !canOrder || invalid} onClick={() => void prepare(true)}>
                {busy ? "Validando…" : "Generar pedido"}
              </button>}
              <button className="button" type="button" disabled={busy} onClick={() => { setReview(null); setOpened(false); setError(""); }}>Volver al carrito</button>
            </> : <>
              {!invalid && <p className="cart-total"><span>Total estimado</span><span>{price(total)}</span></p>}
              <button className="button primary" type="button" onClick={() => void prepare()} disabled={busy || !canOrder || invalid || preview}>{busy ? "Validando…" : "Revisar solicitud"}</button>
              <button className="button" type="button" disabled={busy} onClick={() => clearDialog.current?.showModal()}>Vaciar carrito</button>
            </>}
          </div>}
          <ConfirmDialog dialog={clearDialog} title="¿Vaciar el carrito?" label="Vaciar carrito" onConfirm={() => {
            store({}); setNote(""); setName("");
          }} />
        </div>
      </dialog>
      <div role="status" aria-live="polite" className={notice ? "cart-feedback" : "sr-only"} key={feedbackSequence}>{notice || count + " artículos en el carrito"}</div>
    </div>
  );
}
