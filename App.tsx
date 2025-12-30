
import React, { useState } from 'react';
import Header from './components/Header';
import { RadiusUnit, GeometryType, GeneratorParams } from './types';
import { generateKmlCircle } from './services/geoService';
import JSZip from 'https://esm.sh/jszip@3.10.1';

interface ResultRow {
  name: string;
  description: string;
  lat: number;
  lng: number;
}

const App: React.FC = () => {
  const [params, setParams] = useState<GeneratorParams>({
    center: '6.8681728,79.9753609',
    radius: 10,
    unit: RadiusUnit.KILOMETERS,
    geometry: GeometryType.POLYGON,
    includeCenter: false,
  });

  const [metadata, setMetadata] = useState({
    names: '',
    urls: ''
  });

  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filteredFromUrl, setFilteredFromUrl] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  /**
   * Robust parser for Google Maps URLs
   */
  const extractCoordsFromUrl = (input: string): string => {
    // 1. Standard @lat,lng format
    const atMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return `${atMatch[1]},${atMatch[2]}`;
    
    // 2. Query param q=lat,lng
    const qMatch = input.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) return `${qMatch[1]},${qMatch[2]}`;
    
    // 3. Place path /place/name/@lat,lng
    const placeMatch = input.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) return `${placeMatch[1]},${placeMatch[2]}`;

    // 4. !3d!4d parameters (often in business/point URLs)
    const bangMatchLat = input.match(/!3d(-?\d+\.\d+)/);
    const bangMatchLng = input.match(/!4d(-?\d+\.\d+)/);
    if (bangMatchLat && bangMatchLng) {
      return `${bangMatchLat[1]},${bangMatchLng[1]}`;
    }
    
    return input;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: string | number | boolean = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    if (name === 'center' && typeof finalValue === 'string') {
      const isUrl = finalValue.includes('google.com/maps') || finalValue.includes('goo.gl/maps') || finalValue.includes('maps.app.goo.gl');
      if (isUrl) {
        const extracted = extractCoordsFromUrl(finalValue);
        if (extracted !== finalValue) {
          finalValue = extracted;
          setFilteredFromUrl(true);
          setTimeout(() => setFilteredFromUrl(false), 3000);
        }
      }
    }

    if (name === 'radius') {
      finalValue = Math.max(0, parseFloat(value as string) || 0);
    }

    setParams(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleMetadataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  const generateDataForRadius = (radius: number): ResultRow[] => {
    const kmlCoords = generateKmlCircle({ ...params, radius });
    const rawPoints = kmlCoords.split(' ');
    const namesList = metadata.names.split('\n').map(s => s.trim()).filter(s => s !== '');
    const urlsList = metadata.urls.split('\n').map(s => s.trim()).filter(s => s !== '');

    return rawPoints.map((point, index) => {
      const [lng, lat] = point.split(',').map(Number);
      const rowName = namesList.length > 0 ? namesList[index % namesList.length] : '';
      const rowDesc = urlsList.length > 0 ? urlsList[index % urlsList.length] : '';
      return { name: rowName, description: rowDesc, lat, lng };
    });
  };

  const handleGeneratePreview = () => {
    try {
      setError(null);
      const rows = generateDataForRadius(params.radius);
      setResultRows(rows);
    } catch (err: any) {
      setError(err.message || 'An error occurred during generation.');
    }
  };

  const convertToCSV = (rows: ResultRow[]) => {
    const headers = ["Name", "Description", "Longitude", "Latitude"];
    const csvRows = rows.map(r => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.lng.toFixed(8),
      r.lat.toFixed(8)
    ]);
    return [headers, ...csvRows].map(e => e.join(',')).join('\n');
  };

  const handleDownloadSingle = () => {
    if (resultRows.length === 0) {
      handleGeneratePreview();
    }
    const rows = resultRows.length > 0 ? resultRows : generateDataForRadius(params.radius);
    const csvContent = convertToCSV(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inzra_coordinate_r${params.radius}_${params.unit.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDownload = async () => {
    const startRadius = Math.floor(params.radius);
    if (startRadius < 1) {
      setError("Radius must be at least 1 for bulk download.");
      return;
    }

    try {
      setIsZipping(true);
      setError(null);
      const zip = new JSZip();

      for (let r = startRadius; r >= 1; r--) {
        const rows = generateDataForRadius(r);
        const csvContent = convertToCSV(rows);
        zip.file(`inzra_coordinate_r${r}_${params.unit.toLowerCase()}.csv`, csvContent);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inzra_bulk_circles_r1_to_r${startRadius}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Failed to create ZIP: " + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  const handleCopyExcel = () => {
    if (resultRows.length === 0) return;
    const tabData = "Name\tDescription\tLongitude\tLatitude\n" + 
      resultRows.map(r => `${r.name}\t${r.description}\t${r.lng.toFixed(8)}\t${r.lat.toFixed(8)}`).join('\n');
    
    navigator.clipboard.writeText(tabData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      <Header />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-emerald-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center justify-between border-b pb-3 border-slate-50">
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-emerald-600"></i>
                Location Specs
              </span>
              {filteredFromUrl && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full animate-pulse font-bold uppercase">
                  URL Filtered!
                </span>
              )}
            </h2>

            <div className="space-y-5">
              <div className="relative group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">1. Geographic Center</label>
                <div className="relative">
                  <input
                    type="text"
                    name="center"
                    value={params.center}
                    onChange={handleInputChange}
                    placeholder="Latitude, Longitude or Google Maps URL"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-mono placeholder:font-sans"
                  />
                  <i className="fa-solid fa-map-pin absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors"></i>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Radius</label>
                  <input
                    type="number"
                    name="radius"
                    value={params.radius}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unit</label>
                  <select
                    name="unit"
                    value={params.unit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                  >
                    {Object.values(RadiusUnit).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                  <span>2. Keywords (Names)</span>
                  <i className="fa-solid fa-font text-slate-300"></i>
                </label>
                <textarea
                  name="names"
                  value={metadata.names}
                  onChange={handleMetadataChange}
                  placeholder="Paste list of names (one per line)..."
                  className="w-full h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm resize-none scrollbar-thin"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center justify-between">
                  <span>3. URLs (Descriptions)</span>
                  <i className="fa-solid fa-link text-slate-300"></i>
                </label>
                <textarea
                  name="urls"
                  value={metadata.urls}
                  onChange={handleMetadataChange}
                  placeholder="Paste list of URLs (one per line)..."
                  className="w-full h-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm resize-none scrollbar-thin"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2">
                <button
                  onClick={handleGeneratePreview}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  <i className="fa-solid fa-eye"></i>
                  Preview Dataset
                </button>
                
                <button
                  onClick={handleBulkDownload}
                  disabled={isZipping || params.radius < 1}
                  className={`w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${isZipping ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
                >
                  {isZipping ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Creating ZIP...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-file-zipper"></i>
                      Bulk ZIP (1 to {Math.floor(params.radius)})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
              <i className="fa-solid fa-circle-exclamation text-rose-500 mt-1"></i>
              <p className="text-sm text-rose-700 font-semibold leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8">
          <div className={`bg-white rounded-3xl shadow-2xl border border-emerald-100 flex flex-col transition-all duration-300 overflow-hidden ${isScrollEnabled ? 'h-[750px]' : 'h-auto'}`}>
            {/* Action Bar */}
            <div className="p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col">
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                  <i className="fa-solid fa-list-ol text-emerald-600"></i>
                  Coordinate Dataset
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  {resultRows.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Radius: {params.radius} {params.unit}
                    </span>
                  )}
                  <button 
                    onClick={() => setIsScrollEnabled(!isScrollEnabled)}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <i className={`fa-solid ${isScrollEnabled ? 'fa-toggle-on' : 'fa-toggle-off'} text-sm`}></i>
                    Scroll Preview: {isScrollEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {resultRows.length > 0 && (
                  <>
                    <button
                      onClick={handleDownloadSingle}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all border border-emerald-200 uppercase tracking-tighter"
                    >
                      <i className="fa-solid fa-file-csv"></i>
                      Download CSV
                    </button>
                    <button
                      onClick={handleCopyExcel}
                      className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all uppercase tracking-tighter ${
                        copied ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Table Area with Custom Scroll Options */}
            <div className={`flex-grow relative ${isScrollEnabled ? 'overflow-auto scrollbar-thin scrollbar-thumb-emerald-100 scrollbar-track-transparent' : 'overflow-visible'}`}>
              {resultRows.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className={`bg-slate-50/95 backdrop-blur z-10 border-b border-slate-100 ${isScrollEnabled ? 'sticky top-0' : ''}`}>
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[20%]">Keyword</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[40%]">URL Description</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[20%]">Longitude</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[20%]">Latitude</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {resultRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-emerald-50/40 transition-colors group">
                        <td className="px-6 py-3.5 text-sm font-bold text-slate-700">
                          {row.name || <span className="text-slate-200 italic font-normal">N/A</span>}
                        </td>
                        <td className="px-6 py-3.5 text-[11px] text-slate-400 font-mono truncate max-w-xs group-hover:text-emerald-800">
                          {row.description || <span className="text-slate-200 italic font-normal">N/A</span>}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-mono text-emerald-700 font-bold bg-emerald-50/10 group-hover:bg-emerald-50/30">
                          {row.lng.toFixed(8)}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-mono text-emerald-700 font-bold bg-emerald-50/10 group-hover:bg-emerald-50/30">
                          {row.lat.toFixed(8)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-8 p-12 text-center">
                  <div className="relative">
                    <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-100 text-6xl shadow-inner relative z-0">
                      <i className="fa-solid fa-map-location-dot"></i>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg animate-bounce">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-slate-400 font-black mb-3 uppercase tracking-widest text-sm">Preview Dashboard</h3>
                    <p className="text-slate-300 text-sm italic leading-relaxed">
                      Coordinates will appear here in a structured table. You can toggle "Scroll Preview" to keep the dashboard compact or expand it to see all entries.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Stats */}
            {resultRows.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                <div className="flex items-center gap-6">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-nodes text-emerald-400"></i>
                    {resultRows.length} Points
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-arrows-up-down-left-right text-emerald-400"></i>
                    {params.radius} {params.unit}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-emerald-600">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  Dataset Loaded
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-16 text-center">
        <div className="h-px bg-slate-200 w-32 mx-auto mb-6"></div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
          INZRA bulk map point generator version 6.1 • <a href="https://www.inzra.com" target="_blank" className="hover:text-emerald-500 transition-colors">www.inzra.com</a>
        </p>
      </footer>
    </main>
  );
};

export default App;
