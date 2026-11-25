export const videoAccept = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
export const mediaAccept = "image/jpeg,image/png,image/webp,image/avif," + videoAccept;
export const isVideoUpload = (file: File) => videoAccept.split(",").includes(file.type) ||
  (!file.type || file.type === "application/octet-stream") && /\.(mp4|mov|webm)$/i.test(file.name);

export function UploadFolder() {
  return <label>Clasificación<select name="folder">
    {[["dishes", "Platillos"], ["categories", "Categorías"], ["bundles", "Paquetes"], ["promotions", "Promociones"],
      ["restaurant", "Restaurante"], ["logos", "Logotipos"], ["banners", "Banners"], ["exports", "Exportaciones"]]
      .map(([id, name]) => <option value={id} key={id}>{name}</option>)}
  </select></label>;
}

export function UploadFields({ maxMegabytes, maxSeconds }: { maxMegabytes: number; maxSeconds: number }) {
  return <>
    <label>Archivo<input type="file" name="file" accept={mediaAccept} required /></label>
    <p>Hasta {maxMegabytes} MB. Videos de hasta {maxSeconds} segundos.</p>
    <UploadFolder />
    <label>Portada opcional para video<input type="file" name="poster" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
    <details><summary>Recortar una fotografía</summary>
      <label className="check"><input type="checkbox" name="crop" /> Aplicar recorte en porcentajes</label>
      <div className="field-grid">{[["left", "Izquierda", 0], ["top", "Arriba", 0], ["width", "Ancho", 100], ["height", "Alto", 100]].map(([name, title, value]) =>
        <label key={name}>{title} (%)<input type="number" min="0" max="100" name={"crop-" + name} defaultValue={value} /></label>)}</div>
    </details>
  </>;
}
