import React, { useRef, useState } from 'react';
import { Layers, Upload, Trash2, CheckCircle2, Loader2, Search } from 'lucide-react';
import { LutData } from '../types';
import { PRESET_LUTS } from '../utils/lutPresets';
import { parseCubeText } from '../utils/cubeParser';
import { CATALOG_LUTS, CatalogLutItem, fetchAndParseCatalogLut } from '../utils/lutCatalog';

interface LutLibraryPanelProps {
  currentLut: LutData | null;
  onSelectLut: (lut: LutData | null) => void;
  onCustomLutLoaded: (lut: LutData) => void;
  customLuts: LutData[];
}

type CategoryFilter =
  | 'All'
  | 'Nikon'
  | 'Canon'
  | 'Lumix'
  | 'DJI Drone'
  | 'High Contrast'
  | 'Medium Contrast'
  | 'Low Contrast'
  | 'No Contrast';

export const LutLibraryPanel: React.FC<LutLibraryPanelProps> = ({
  currentLut,
  onSelectLut,
  onCustomLutLoaded,
  customLuts
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingLutId, setLoadingLutId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCubeText(text, file.name);
      onCustomLutLoaded(parsed);
      onSelectLut(parsed);
    } catch (err: any) {
      alert(`Error reading .cube file:\n${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectCatalogItem = async (item: CatalogLutItem) => {
    try {
      setLoadingLutId(item.id);
      const lutData = await fetchAndParseCatalogLut(item);
      onSelectLut(lutData);
    } catch (err: any) {
      alert(`Could not load LUT: ${err.message}`);
    } finally {
      setLoadingLutId(null);
    }
  };

  // Filter catalog items
  const filteredCatalog = CATALOG_LUTS.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rolloff.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contrast.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-[#14161d] border border-[#262934] rounded-xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#242733]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#e5b96f]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d5dae6]">
            3D LUT Library ({CATALOG_LUTS.length} Cinematic Transforms)
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".cube,text/plain"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold text-[#f0f3f8] bg-[#242733] hover:bg-[#323646] border border-[#3d4254] rounded-lg transition-colors flex items-center gap-1.5"
            title="Import custom 3D .cube file"
          >
            <Upload className="w-3.5 h-3.5 text-[#e5b96f]" />
            <span>Load .cube File</span>
          </button>

          {currentLut && (
            <button
              onClick={() => onSelectLut(null)}
              className="p-1.5 text-[#e06464] hover:bg-[#2c1d1d] rounded-lg transition-colors"
              title="Clear active LUT"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active LUT Status bar */}
      <div className="p-3 bg-[#181b24] rounded-lg border border-[#2b2f3d] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wider text-[#797f90]">
            Currently Active LUT
          </span>
          <span className="text-sm font-semibold text-[#e5b96f] flex items-center gap-1.5">
            {currentLut ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#e5b96f]" />
                <span className="truncate max-w-[340px]">{currentLut.name}</span>
              </>
            ) : (
              'None (Native Video Decoded RGB)'
            )}
          </span>
        </div>

        {currentLut && (
          <div className="flex items-center gap-3 text-xs font-mono text-[#8a91a2]">
            <span>Size: {currentLut.size}³ ({currentLut.size ** 3} points)</span>
            <span>·</span>
            <span>Domain: [{currentLut.domainMin.join(', ')}] → [{currentLut.domainMax.join(', ')}]</span>
          </div>
        )}
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#1a1d26] rounded-lg border border-[#282c39]">
          {(
            [
              'All',
              'Lumix',
              'Nikon',
              'Canon',
              'DJI Drone',
              'High Contrast',
              'Medium Contrast',
              'Low Contrast',
              'No Contrast'
            ] as CategoryFilter[]
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                selectedCategory === cat
                  ? 'bg-[#292319] text-[#e5b96f] border border-[#5c4623]'
                  : 'text-[#8e94a4] hover:text-[#eceef2] hover:bg-[#222530]'
              }`}
            >
              <span>{cat}</span>
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#6c7282] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search LUTs or rolloff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#1a1d26] border border-[#2b2f3e] text-xs text-[#eceef2] placeholder-[#626878] pl-8 pr-3 py-1.5 rounded-lg outline-none focus:border-[#e5b96f] w-52"
          />
        </div>
      </div>

      {/* Preset Library Grid */}
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Catalog items */}
          {filteredCatalog.map((item) => {
            const isSelected = currentLut?.name === item.name;
            const isLoading = loadingLutId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelectCatalogItem(item)}
                disabled={isLoading}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 relative ${
                  isSelected
                    ? 'bg-[#292218] border-[#7d5d2e] ring-1 ring-[#e5b96f]/40'
                    : 'bg-[#1a1d26] border-[#292d3b] hover:bg-[#202430] hover:border-[#3d4356]'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className={`text-xs font-semibold line-clamp-1 ${isSelected ? 'text-[#e5b96f]' : 'text-[#e3e6ee]'}`}>
                    {item.name}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-[#e5b96f] bg-[#3b2f1e] px-1.5 py-0.5 rounded shrink-0">ACTIVE</span>
                  )}
                  {isLoading && (
                    <Loader2 className="w-3.5 h-3.5 text-[#e5b96f] animate-spin shrink-0" />
                  )}
                </div>

                <p className="text-[11px] text-[#868d9d] leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                <div className="text-[10px] font-mono text-[#7a8192] flex items-center justify-between">
                  <span className="text-[#a8afbf]">
                    {item.category === 'DJI Drone'
                      ? 'Official DJI Drone'
                      : item.category === 'Canon'
                      ? 'Official Canon LUT'
                      : item.category === 'Lumix'
                      ? 'Official Lumix LUT'
                      : item.category === 'Nikon'
                      ? 'Official Nikon LUT'
                      : `${item.contrast} Contrast`}
                  </span>
                  <span>
                    {item.category === 'Canon'
                      ? '65³ Matrix'
                      : item.category === 'DJI Drone'
                      ? `${item.size}³ Matrix`
                      : item.category === 'Lumix'
                      ? `${item.size}³ Matrix`
                      : item.category === 'Nikon'
                      ? `${item.size}³ Matrix`
                      : item.rolloff}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom User-Loaded LUTs */}
      {customLuts.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-[#242733]">
          <span className="text-xs font-semibold text-[#a6adb9] uppercase tracking-wider">
            Custom Loaded .CUBE Files
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {customLuts.map((lut) => {
              const isSelected = currentLut?.name === lut.name;
              return (
                <button
                  key={lut.name}
                  onClick={() => onSelectLut(lut)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#292218] border-[#7d5d2e] ring-1 ring-[#e5b96f]/40'
                    : 'bg-[#1a1d26] border-[#292d3b] hover:bg-[#202430]'
                  }`}
                >
                  <span className={`text-xs font-semibold truncate ${isSelected ? 'text-[#e5b96f]' : 'text-[#e3e6ee]'}`}>
                    {lut.name}
                  </span>
                  <div className="text-[10px] font-mono text-[#616877]">
                    Custom .cube · {lut.size}³ ({lut.size ** 3} entries)
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
