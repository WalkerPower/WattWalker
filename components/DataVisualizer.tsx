import React, { useState, useMemo } from 'react';
import { CalculatedEnergyData, CalculationSummary, GraphMetadata, UtilityProvider, UserRole } from '../types';
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
  contactInfo: { address: string; email: string; phone: string };
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

// Helper function to get month index for sorting (0 = Jan, 11 = Dec)
const getMonthIndex = (monthStr: string): number => {
  const lower = monthStr.toLowerCase().trim();
  if (lower.startsWith('ja')) return 0;
  if (lower.startsWith('f')) return 1;
  if (lower.startsWith('mar')) return 2;
  if (lower.startsWith('ap')) return 3;
  if (lower.startsWith('may')) return 4;
  if (lower.startsWith('jun')) return 5;
  if (lower.startsWith('jul')) return 6;
  if (lower.startsWith('au')) return 7;
  if (lower.startsWith('s')) return 8;
  if (lower.startsWith('o')) return 9;
  if (lower.startsWith('n')) return 10;
  if (lower.startsWith('d')) return 11;
  return -1; // Fallback
};

// Helper to format month name (e.g. "Apr 2022" -> "April")
const formatMonthName = (monthStr: string): string => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const idx = getMonthIndex(monthStr);
  if (idx !== -1) return months[idx];
  return monthStr.split(' ')[0]; // Fallback to first word
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

  // Calculate Price Per kWh
  const pricePerKwh = useMemo(() => {
    if (billCost !== undefined && billUsage !== undefined && billUsage > 0) {
      return billCost / billUsage;
    }
    return 0;
  }, [billCost, billUsage]);

  // Process data for the Table View
  const tableData = useMemo(() => {
    const last12 = [...data].slice(-12);
    const sorted = last12.sort((a, b) => getMonthIndex(a.month) - getMonthIndex(b.month));
    return sorted.map(row => ({
      ...row,
      estimatedCost: row.monthlyTotal * pricePerKwh
    }));
  }, [data, pricePerKwh]);

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

      {/* Top Details Section */}
      <div className="p-5 sm:p-6 space-y-6 bg-slate-50 border-b border-slate-200">

        {/* Row 1: Header + Subscription Info */}
        <div className="flex flex-row justify-between items-start">
          {/* Customer Name */}
          <div>
            <div className="text-slate-500 text-xs uppercase tracking-wider font-bold mb-1">Extracted Bill Details</div>
            <div className="text-slate-400 text-sm font-medium">Customer Name</div>
            <div className="text-slate-900 text-2xl sm:text-3xl font-bold mt-1 uppercase tracking-tight">
              {customerName || "NOT FOUND"}
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
                <div className="text-slate-900 font-bold text-sm sm:text-base mt-1 truncate">
                  {pricePerKwh > 0 ? `$${pricePerKwh.toFixed(3)}` : "-"}
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
                      {formatMonthName(row.month)}
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
      </div>
    </div>
  );
};

export default DataVisualizer;