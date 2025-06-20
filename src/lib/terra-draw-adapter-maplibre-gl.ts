// Adaptador MapLibreGL para TerraDraw basado en el código oficial de TerraDraw
// Fuente: https://github.com/TerraDraw/TerraDraw/blob/main/packages/adapter-maplibre-gl/src/adapter.ts

import type maplibregl from "maplibre-gl";

export class MapLibreGLAdapter {
  public map: maplibregl.Map;
  public type = "maplibre-gl";
  public events: { [key: string]: ((e: any) => void)[] } = {};

  constructor(options: { map: maplibregl.Map }) {
    this.map = options.map;
  }

  on(event: string, cb: (e: any) => void) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
  }

  off(event: string, cb: (e: any) => void) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((fn) => fn !== cb);
  }

  project(lng: number, lat: number): { x: number; y: number } {
    const p = this.map.project({ lng, lat });
    return { x: p.x, y: p.y };
  }

  unproject(x: number, y: number): { lng: number; lat: number } {
    const c = this.map.unproject([x, y]);
    return { lng: c.lng, lat: c.lat };
  }

  getMapContainer(): HTMLElement {
    return this.map.getContainer();
  }

  getMap(): maplibregl.Map {
    return this.map;
  }

  setCursor(cursor: string) {
    this.map.getCanvas().style.cursor = cursor;
  }

  getLngLatFromEvent(e: any): { lng: number; lat: number } | null {
    if (e && e.lngLat) {
      return { lng: e.lngLat.lng, lat: e.lngLat.lat };
    }
    return null;
  }

  setDoubleClickToZoom(enabled: boolean) {
    if (enabled) {
      this.map.doubleClickZoom.enable();
    } else {
      this.map.doubleClickZoom.disable();
    }
  }

  getMapEventElement(): HTMLElement {
    return this.map.getCanvas();
  }

  onMapEvent(event: string, cb: (e: any) => void) {
    this.map.on(event, cb);
  }

  offMapEvent(event: string, cb: (e: any) => void) {
    this.map.off(event, cb);
  }

  getViewport(): { width: number; height: number } {
    const c = this.map.getContainer();
    return { width: c.offsetWidth, height: c.offsetHeight };
  }

  getZoom(): number {
    return this.map.getZoom();
  }

  getBearing(): number {
    return this.map.getBearing();
  }

  getPitch(): number {
    return this.map.getPitch();
  }

  register() {
    // Método requerido por la interfaz, puede quedar vacío si no es necesario
  }

  unregister() {
    // Método requerido por la interfaz, puede quedar vacío si no es necesario
  }

  render() {
    // Método requerido por la interfaz, puede quedar vacío si no es necesario
  }

  clear() {
    // Método requerido por la interfaz, puede quedar vacío si no es necesario
  }

  getCoordinatePrecision(): number {
    // Precisión estándar para coordenadas geográficas
    return 6;
  }

  // Métodos mínimos para compatibilidad, puedes extender según necesidades
}
