import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CalculatedEnergyData, CalculationSummary, GraphMetadata, UtilityProvider, UserRole } from '../types';
import { billMonthSortKey, formatBillMonthDisplay } from '../utils/billMonth';
import { formatPricePerKwhForPresentation, parsePricePerKwhInput } from '../utils/pricePerKwh';
import { extractServiceAddressFromBillPage } from '../services/geminiService';
import { isHeic, convertHeicToJpg } from '../services/imageService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';

interface DataVisualizerProps {
  data: CalculatedEnergyData[];
  metadata?: GraphMetadata;
  summary: CalculationSummary | null;
  customerName?: string;
  billCost?: number;
  billUsage?: number;
  onSaveRecord: () => void;
  contactInfo: { address: string; email: string; phone: string; notes?: string; pricePerKwh: string };
  onContactInfoChange: (field: string, value: string) => void;
  provider: UtilityProvider;
  userRole: UserRole;
  onUpgradeClick: () => void;
  saveStatus: string;
}

const CustomTooltip = ({ active, payload, label, provider }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as CalculatedEnergyData;
    const isDaily = provider === 'PSEG';

    return (
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xl text-xs sm:text-sm z-50">
        <p className="text-slate-900 font-bold mb-2 border-b border-slate-200 pb-2">{label}</p>
        <div className="space-y-1">
          {/* Primary Metric based on Provider */}
          <p className="text-slate-700 flex justify-between gap-4">
            <span>{isDaily ? 'Daily Usage (Adj):' : 'Monthly Usage:'}</span>
            <span className="font-mono text-[#00a8f9] font-bold">
              {isDaily ? `${data.adjustedDailyUsage} kWh` : `${data.monthlyTotal.toFixed(0)} kWh`}
            </span>
          </p>

          {/* Secondary Metric (if PSEG, show raw, if ACE show nothing or calculated daily) */}
          {isDaily && (
            <p className="text-slate-400 flex justify-between gap-4 text-[10px]">
              <span>(Raw Reading: {Math.round(data.usage)})</span>
            </p>
          )}

          <p className="text-slate-500 flex justify-between gap-4">
            <span>Days in Month:</span>
            <span className="font-mono">{data.daysInMonth}</span>
          </p>

          <div className="mt-2 pt-2 border-t border-slate-200">
            {isDaily && (
              <p className="text-slate-900 font-bold flex justify-between gap-4">
                <span>Monthly Total:</span>
                <span>{data.monthlyTotal.toFixed(0)} kWh</span>
              </p>
            )}
            <p className="text-slate-900 font-bold flex justify-between gap-4">
              <span>Est. Cost:</span>
              <span>${data.estimatedCost.toFixed(0)}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const DataVisualizer: React.FC<DataVisualizerProps> = ({
  data,
  metadata,
  summary,
  customerName,
  billCost,
  billUsage,
  onSaveRecord,
  contactInfo,
  onContactInfoChange,
  provider,
  userRole,
  onUpgradeClick,
  saveStatus
}) => {
  // If Basic, force chart view.
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  // Feature Flags
  const isBasic = userRole === 'basic';
  const isPro = userRole === 'pro';
  const isPremium = userRole === 'premium';

  // Basic: Visual Graph Only, Utility Name, Current Cost/Usage/Rate. Hide everything else.
  // Pro: Hide Email/Phone/vCard/Downloads. Show View Records. Transposed.
  // Premium: All features.

  const canSave = isPro || isPremium;
  const showInputs = isPremium;
  const showAddressInput = isPro || isPremium;
  const showEmailPhoneInput = isPremium;
  const showPremiumAddressCamera =
    isPremium && (provider === 'PSEG' || provider === 'ACE');

  const addressCameraInputRef = useRef<HTMLInputElement>(null);
  const addressFileInputRef = useRef<HTMLInputElement>(null);
  const addressPageUrlRef = useRef<string | null>(null);
  const addressCameraToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [addressCameraToast, setAddressCameraToast] = useState(false);
  const [addressOcrBusy, setAddressOcrBusy] = useState(false);
  const [addressPageUrl, setAddressPageUrl] = useState<string | null>(null);
  /** Camera captures get a blob URL so the subscriber can Save to Device; file uploads do not. */
  const [addressPageFromCamera, setAddressPageFromCamera] = useState(false);
  const [addressImageSaveStatus, setAddressImageSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    return () => {
      if (addressCameraToastTimerRef.current) {
        clearTimeout(addressCameraToastTimerRef.current);
        addressCameraToastTimerRef.current = null;
      }
      if (addressPageUrlRef.current) {
        URL.revokeObjectURL(addressPageUrlRef.current);
        addressPageUrlRef.current = null;
      }
    };
  }, []);

  const startAddressCameraFlow = () => {
    if (!showPremiumAddressCamera || addressOcrBusy || addressCameraToast) return;
    setAddressCameraToast(true);
    addressCameraToastTimerRef.current = setTimeout(() => {
      setAddressCameraToast(false);
      addressCameraToastTimerRef.current = null;
      addressCameraInputRef.current?.click();
    }, 2000);
  };

  const triggerAddressFileUpload = () => {
    if (!showPremiumAddressCamera || addressOcrBusy || addressCameraToast) return;
    addressFileInputRef.current?.click();
  };

  const handleAddressPageSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    source: 'camera' | 'upload'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    setAddressOcrBusy(true);
    setAddressImageSaveStatus('idle');

    try {
      let fileToRead = file;
      if (isHeic(file)) {
        fileToRead = await convertHeicToJpg(file);
      }

      if (source === 'upload') {
        if (addressPageUrlRef.current) {
          URL.revokeObjectURL(addressPageUrlRef.current);
          addressPageUrlRef.current = null;
        }
        setAddressPageUrl(null);
        setAddressPageFromCamera(false);
      } else {
        if (addressPageUrlRef.current) {
          URL.revokeObjectURL(addressPageUrlRef.current);
        }
        const url = URL.createObjectURL(fileToRead);
        addressPageUrlRef.current = url;
        setAddressPageUrl(url);
        setAddressPageFromCamera(true);
      }

      const addr = await extractServiceAddressFromBillPage(
        fileToRead,
        provider === 'ACE' ? 'ACE' : 'PSEG',
        userRole === 'premium'
      );
      if (addr) {
        onContactInfoChange('address', addr);
      } else {
        alert(
          'Could not detect a service address on this page. Try again with a clearer image, or enter the address manually.'
        );
      }
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : 'Failed to read the image. Check your connection and try again.'
      );
    } finally {
      setAddressOcrBusy(false);
    }
  };

  const handleSaveAddressPageToDevice = async () => {
    if (!addressPageUrl) return;
    setAddressImageSaveStatus('saving');
    try {
      const response = await fetch(addressPageUrl);
      const blob = await response.blob();
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `WattWalker_ServiceAddress_${timestamp}.jpg`;
      const dl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = dl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(dl);
      setAddressImageSaveStatus('saved');
      setTimeout(() => setAddressImageSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving address page image:', error);
      alert('Failed to save image. Please try again.');
      setAddressImageSaveStatus('idle');
    }
  };

  const showSummaryStats = isPro || isPremium;
  const showTable = isPro || isPremium;
  const showTabs = isPro || isPremium; // Basic cannot toggle to table

  // Determine graph configuration based on provider
  const isDaily = provider === 'PSEG';
  const graphDataKey = isDaily ? 'adjustedDailyUsage' : 'monthlyTotal';
  const graphYAxisLabel = isDaily ? 'Avg Daily kWh' : 'Monthly kWh';

  // Determine domain from metadata
  const yAxisDomain: [number, number | string] = [
    metadata?.yAxisMin ?? 0,
    metadata?.yAxisMax ?? 'auto'
  ];

  const yAxisTicks = metadata?.yAxisLabels && metadata.yAxisLabels.length > 0
    ? metadata.yAxisLabels
    : undefined;

  const displayRatePerKwh = useMemo(
    () =>
      parsePricePerKwhInput(contactInfo.pricePerKwh, billCost ?? 0, billUsage ?? 0),
    [contactInfo.pricePerKwh, billCost, billUsage]
  );

  // Process data for the Table View (estimatedCost comes from parent, driven by $/kWh field)
  const tableData = useMemo(() => {
    const last12 = [...data].slice(-12);
    const tagged = last12.map((row, i) => ({ row, i }));
    tagged.sort((a, b) => {
      const ka = billMonthSortKey(a.row.month, a.i);
      const kb = billMonthSortKey(b.row.month, b.i);
      if (ka !== kb) return ka - kb;
      return a.i - b.i;
    });
    return tagged.map(({ row }) => ({ ...row }));
  }, [data]);

  // Calculate Financial Summaries for the Table Footer
  const financialSummary = useMemo(() => {
    const totalCost = tableData.reduce((sum, row) => sum + row.estimatedCost, 0);
    const avgCost = tableData.length > 0 ? totalCost / tableData.length : 0;
    return { totalCost, avgCost };
  }, [tableData]);

  // Format subscription Title
  const subscriptionTitle = useMemo(() => {
    if (userRole === 'pro') return 'Professional Subscription';
    if (userRole === 'premium') return 'Premium Subscription';
    return '';
  }, [userRole]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xl h-full flex flex-col relative">

      {addressCameraToast && (
        <div
          className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 max-w-[min(90vw,24rem)] px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium text-center shadow-2xl border border-slate-700 pointer-events-none"
          role="status"
        >
          Please hold camera directly over the first page to collect address.
        </div>
      )}

      {/* Top Details Section */}
      <div className="p-5 sm:p-6 space-y-6 bg-slate-50 border-b border-slate-200">

        {/* Row 1: Header + Subscription Info */}
        <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5 sm:gap-8 flex-1 min-w-0">
            {/* Customer Name */}
            <div className="min-w-0 flex-1">
              <div className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Extracted Bill Details</div>
              <div className="text-slate-400 text-sm font-medium">Customer Name</div>
              <div className="text-slate-900 text-2xl sm:text-3xl font-bold mt-1 uppercase tracking-tight">
                {(customerName ?? '').trim() || 'Name Not Available'}
              </div>
            </div>

            <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[9.5rem]">
              <label
                htmlFor="ww-price-per-kwh"
                className="text-slate-400 text-sm font-medium block"
              >
                $/kWh
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg font-semibold pointer-events-none" aria-hidden>
                  $
                </span>
                <input
                  id="ww-price-per-kwh"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.000"
                  className="w-full sm:w-36 bg-white border border-slate-300 rounded-md pl-7 pr-3 py-2 text-lg font-mono font-bold text-slate-900 focus:outline-none focus:border-[#00a8f9] focus:ring-1 focus:ring-[#00a8f9] transition-colors"
                  value={contactInfo.pricePerKwh}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\$/g, '').replace(/,/g, '');
                    onContactInfoChange('pricePerKwh', v);
                  }}
                  onBlur={() => {
                    const raw = contactInfo.pricePerKwh.trim().replace(/\$/g, '').replace(/,/g, '');
                    if (raw === '') {
                      const fb =
                        billCost !== undefined &&
                        billUsage !== undefined &&
                        billUsage > 0 &&
                        billCost > 0
                          ? (billCost / billUsage).toFixed(3)
                          : '';
                      onContactInfoChange('pricePerKwh', fb);
                      return;
                    }
                    const n = parseFloat(raw);
                    if (Number.isFinite(n) && n >= 0) {
                      onContactInfoChange(
                        'pricePerKwh',
                        formatPricePerKwhForPresentation(n).replace(/^\$/, '')
                      );
                    }
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium tabular-nums">
                Slides / merge value:{' '}
                <span className="text-slate-600 font-semibold">
                  {formatPricePerKwhForPresentation(displayRatePerKwh)}
                </span>
              </p>
            </div>
          </div>

          {/* Right Side: Subscription Title & Save Button */}
          {canSave && (
            <div className="flex flex-col items-end gap-3">
              <div className="text-lg sm:text-xl font-bold text-slate-900">
                {subscriptionTitle}
              </div>

              <button
                onClick={onSaveRecord}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg border transition-colors shadow-sm ${saveStatus === 'saved'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300'
                  }`}
              >
                {saveStatus === 'saved' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Record Saved
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-500">
                      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                    </svg>
                    Save Spreadsheet
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Manual Inputs - Gated */}
        {(showAddressInput || showEmailPhoneInput) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {showAddressInput && (
              <div className="space-y-1">
                {showPremiumAddressCamera && (
                  <>
                    <input
                      ref={addressCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleAddressPageSelected(e, 'camera')}
                    />
                    <input
                      ref={addressFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAddressPageSelected(e, 'upload')}
                    />
                    <div className="flex items-center justify-between gap-2 min-h-[36px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={startAddressCameraFlow}
                          disabled={addressOcrBusy || addressCameraToast}
                          title="Capture service address from bill first page"
                          className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-[#00a8f9] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Scan service address with camera"
                        >
                          {addressOcrBusy ? (
                            <svg className="animate-spin w-5 h-5 text-[#00a8f9]" fill="none" viewBox="0 0 24 24" aria-hidden={true}>
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" aria-hidden={true}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={triggerAddressFileUpload}
                          disabled={addressOcrBusy || addressCameraToast}
                          title="Upload an image of the bill first page to read the service address"
                          className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-[#00a8f9] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Upload image for service address"
                        >
                          {addressOcrBusy ? (
                            <svg className="animate-spin w-5 h-5 text-[#00a8f9]" fill="none" viewBox="0 0 24 24" aria-hidden={true}>
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" aria-hidden={true}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {addressPageFromCamera && addressPageUrl && (
                        <button
                          type="button"
                          onClick={handleSaveAddressPageToDevice}
                          disabled={addressImageSaveStatus === 'saving'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                          {addressImageSaveStatus === 'saving' ? (
                            <>
                              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" aria-hidden={true}>
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Saving...
                            </>
                          ) : addressImageSaveStatus === 'saved' ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={true}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Saved!
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden={true}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Save to Device
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}
                <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Full Address</label>
                <input
                  type="text"
                  placeholder="1234 Solar Lane, Sun City, AZ"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#00a8f9] focus:ring-1 focus:ring-[#00a8f9] transition-colors placeholder-slate-400"
                  value={contactInfo.address}
                  onChange={(e) => onContactInfoChange('address', e.target.value)}
                />
              </div>
            )}

            {showEmailPhoneInput && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Email</label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#00a8f9] focus:ring-1 focus:ring-[#00a8f9] transition-colors placeholder-slate-400"
                    value={contactInfo.email}
                    onChange={(e) => onContactInfoChange('email', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#00a8f9] focus:ring-1 focus:ring-[#00a8f9] transition-colors placeholder-slate-400"
                    value={contactInfo.phone}
                    onChange={(e) => onContactInfoChange('phone', e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Row 3: Annual Summary Stats & Bill Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Annual Stats - Hidden for Basic */}
          {showSummaryStats && summary ? (
            <div className="flex bg-white rounded-lg p-3 border border-slate-200 shadow-sm items-center justify-between">
              <div className="px-4 border-r border-slate-200 w-1/2">
                <div className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold">Last 12 Mo. Total</div>
                <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  {summary.last12MonthsTotal.toFixed(0)} <span className="text-xs font-normal text-slate-500">kWh</span>
                </div>
              </div>
              <div className="px-4 w-1/2">
                <div className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider font-bold">Last 12 Mo. Average</div>
                <div className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
                  {summary.last12MonthsAverage.toFixed(0)} <span className="text-xs font-normal text-slate-500">kWh/mo</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden md:block"></div>
          )}

          {/* Current Bill Metrics - Visible for All */}
          {(billCost !== undefined || billUsage !== undefined) && (
            <div className={`grid grid-cols-3 gap-0 divide-x divide-slate-200 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shadow-sm ${!showSummaryStats ? 'col-span-1 md:col-span-2' : ''}`}>
              <div className="p-3">
                <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Current Bill</div>
                <div className="text-slate-900 font-bold text-sm sm:text-base mt-1 truncate">
                  {billCost !== undefined ? `$${billCost.toFixed(2)}` : "-"}
                </div>
              </div>
              <div className="p-3">
                <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Usage</div>
                <div className="text-slate-900 font-bold text-sm sm:text-base mt-1 truncate">
                  {billUsage !== undefined ? `${billUsage} kWh` : "-"}
                </div>
              </div>
              <div className="p-3">
                <div className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Rate</div>
                <div className="text-slate-900 font-bold text-sm sm:text-base mt-1 truncate tabular-nums">
                  {displayRatePerKwh > 0
                    ? formatPricePerKwhForPresentation(displayRatePerKwh)
                    : '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showTabs && (
        <div className="flex border-b border-slate-200 mt-2">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-colors ${activeTab === 'table'
                ? 'bg-slate-100 text-[#00a8f9] border-b-2 border-[#00a8f9]'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            Data Table
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold transition-colors ${activeTab === 'chart'
                ? 'bg-slate-100 text-[#00a8f9] border-b-2 border-[#00a8f9]'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
          >
            Visual Graph
          </button>
        </div>
      )}

      <div className="p-4 sm:p-6 flex-grow overflow-auto relative">
        {activeTab === 'chart' ? (
          <div className="h-[300px] sm:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{
                  top: 20,
                  right: 10,
                  left: 0,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: graphYAxisLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                  domain={yAxisDomain}
                  ticks={yAxisTicks}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip provider={provider} />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey={graphDataKey} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey={graphDataKey}
                    position="top"
                    fill="#64748b"
                    fontSize={10}
                    fontWeight={600}
                    formatter={(val: number) => val.toFixed(0)}
                  />
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#00a8f9" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full w-full overflow-auto relative">
            <table className="w-full text-sm text-left border-collapse border border-slate-300">
              <thead className="text-xs text-slate-800 uppercase bg-slate-50 border-b-2 border-slate-300">
                <tr>
                  <th scope="col" className="px-4 py-3 border border-slate-300 font-extrabold text-lg">MONTH</th>
                  <th scope="col" className="px-4 py-3 border border-slate-300 font-extrabold text-center text-lg leading-tight">
                    USAGE
                  </th>
                  <th scope="col" className="px-4 py-3 border border-slate-300 font-extrabold text-center text-lg leading-tight">
                    $ PER<br />MONTH
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {tableData.map((row, index) => (
                  <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-2 border border-slate-300 text-slate-900 text-lg font-semibold whitespace-nowrap">
                      {formatBillMonthDisplay(row.month)}
                    </td>
                    <td className="px-4 py-2 border border-slate-300 text-center font-bold text-slate-900 text-lg">
                      {row.monthlyTotal.toFixed(0)}
                    </td>
                    <td className="px-4 py-2 border border-slate-300 text-center font-bold text-[#15803d] text-lg">
                      ${row.estimatedCost.toFixed(0)}
                    </td>
                  </tr>
                ))}
                {/* Summary Footer Row */}
                <tr className="bg-blue-50 border-t-2 border-slate-800">
                  <td colSpan={3} className="p-0 border border-slate-800">
                    <div className="flex w-full divide-x divide-slate-800">
                      <div className="flex-1 px-2 py-3 flex text-center justify-center items-center gap-2">
                        <span className="text-slate-900 font-extrabold text-sm sm:text-base">Avg $/month</span>
                        <span className="text-slate-900 font-bold text-sm sm:text-base">${financialSummary.avgCost.toFixed(0)}</span>
                      </div>
                      <div className="flex-1 px-2 py-3 flex text-center justify-center items-center gap-2">
                        <span className="text-slate-900 font-extrabold text-sm sm:text-base">Total $/y</span>
                        <span className="text-slate-900 font-bold text-sm sm:text-base">${financialSummary.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 text-xs text-slate-500 italic">
              * Showing data for last 12 months, sorted by month. Costs estimated based on current $/kWh.
            </div>
          </div>
        )}
        {canSave && (
          <div className="mt-6 pt-6 border-t border-slate-200 space-y-2">
            <label htmlFor="bill-notes" className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">
              Notes for this bill
            </label>
            <p className="text-xs text-slate-500">
              Saved with this entry in the Notes column after December when you save or export the spreadsheet.
            </p>
            <textarea
              id="bill-notes"
              maxLength={150}
              rows={3}
              placeholder="Optional note (up to 150 characters)"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#00a8f9] focus:ring-1 focus:ring-[#00a8f9] transition-colors placeholder-slate-400 resize-y min-h-[4.5rem]"
              value={contactInfo.notes ?? ''}
              onChange={(e) => onContactInfoChange('notes', e.target.value)}
            />
            <p className="text-[10px] text-slate-400 font-medium">{(contactInfo.notes ?? '').length} / 150 characters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataVisualizer;