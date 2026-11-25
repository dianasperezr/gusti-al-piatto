"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MenuVideo } from "./menu-video";
import type { Selections } from "../products/options";
import { cartIdentity, parseCart, type Cart } from "../orders/cart";
import type { QuoteReply } from "../orders/checkout";
import { Clock3, Leaf, MapPin, MessageCircle, Minus, Plus, ShoppingBag, Utensils, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { MenuData } from "./menu";
import { formatPrice, unitCents, quoteCart, convertCents, type CatalogItem, type Currency, type PublicMedia } from "./pricing";

const cartKey = "gusti-cart-v1";
const empty = "{}";
const cartEvent = "gusti-cart-change";
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

function ItemMedia({ media, name, hero = false }: { media: PublicMedia; name: string; hero?: boolean }) {
  if (media.video) return <MenuVideo src={media.src} poster={media.poster} name={name} />;
  return <picture className="media-picture">
    {!hero && media.poster && <source media="(max-width: 600px) and (max-resolution: 1.5dppx)" srcSet={media.poster} />}
    <Image src={media.src} alt={hero ? "" : name} fill sizes={hero ? "(max-width: 800px) 100vw, 1180px" : "(max-width: 640px) 100vw, 400px"} unoptimized={media.src.startsWith("/media/")} preload={hero} className="cover-media" />
  </picture>;
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
  const [configuring, configure] = useState("");
  const [tabCategory, setTabCategory] = useState("");
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
  const { availableItems, productsByCategory, combos } = useMemo(() => {
    const availableItems = new Map<string, CatalogItem>();
    const productsByCategory = new Map<string, CatalogItem[]>();
    const combos: CatalogItem[] = [];
    for (const item of menu.items) {
      if (item.available) availableItems.set(item.id, item);
      if (item.kind === "COMBO") combos.push(item);
      else {
        const category = item.categoryId ?? "sin-categoria";
        const products = productsByCategory.get(category) ?? [];
        products.push(item);
        productsByCategory.set(category, products);
      }
    }
    return { availableItems, productsByCategory, combos };
  }, [menu.items]);
  const entries = Object.entries(cart).map(([key, line]) => ({
    key, line, item: availableItems.get(line.id),
  }));
  const quotes = quoteCart(entries.map(({ line, item }) => ({ ...line, item })), currency, menu.rate, menu.base, menu.money);
  const selected = entries.map((entry, index) => ({ ...entry, quote: quotes[index] }));
  const valid = selected.filter(row => row.item && row.quote);
  const invalid = valid.length !== selected.length;
  const total = valid.reduce((sum, row) => sum + (row.quote?.total ?? 0), 0);
  const subtotal = valid.reduce((sum, row) => sum + (row.quote?.subtotal ?? 0), 0);
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
      if (matching[1].quantity >= 20) { setNotice("El carrito admite hasta 20 unidades por selección."); incrementFeedback(value => value + 1); return; }
      update(matching[0], 1);
    } else {
      if (selected.length >= 25) { setNotice("El carrito admite hasta 25 selecciones distintas."); incrementFeedback(value => value + 1); return; }
      const observedBaseUnit = quoteCart([{ item, quantity: 1, selections }], menu.base, menu.rate, menu.base, menu.money)[0]?.unit;
      store({ ...cart, [crypto.randomUUID()]: { id: item.id, quantity: 1, selections, note: "", observedBaseUnit } });
    }
    setNotice(item.name + " se agregó al carrito.");
    incrementFeedback(value => value + 1);
    configure("");
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

  function card(item: CatalogItem) {
    return (
      <article key={item.id} id={item.slug ? "platillo-" + item.slug : undefined} className="menu-card">
        {item.media && <div className="item-image"><ItemMedia media={item.media} name={item.name} /></div>}
        <div className="item-body">
          <h3>{item.name}</h3>
          {item.featured && <span className="item-featured">Destacado</span>}
          {item.subcategory && <small>{item.subcategory}</small>}
          {item.description && <p>{item.description}</p>}
          {item.components.length > 0 && <p>Incluye {item.components.map(component => component.quantity + " × " + component.name).join(", ")}.</p>}
          {item.offers.length > 0 && <p className="item-featured">{item.offers.filter(offer => offer.method !== "notice").map(offer => offer.name).join(" · ")}</p>}
          {(item.details || item.ingredients?.length || item.allergens?.length || item.nutrition || item.tags?.length || item.gallery.length) ? <details>
            <summary>Detalles del platillo</summary>
            {item.details && <p>{item.details}</p>}
            {item.tags?.length ? <p>{item.tags.join(" · ")}</p> : null}
            {item.ingredients?.length ? <p>Ingredientes: {item.ingredients.join(", ")}</p> : null}
            {item.allergens?.length ? <p>Alérgenos: {item.allergens.join(", ")}</p> : null}
            {item.nutrition && <p>{item.nutrition}</p>}
            <div className="public-gallery">{item.gallery.map(media => <div className="item-image" key={media.src}><ItemMedia media={media} name={item.name} /></div>)}</div>
          </details> : null}
          {configuring === item.id && canOrder && item.available && <ItemOptions item={item} currency={currency} base={menu.base} rate={menu.rate} money={menu.money} onAdd={selections => add(item, selections)} />}
          <div className="item-footer">
            <strong>{price(unitCents(item, currency, menu.rate, menu.base, menu.money))}</strong>
            {canOrder && item.available
              ? <button className="button small add-to-cart" type="button" onClick={() => item.groups.length ? configure(configuring === item.id ? "" : item.id) : add(item)} aria-label={`Agregar ${item.name} al carrito`}><Plus size={16} /> Agregar</button>
              : !item.available && <span className="muted">No disponible</span>}
          </div>
        </div>
      </article>
    );
  }

  function catalog(categoryId = "", limit = Infinity, anchorFor: (id: string) => boolean = () => true) {
    const groups = [...menu.categories, { id: "sin-categoria", name: menu.categories.length ? "Otros platillos" : "Platillos", description: "", media: null }];
    if (!productsByCategory.size) return <p className="empty-menu">Todavía no hay platillos publicados.</p>;
    return groups.filter(group => !categoryId || group.id === categoryId).map(group => {
      const items = (productsByCategory.get(group.id) ?? []).slice(0, limit);
      if (!items.length) return null;
      return <section key={group.id} className="menu-group" id={anchorFor(group.id) ? group.id : undefined}>
        <h3 className="group-title">{group.name}</h3>
        {group.media && <div className="section-image"><ItemMedia media={group.media} name={group.name} /></div>}
        {group.description && <p className="muted">{group.description}</p>}
        <div className="menu-grid">{items.map(card)}</div>
      </section>;
    });
  }

  function promotions(limit = Infinity) {
    return <div className="menu-grid">{menu.promotions.slice(0, limit).map(promotion => <article className={promotion.banner ? "menu-card promo-banner" : "menu-card"} key={promotion.id}>
      {promotion.media && <div className="item-image"><ItemMedia media={promotion.media} name={promotion.name} /></div>}
      <div className="item-body"><h3>{promotion.name}</h3><p>{promotion.description}</p>
        {promotion.method === "percent" && <strong>{promotion.amount}% de descuento</strong>}
        {(promotion.method === "fixed" || promotion.method === "price") && <strong>{promotion.method === "fixed" ? "Descuento de " : "Precio promocional "}
          {price(convertCents(promotion.amount, menu.base, currency, menu.rate, menu.money))}</strong>}{promotion.restrictions && <small>{promotion.restrictions}</small>}</div>
    </article>)}</div>;
  }

  const customTypes = new Set(menu.sections.map(section => section.type));
  const showCatalog = !customTypes.has("catalog");
  const hasCategory = (id: string) => productsByCategory.has(id);

  const visibleCategories = menu.categories.filter(category => hasCategory(category.id));
  const visualCatalogs = menu.visual?.sections.filter(section => section.type === "catalog") ?? [];
  const visualCategories = visibleCategories.filter(category => visualCatalogs.some(section => !section.categoryId || section.categoryId === category.id));
  const activeCategoryLinks = style ? visualCategories : visibleCategories;
  const selectedTab = style?.navigation === "tabs" && visualCategories.some(category => category.id === tabCategory) ? tabCategory : "";
  const mainSection = menu.visual?.sections.find(section => section.type === "catalog")?.id ?? menu.visual?.sections.find(section => section.type !== "hero")?.id;
  const gallery = (assets: PublicMedia[], name: string) => <div className="menu-grid">{assets.map((asset, index) =>
    <div className="item-image" key={asset.src + index}><ItemMedia media={asset} name={name} /></div>)}</div>;
  const categoryNav = (location: string) => activeCategoryLinks.length > 0 && <nav className={"category-nav visual-nav visual-nav-" + location} aria-label="Categorías">
    {style?.navigation === "tabs" ? <>
      <button className="button small" aria-pressed={!selectedTab} onClick={() => setTabCategory("")}>Todas</button>
      {activeCategoryLinks.map(category => <button className="button small" aria-pressed={selectedTab === category.id} onClick={() => setTabCategory(category.id)} key={category.id}>{category.name}</button>)}
    </> : activeCategoryLinks.map(category => <a href={"#" + category.id} key={category.id}>{category.name}</a>)}
  </nav>;
  function hero(title: string, description: string, asset = menu.cover) {
    const photo = !style || ["photo", "banner", "integrated"].includes(style.headerStyle);
    return <section className={"restaurant-hero" + (photo ? "" : " hero-plain")}>
      <div className="hero-copy">
        {!style && menu.appearance.eyebrow && <span className="eyebrow">{menu.appearance.eyebrow}</span>}
        <h1>{title || menu.name}</h1>
        {description && <p>{description}</p>}
        {(!menu.visual || mainSection) && <a href={menu.visual ? "#" + mainSection : "#menu-digital"} className="hero-link">Ver el menú</a>}
      </div>
      {photo && asset && <div className="hero-media"><ItemMedia media={asset} name={menu.name} hero /></div>}
      {photo && !asset && <div className="hero-media fallback-hero"><ItemMedia media={{ src: "/gusti-hero.webp", video: false }} name="" hero /></div>}
    </section>;
  }
  function contact(title = "Visítanos", description = "", anchor = "visitanos") {
    return <section className="visit" id={anchor}>
      <div><h2>{title}</h2>{description && <p>{description}</p>}
        {menu.contact.address && <p><MapPin size={17} /> {menu.contact.address}</p>}
        {menu.contact.phone && <p>{menu.contact.phone}</p>}
        <div className="socials">
          {menu.contact.instagram && <a href={menu.contact.instagram}>Instagram</a>}
          {menu.contact.facebook && <a href={menu.contact.facebook}>Facebook</a>}
          {menu.contact.whatsapp && !preview && <a href={"https://wa.me/" + menu.contact.whatsapp}>WhatsApp</a>}
        </div>
      </div>
      <div><h3>Horario</h3>{menu.hours.length ? <dl>{menu.hours.map(day => <div key={day.id}>
        <dt>{day.date || (day.days.length ? day.days.map(index => weekdays[index]).join(", ") : "Todos los días")}</dt>
        <dd>{day.mode === "closed" ? "Cierre especial · " : ""}{day.opens}–{day.closes}</dd>
      </div>)}</dl> : <p>Por publicar.</p>}</div>
    </section>;
  }
  function footer(title = menu.name) {
    return <footer className="restaurant-footer"><div className="menu-container"><span>{title}</span>{!preview && <Link href="/admin">Administración</Link>}</div></footer>;
  }
  const visualSections = menu.visual?.sections.map(section => {
    const items = menu.items.filter(item => !section.categoryId || item.categoryId === section.categoryId);
    if (section.type === "catalog" && selectedTab && section.categoryId && section.categoryId !== selectedTab) return null;
    if (section.type === "hero") return <div key={section.id}>{hero(section.title, section.description || menu.headline, section.assets[0] ?? menu.cover)}</div>;
    if (section.type === "contact") return <div key={section.id}>{contact(section.title || "Visítanos", section.description, section.id)}</div>;
    if (section.type === "footer") return <div key={section.id}>{footer(section.title === "Pie de página" ? menu.name : section.title || menu.name)}</div>;
    const cards = (filter: (item: CatalogItem) => boolean) => <div className="menu-grid">{items.filter(filter).slice(0, section.limit).map(card)}</div>;
    const content = {
      catalog: () => catalog(selectedTab || section.categoryId, section.limit, id => visualCatalogs.find(candidate => !candidate.categoryId || candidate.categoryId === id)?.id === section.id),
      daily: () => cards(item => item.kind === "PRODUCT" && item.available),
      featured: () => cards(item => item.featured),
      combos: () => cards(item => item.kind === "COMBO"),
      promotions: () => promotions(section.limit),
      gallery: () => gallery(section.assets.filter(asset => !asset.video), section.title),
      videos: () => gallery(section.assets.filter(asset => asset.video), section.title),
      banner: () => gallery(section.assets.slice(0, 1), section.title),
      info: () => gallery(section.assets, section.title),
    };
    return <section className={"visual-section section-" + section.layout + " component-" + section.type} key={section.id} id={section.id}>
      {section.title && <h2 className="group-title">{section.title}</h2>}
      {section.description && <p>{section.description}</p>}
      {content[section.type]()}
      {section.button && section.url && <a className="button" href={section.url}>{section.button}</a>}
    </section>;
  });
  const navigation = style && style.navigation !== "none" && style.categoryNavigation;
  const integrated = navigation && style.headerStyle === "integrated";
  const background = style?.background ?? menu.appearance.background;
  const accent = style?.primary ?? menu.appearance.accent;
  const secondary = style?.secondary ?? "#303d2c";
  return (
    <div className={`restaurant header-${style?.headerStyle ?? "photo"} type-${style?.typography ?? "classic"}${style?.compactMobile ? " nav-mobile-compact" : ""}${style?.fixedNavigation ? " nav-fixed" : ""}`} style={{
      "--restaurant-accent": accent, "--restaurant-background": background, "--restaurant-secondary": secondary,
      "--restaurant-secondary-ink": contrastingInk(secondary), "--restaurant-ink": contrastingInk(background, "#272a21"),
      "--restaurant-muted": contrastingInk(background, "#605f55"), "--restaurant-accent-text": contrastingInk(background, accent),
      "--restaurant-paper-accent": contrastingInk("#fffdf8", accent), "--nav-offset": style?.fixedHeader === false ? "0px" : "72px",
    } as CSSProperties}>
      <a className="skip-menu button" href="#menu-digital">Saltar al menú</a>
      <header className={"restaurant-header" + (style?.fixedHeader === false ? " header-static" : "")}>
        <div className="menu-container topbar">
          <Link href={preview ? "#menu-digital" : "/menu"} className="restaurant-brand">
            {menu.logo ? <Image src={menu.logo} width={38} height={38} alt="" unoptimized /> : style?.icon === "none" ? null : <span className="brand-icon">{style?.icon === "leaf" ? <Leaf size={17} /> : <Utensils size={17} />}</span>}
            <span>{menu.name}</span>
          </Link>
          <div className="top-actions">
            {menu.money.enabled.length > 1 && <label className="currency-select"><span className="sr-only">Moneda</span><select value={currency} onChange={event => {
              setCurrency(event.target.value === "USD" ? "USD" : "MXN");
              setReview(null); setOpened(false);
            }}>{menu.money.enabled.map(code => <option key={code} value={code}>{code} {code === "MXN" ? menu.money.mxnSymbol || "$" : menu.money.usdSymbol || "US$"}</option>)}</select></label>}
            {(cartEnabled && (ordersEnabled || count > 0)) && <button type="button" className="cart-trigger" aria-label={`Carrito, ${count} artículos`} onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }}>
              <ShoppingBag size={17} /> <span>Carrito</span><strong>{count}</strong>
            </button>}
          </div>
        </div>
        {integrated && <div className="menu-container">{categoryNav("integrated")}</div>}
      </header>
      <main className="menu-container">
        {menu.visual && ordersEnabled && !canOrder && <p className="empty-menu">{menu.contact.outsideText || "El restaurante está fuera de su horario de pedidos."}</p>}
        {menu.visual ? <div id="menu-digital" className={navigation && !integrated && style.navigation === "side" ? "visual-page visual-with-sidebar" : "visual-page"}>
          {navigation && !integrated && categoryNav(style.navigation)}
          <div className="visual-content">{visualSections}</div>
        </div> : <>
          {hero(menu.name, menu.headline)}
        <section className="menu-content" id="menu-digital">
          <div className="menu-title"><div><span className="eyebrow">A la carta</span><h2>El menú</h2></div>
            {menu.hours.length > 0 && <a className="hours-link" href="#visitanos"><Clock3 size={17} /> Horarios</a>}
          </div>
          {ordersEnabled && !canOrder && <p className="empty-menu">{menu.contact.outsideText || "El restaurante está fuera de su horario de pedidos."}</p>}
          {menu.categories.some(category => hasCategory(category.id)) && <nav className="category-nav" aria-label="Categorías">
            {menu.categories.filter(category => hasCategory(category.id)).map(category => <a key={category.id} href={`#${category.id}`}>{category.name}</a>)}
          </nav>}
          {!customTypes.has("promotions") && menu.promotions.length > 0 && <section className="menu-group"><h3 className="group-title">Promociones</h3>{promotions()}</section>}
          {showCatalog && catalog()}
          {!customTypes.has("combos") && combos.length > 0 && <section className="menu-group"><h3 className="group-title">Paquetes</h3><div className="menu-grid">{combos.map(card)}</div></section>}
          {menu.sections.map(section => <section className="menu-group" key={section.id}>
            <h3 className="group-title">{section.name}</h3>
            {section.description && <p>{section.description}</p>}
            {section.media && <div className="section-image"><ItemMedia media={section.media} name={section.name} /></div>}
            {section.type === "catalog" && catalog()}
            {section.type === "promotions" && promotions()}
            {section.type === "combos" && <div className="menu-grid">{combos.map(card)}</div>}
            {section.label && section.url && <a className="button" href={section.url}>{section.label}</a>}
          </section>)}
        </section>
        {contact()}
        {footer()}
        </>}
      </main>
      {cartEnabled && (count > 0 || style?.fixedHeader === false && ordersEnabled) &&
        <button type="button" className={`cart-trigger cart-floating${style?.fixedHeader === false ? "" : " cart-mobile-only"}`}
          aria-label={`Ver carrito, ${count} artículos`} onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }}>
          <ShoppingBag size={19} aria-hidden="true" /> Ver carrito <strong>{count}</strong>
          {count > 0 && !invalid && <span className="cart-floating-total">{price(total)}</span>}
        </button>}
      <dialog ref={dialog} className={"cart-dialog" + (style?.cartStyle === "center" ? " cart-centered" : "")} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} aria-labelledby="cart-title">
        <div className="cart-panel">
          <div className="panel-heading"><h2 id="cart-title">Tu carrito</h2><button type="button" className="circle-button" aria-label="Cerrar carrito" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
          <div className="cart-content" ref={cartContent}>
          {!canOrder && <p className="muted">{ordersEnabled ? menu.contact.outsideText || "El restaurante está fuera de su horario de pedidos." : "Los pedidos están desactivados."}</p>}
          {!selected.length ? <p className="empty-menu">Tu carrito está vacío.</p> : <div className="action-form">
            {menu.contact.customerInstructions && <p>{menu.contact.customerInstructions}</p>}
            {menu.money.enabled.length > 1 && <label>Moneda del carrito<select disabled={busy} value={currency} onChange={event => {
              setCurrency(event.target.value === "USD" ? "USD" : "MXN"); setReview(null); setOpened(false);
            }}>{menu.money.enabled.map(code => <option key={code}>{code}</option>)}</select></label>}
            {invalid && <p role="alert" className="form-error">Algunos artículos o complementos ya no están disponibles. Actualiza la selección.</p>}
            {current ? <>
              <ValidatedSummary summary={current.summary} />
              <p className="muted">Moneda principal aceptada: {menu.contact.acceptedCurrency}</p>
              <p>{opened ? (menu.contact.confirmationText || "Tu solicitud está preparada para que la envíes por WhatsApp.") : "Se abrirá WhatsApp con tu pedido preparado. Revisa el mensaje y presiona Enviar para compartirlo con el restaurante."}</p>
              {opened && <p role="status">La recepción se confirma directamente con el restaurante en WhatsApp.</p>}
            </> : <>
              <ul className="cart-items">{selected.map(({ key, item, line, quote }) => <li className="cart-editable-line" key={key}>
                <div><strong>{item?.name ?? "Artículo no disponible"}</strong>
                  {quote ? <span>{price(quote.unit)} por unidad · Subtotal {price(quote.subtotal)}</span> : <span>No disponible</span>}
                  {quote?.labels.map(label => <small key={label}>{label}</small>)}
                  {!!quote?.discount && <small>Descuento {price(quote.discount)} · {quote.offers.join(", ")}</small>}
                  <label>Nota del platillo<input value={line.note} maxLength={160} disabled={busy}
                    onChange={event => store({ ...cart, [key]: { ...line, note: event.target.value } })} /></label>
                  {item && item.groups.length > 0 && <button type="button" className="button small" disabled={busy} onClick={() => setEditing(editing === key ? "" : key)}>Editar variantes y complementos</button>}
                  {item && editing === key && <ItemOptions item={item} currency={currency} base={menu.base} rate={menu.rate} money={menu.money}
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
              <dl className="cart-totals">
                <div><dt>Subtotal</dt><dd>{price(subtotal)}</dd></div>
                <div><dt>Descuentos</dt><dd>{price(subtotal - total)}</dd></div>
              </dl>
              {menu.contact.logRequests && <p className="muted">El restaurante guarda un registro de las solicitudes preparadas y sus notas.</p>}
            </>}
          </div>}
          </div>
          <div className="cart-actions" aria-busy={busy}>
            {error && <p role="alert" className="form-error">{error}</p>}
            {!selected.length ? <button type="button" className="button primary" onClick={() => dialog.current?.close()}>Volver al menú</button> : current ? <>
              {current.url && canOrder && !invalid ? <a className="button primary" href={current.url} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
                <MessageCircle size={19} aria-hidden="true" />{menu.contact.actionText || style?.orderButton || "Abrir WhatsApp"}
              </a> : <button className="button primary" type="button" disabled={busy || !canOrder || invalid} onClick={() => void prepare(true)}>
                {busy ? "Validando…" : "Generar pedido"}
              </button>}
              <button className="button" type="button" disabled={busy} onClick={() => { setReview(null); setOpened(false); setError(""); }}>Volver al carrito</button>
            </> : <>
              {!invalid && <p className="cart-total"><span>Total estimado</span><strong>{price(total)}</strong></p>}
              <button className="button primary" type="button" onClick={() => void prepare()} disabled={busy || !canOrder || invalid || preview}>{busy ? "Validando…" : "Revisar solicitud"}</button>
              <button className="button" type="button" disabled={busy} onClick={() => clearDialog.current?.showModal()}>Vaciar carrito</button>
            </>}
          </div>
          <ConfirmDialog dialog={clearDialog} title="¿Vaciar el carrito?" label="Vaciar carrito" onConfirm={() => {
            store({}); setNote(""); setName("");
          }} />
        </div>
      </dialog>
      <div role="status" aria-live="polite" className={notice ? "cart-feedback" : "sr-only"} key={feedbackSequence}>{notice || count + " artículos en el carrito"}</div>
    </div>
  );
}
