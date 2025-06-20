import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawPointMode, TerraDrawLineStringMode } from "terra-draw";
import { MapLibreGLAdapter } from "../lib/terra-draw-adapter-maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const SANTIAGO_CENTER = {
  longitude: -64.2667,
  latitude: -27.7833,
  zoom: 13,
};

interface MapProps {}

const MapLibreTerraDraw: React.FC<MapProps> = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const terraRef = useRef<TerraDraw | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Inicializa el mapa
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.stadiamaps.com/styles/alidade_smooth.json", // estilo open source
      center: [SANTIAGO_CENTER.longitude, SANTIAGO_CENTER.latitude],
      zoom: SANTIAGO_CENTER.zoom,
    });

    // Inicializa TerraDraw con el adaptador de MapLibre
    const adapter = new MapLibreGLAdapter({
      map: mapRef.current,
    });

    terraRef.current = new TerraDraw({
      adapter,
      modes: [
        new TerraDrawPolygonMode(),
        new TerraDrawPointMode(),
        new TerraDrawLineStringMode(),
      ],
    });

    terraRef.current.start();

    // Limpieza al desmontar
    return () => {
      terraRef.current?.stop();
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{ width: "100%", height: "400px", borderRadius: "8px", overflow: "hidden" }}
    />
  );
};

export default MapLibreTerraDraw;
