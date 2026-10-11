
import React, { useState } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import { RadiusUnit, GeometryType, GeneratorParams } from './types';
import { generateKmlCircle } from './services/geoService';

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
    <main className="min-h-screen bg-cover flex flex-col">
      <Header />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Input Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-blue-900/30 backdrop-blur-md p-5 rounded-xl shadow-xl border border-blue-700/50">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center justify-between border-b pb-2 border-blue-700/50">
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

            <div className="space-y-3">
              <div className="relative group">
                <label className="block text-xs font-bold text-blue-200 uppercase mb-1.5">1. Geographic Center - Coordinates or Map URL</label>
                <div className="relative">
                  <input
                    type="text"
                    name="center"
                    value={params.center}
                    onChange={handleInputChange}
                    placeholder="Latitude, Longitude or Google Maps URL"
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-800 border border-blue-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-mono placeholder:font-sans text-white placeholder:text-blue-400"
                  />
                  <i className="fa-solid fa-map-pin absolute left-4 top-1/2 -translate-y-1/2 text-blue-300 group-focus-within:text-emerald-500 transition-colors"></i>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-blue-200 uppercase mb-1.5">Max Radius</label>
                  <input
                    type="number"
                    name="radius"
                    value={params.radius}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-blue-800 border border-blue-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-bold text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-200 uppercase mb-1.5">Unit</label>
                  <select
                    name="unit"
                    value={params.unit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 bg-blue-800 border border-blue-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm text-white"
                  >
                    {Object.values(RadiusUnit).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-blue-700/50">
                <label className="block text-xs font-bold text-blue-200 uppercase mb-1.5 flex items-center justify-between">
                  <span>2. Keywords (Names)</span>
                  <i className="fa-solid fa-font text-blue-300"></i>
                </label>
                <textarea
                  name="names"
                  value={metadata.names}
                  onChange={handleMetadataChange}
                  placeholder="Paste list of names (one per line)..."
                  className="w-full h-20 px-3 py-2 bg-blue-800 border border-blue-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-xs resize-none scrollbar-thin text-white placeholder:text-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-200 uppercase mb-1.5 flex items-center justify-between">
                  <span>3. URLs (Descriptions)</span>
                  <i className="fa-solid fa-link text-blue-300"></i>
                </label>
                <textarea
                  name="urls"
                  value={metadata.urls}
                  onChange={handleMetadataChange}
                  placeholder="Paste list of URLs (one per line)..."
                  className="w-full h-20 px-3 py-2 bg-blue-800 border border-blue-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-xs resize-none scrollbar-thin text-white placeholder:text-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2">
                <button
                  onClick={handleGeneratePreview}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <i className="fa-solid fa-eye"></i>
                  Preview Dataset
                </button>
                
                <button
                  onClick={handleBulkDownload}
                  disabled={isZipping || params.radius < 1}
                  className={`w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest text-xs ${isZipping ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
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

            {/* Helpful Instructions Note */}
            <div className="mt-4 p-3 bg-blue-900/40 backdrop-blur-md border border-blue-700/50 rounded-lg">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-lightbulb text-amber-400 mt-1 flex-shrink-0"></i>
                <div className="text-xs">
                  <p className="text-blue-100 font-semibold mb-1.5">How to use your coordinates:</p>
                  <ol className="text-blue-200 text-xs space-y-1 ml-4 list-decimal">
                    <li>Download the CSV file using the buttons above</li>
                    <li>Go to <a href="https://www.google.com/maps/d/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline font-semibold">Google My Maps</a></li>
                    <li>Create a new map and import your CSV data</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-rose-900/30 backdrop-blur-md border-l-4 border-rose-500 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-300">
              <i className="fa-solid fa-circle-exclamation text-rose-400 mt-1"></i>
              <p className="text-sm text-rose-200 font-semibold leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8 flex flex-col">
          <div className={`bg-blue-900/30 backdrop-blur-md rounded-xl shadow-2xl border border-blue-700/50 flex flex-col transition-all duration-300 overflow-hidden ${isScrollEnabled ? 'h-[600px]' : 'h-auto'} min-h-0`}>
            {/* Action Bar */}
            <div className="p-4 bg-blue-900/20 backdrop-blur-sm border-b border-blue-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-list-ol text-emerald-600"></i>
                  Coordinate Dataset
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  {resultRows.length > 0 && (
                    <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">
                      Radius: {params.radius} {params.unit}
                    </span>
                  )}
                  <button 
                    onClick={() => setIsScrollEnabled(!isScrollEnabled)}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
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
            <div className={`flex-grow relative ${isScrollEnabled ? 'overflow-auto scrollbar-thin scrollbar-thumb-emerald-600 scrollbar-track-blue-800' : 'overflow-visible'}`}>
              {resultRows.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className={`bg-blue-800 backdrop-blur z-10 border-b border-blue-700 ${isScrollEnabled ? 'sticky top-0' : ''}`}>
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] w-[20%]">Keyword</th>
                      <th className="px-6 py-4 text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] w-[40%]">URL Description</th>
                      <th className="px-6 py-4 text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] w-[20%]">Longitude</th>
                      <th className="px-6 py-4 text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] w-[20%]">Latitude</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-800">
                    {resultRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-800/50 transition-colors group">
                        <td className="px-6 py-3.5 text-sm font-bold text-white">
                          {row.name || <span className="text-blue-400 italic font-normal">N/A</span>}
                        </td>
                        <td className="px-6 py-3.5 text-[11px] text-blue-300 font-mono truncate max-w-xs group-hover:text-emerald-300">
                          {row.description || <span className="text-blue-400 italic font-normal">N/A</span>}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 group-hover:bg-emerald-500/20">
                          {row.lng.toFixed(8)}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 group-hover:bg-emerald-500/20">
                          {row.lat.toFixed(8)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-8 p-12 text-center">
                  <div className="relative">
                    <div className="w-32 h-32 bg-blue-800 rounded-full flex items-center justify-center text-blue-700 text-6xl shadow-inner relative z-0">
                      <i className="fa-solid fa-map-location-dot"></i>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg animate-bounce">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-blue-300 font-black mb-3 uppercase tracking-widest text-sm">Preview Dashboard</h3>
                    <p className="text-blue-300 text-sm italic leading-relaxed">
                      Coordinates will appear here in a structured table. You can toggle "Scroll Preview" to keep the dashboard compact or expand it to see all entries.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Stats */}
            {resultRows.length > 0 && (
              <div className="px-4 py-3 bg-blue-900/30 backdrop-blur-sm border-t border-blue-700/50 flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-blue-200">
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

      <section className="max-w-3xl mx-auto mt-10 px-4 text-blue-100 text-sm leading-relaxed">
        <h2 className="text-lg font-bold text-white mb-2">Free Bulk Map Point Generator for Google My Maps</h2>
        <p className="mb-4">
          Generate circular coordinate datasets around any latitude and longitude or Google Maps URL. Set a radius in kilometers, meters or miles,
          add names and URLs, preview the points, then export a ZIP ready to import into Google My Maps. Useful for local SEO geo-grids,
          service-area mapping and geospatial analysis.
        </p>
        <h3 className="text-base font-bold text-white mb-2">How it works</h3>
        <ol className="list-decimal list-inside mb-4 space-y-1">
          <li>Enter a center point as coordinates or paste a Google Maps URL.</li>
          <li>Choose the radius and unit.</li>
          <li>Paste your list of names and URLs.</li>
          <li>Preview the dataset, then download the bulk ZIP.</li>
          <li>Import the files into Google My Maps.</li>
        </ol>
        <h3 className="text-base font-bold text-white mb-2">FAQ</h3>
        <p className="mb-2"><strong>Is it free?</strong> Yes, it runs in your browser at no cost.</p>
        <p className="mb-2"><strong>Who makes it?</strong> Built by <a href="https://www.inzra.com" target="_blank" rel="noopener" className="underline hover:text-emerald-400">INZRA</a> and promoted by <a href="https://seoservice.lk" target="_blank" rel="noopener" className="underline hover:text-emerald-400">SEO Service LK</a>. Source code on <a href="https://github.com/inzrauae/bulk-map" target="_blank" rel="noopener" className="underline hover:text-emerald-400">GitHub</a>.</p>
      </section>

      <footer className="mt-8 pb-6 text-center">
        <div className="h-px bg-blue-700 w-32 mx-auto mb-4"></div>
        <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.4em]">
          INZRA bulk map point generator version 6.1 • <a href="https://www.inzra.com" target="_blank" className="hover:text-emerald-400 transition-colors">www.inzra.com</a>
        </p>
        <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.4em] mt-2">
          Powered by <a href="https://seoservice.lk" target="_blank" rel="noopener" className="hover:text-emerald-400 transition-colors">SEO Service LK</a> • <a href="https://seoservice.lk" target="_blank" rel="noopener" className="hover:text-emerald-400 transition-colors">seoservice.lk</a>
        </p>
      </footer>
    </main>
  );
};

export default App;
