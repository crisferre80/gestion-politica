import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  link?: string | null;
  active: boolean;
  created_at?: string;
}

interface GridCell {
  id?: string; // id de ads_grid
  adId: string | null;
  size: string;
  row: number;
  col: number;
  customLabel?: string;
  bgColor?: string;
}

interface AdminAdsGridProps {
  ads: Advertisement[];
  onUpdate: () => void;
}

const GRID_ROWS = 2;
const GRID_COLS = 3;
const SIZE_OPTIONS = ['1x1', '2x1', '1x2', '2x2'];

const defaultGrid: GridCell[][] = Array.from({ length: GRID_ROWS }, (_, i) =>
  Array.from({ length: GRID_COLS }, (_, j) => ({
    adId: null,
    size: '1x1',
    row: i,
    col: j,
    customLabel: '',
    bgColor: '',
  }))
);

const AdminAdsGrid: React.FC<AdminAdsGridProps> = ({ ads, onUpdate }) => {
  const [grid, setGrid] = useState<GridCell[][]>(defaultGrid);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gridRows, setGridRows] = useState(GRID_ROWS);
  const [gridCols, setGridCols] = useState(GRID_COLS);
  const navigate = useNavigate();

  // Cargar la grilla desde la base de datos
  useEffect(() => {
    const fetchGrid = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ads_grid')
        .select('*');
      if (!error && data) {
        // Definir el tipo para los elementos de data
        type AdsGridRow = {
          id: string;
          ad_id: string | null;
          size: string;
          row: number;
          col: number;
          custom_label?: string;
          bg_color?: string;
        };
        // Construir la grilla a partir de los datos
        const newGrid = Array.from({ length: GRID_ROWS }, (_, i) =>
          Array.from({ length: GRID_COLS }, (_, j) => {
            const cell = (data as AdsGridRow[]).find((c: AdsGridRow) => c.row === i && c.col === j);
            return cell
              ? {
                  id: cell.id,
                  adId: cell.ad_id,
                  size: cell.size,
                  row: cell.row,
                  col: cell.col,
                  customLabel: cell.custom_label || '',
                  bgColor: cell.bg_color || '',
                }
              : { adId: null, size: '1x1', row: i, col: j, customLabel: '', bgColor: '' };
          })
        );
        setGrid(newGrid);
      }
      setLoading(false);
    };
    fetchGrid();
  }, [onUpdate]);

  // Asignar publicidad a celda
  const handleAssignAd = (row: number, col: number, adId: string) => {
    setGrid(grid =>
      grid.map((r, i) =>
        r.map((cell, j) => (i === row && j === col ? { ...cell, adId } : cell))
      )
    );
  };

  // Cambiar tamaño de celda
  const handleSizeChange = (row: number, col: number, size: string) => {
    setGrid(grid =>
      grid.map((r, i) =>
        r.map((cell, j) => (i === row && j === col ? { ...cell, size } : cell))
      )
    );
  };

  // Cambiar label personalizado
  const handleLabelChange = (row: number, col: number, customLabel: string) => {
    setGrid(grid =>
      grid.map((r, i) =>
        r.map((cell, j) => (i === row && j === col ? { ...cell, customLabel } : cell))
      )
    );
  };

  // Cambiar color de fondo
  const handleBgColorChange = (row: number, col: number, bgColor: string) => {
    setGrid(grid =>
      grid.map((r, i) =>
        r.map((cell, j) => (i === row && j === col ? { ...cell, bgColor } : cell))
      )
    );
  };

  // Guardar configuración en la base de datos
  const handleSave = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < GRID_ROWS; i++) {
        for (let j = 0; j < GRID_COLS; j++) {
          const cell = grid[i][j];
          if (cell.id) {
            // update
            await supabase
              .from('ads_grid')
              .update({
                ad_id: cell.adId,
                size: cell.size,
                custom_label: cell.customLabel,
                bg_color: cell.bgColor,
                updated_at: new Date().toISOString(),
              })
              .eq('id', cell.id);
          } else {
            // insert
            await supabase
              .from('ads_grid')
              .insert({
                row: i,
                col: j,
                ad_id: cell.adId,
                size: cell.size,
                custom_label: cell.customLabel,
                bg_color: cell.bgColor,
              });
          }
        }
      }
      onUpdate();
    } catch {
      alert('Error al guardar la grilla');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando grilla...</div>;

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6 items-center justify-center">
        <label className="font-medium">Filas:
          <input
            type="number"
            min={1}
            max={10}
            value={gridRows}
            onChange={e => setGridRows(Number(e.target.value))}
            className="ml-2 border rounded px-2 py-1 w-16 text-center"
          />
        </label>
        <label className="font-medium ml-4">Columnas:
          <input
            type="number"
            min={1}
            max={10}
            value={gridCols}
            onChange={e => setGridCols(Number(e.target.value))}
            className="ml-2 border rounded px-2 py-1 w-16 text-center"
          />
        </label>
      </div>
      <div
        className={`grid gap-4 mb-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${gridCols} xl:grid-cols-${gridCols}`}
      >
        {grid.slice(0, gridRows).map((row, i) =>
          row.slice(0, gridCols).map((cell, j) => (
            <div
              key={`cell-${i}-${j}`}
              className="border rounded p-2 bg-gray-50 flex flex-col items-center w-full min-h-[220px] shadow-md hover:shadow-lg transition-shadow"
              style={{ backgroundColor: cell.bgColor || undefined }}
            >
              <div className="mb-2 text-xs font-semibold text-gray-700">Celda {i + 1}-{j + 1}</div>
              <select
                className="mb-2 text-xs border rounded w-full"
                value={cell.adId || ''}
                onChange={e => handleAssignAd(i, j, e.target.value)}
              >
                <option value="">Sin publicidad</option>
                {ads.map(ad => (
                  <option key={ad.id} value={ad.id}>{ad.title}</option>
                ))}
              </select>
              <select
                className="mb-2 text-xs border rounded w-full"
                value={cell.size}
                onChange={e => handleSizeChange(i, j, e.target.value)}
              >
                {SIZE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <input
                className="mb-2 text-xs border rounded px-1 w-full"
                type="text"
                placeholder="Etiqueta personalizada"
                value={cell.customLabel || ''}
                onChange={e => handleLabelChange(i, j, e.target.value)}
              />
              <input
                className="mb-2 text-xs border rounded px-1 w-full"
                type="color"
                title="Color de fondo"
                value={cell.bgColor || '#f3f4f6'}
                onChange={e => handleBgColorChange(i, j, e.target.value)}
              />
              {cell.adId && (
                <img
                  src={ads.find(ad => ad.id === cell.adId)?.image_url}
                  alt=""
                  className="w-20 h-20 object-cover rounded shadow"
                />
              )}
            </div>
          ))
        )}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
      >
        {saving ? 'Guardando...' : 'Guardar grilla'}
      </button>
      <button
        onClick={() => navigate('/')}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto ml-2"
        type="button"
      >
        Ver en Inicio
      </button>
    </div>
  );
};

export default AdminAdsGrid;
