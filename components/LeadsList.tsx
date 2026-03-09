import React, { useState } from 'react';
import { SavedRecord, UserRole } from '../types';

interface LeadsListProps {
    records: SavedRecord[];
    userRole: UserRole;
    onClose: () => void;
    onUpdateNotes: (recordId: string, notes: string) => void;
}

const LeadsList: React.FC<LeadsListProps> = ({ records, userRole, onClose, onUpdateNotes }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDate, setSearchDate] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const isPremium = userRole === 'premium';

    const filteredRecords = records.filter(record => {
        if (!isPremium) return true; // Pro sees everything in order

        const searchLower = searchTerm.toLowerCase();
        const dateMatch = !searchDate || new Date(record.timestamp).toLocaleDateString().includes(searchDate);
        const nameMatch = record.customerName.toLowerCase().includes(searchLower) || (record.matchCriteria?.lastName || '').toLowerCase().includes(searchLower);
        const streetMatch = (record.fullAddress || '').toLowerCase().includes(searchLower);

        return dateMatch && (nameMatch || streetMatch);
    });

    const handleCopyAddress = (address: string) => {
        if (!address) return;
        navigator.clipboard.writeText(address).then(() => {
            alert("Address copied to clipboard!");
        });
    };

    const handleCopyCalendarLink = (record: SavedRecord) => {
        const link = `https://wattwalker.njsolar.today/lead/${record.id}`;
        navigator.clipboard.writeText(link).then(() => {
            alert("Link copied! You can paste this into your calendar.");
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl" onClick={onClose} />
            <div className="relative glass-card rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-500">

                {/* Header */}
                <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/40 backdrop-blur-xl">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-6 bg-brand-blue rounded-full"></div>
                            <span className="text-[10px] font-black text-brand-blue uppercase tracking-[0.2em]">{isPremium ? 'Intelligence Nexus' : 'Lead Center'}</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{isPremium ? 'Premium Management' : 'Professional Leads'}</h2>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">{records.length} ACTIVE CAPTURES</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Search Bar (Premium Only) */}
                {isPremium && (
                    <div className="p-6 bg-white/20 border-b border-white/10 flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px] relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Locate capture by name or street..."
                                className="w-full pl-11 pr-5 py-4 bg-white/60 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-brand-blue transition-all placeholder-slate-400 shadow-inner"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-48 relative">
                            <input
                                type="date"
                                className="w-full px-5 py-4 bg-white/60 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-brand-blue transition-all shadow-inner"
                                value={searchDate}
                                onChange={(e) => setSearchDate(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Leads List */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-transparent">
                    {filteredRecords.length === 0 ? (
                        <div className="text-center py-20 bg-white/40 rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                            </div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No matches in intelligence database</p>
                        </div>
                    ) : (
                        filteredRecords.map((record) => (
                            <div key={record.id} className="bg-white/80 backdrop-blur-md rounded-[2rem] border border-white/20 shadow-xl overflow-hidden hover:scale-[1.02] transition-all group">
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none mb-1">{record.customerName}</h3>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(record.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        {isPremium && (
                                            <button
                                                onClick={() => handleCopyCalendarLink(record)}
                                                className="text-[10px] bg-brand-blue text-white px-4 py-2 rounded-full font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                                            >
                                                Calendar Sync
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                        <div className="space-y-4">
                                            <div
                                                className="p-4 bg-slate-100/50 rounded-2xl group cursor-pointer hover:bg-white transition-all border border-transparent hover:border-brand-blue/20"
                                                onClick={() => handleCopyAddress(record.fullAddress || '')}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-brand-blue">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                                                    </span>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Location</p>
                                                </div>
                                                <p className="text-sm text-slate-900 font-bold group-hover:text-brand-blue transition-colors px-6">{record.fullAddress || 'N/A'}</p>
                                            </div>

                                            <div className="flex gap-4">
                                                <div className="flex-1 p-3 bg-slate-100/30 rounded-xl flex items-center gap-3">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                                                    <p className="text-xs font-bold text-slate-700">{record.phoneNumber || 'N/A'}</p>
                                                </div>
                                                <div className="flex-1 p-3 bg-slate-100/30 rounded-xl flex items-center gap-3">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                                                    <p className="text-xs font-bold text-slate-700 truncate">{record.email || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="bg-brand-blue rounded-3xl p-6 text-white shadow-lg shadow-brand-blue/20">
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-3">Efficiency Overview</p>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-3xl font-black">{record.summary.last12MonthsTotal.toFixed(0)} <span className="text-xs font-normal opacity-60">kWh</span></p>
                                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Total volume</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-2xl font-black italic">${(record.summary.last12MonthsAverage * record.pricePerKwh).toFixed(0)}</p>
                                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Monthly impact</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {record.imageUrl && (
                                                <button
                                                    onClick={() => setSelectedImage(record.imageUrl || null)}
                                                    className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l1.29 1.29m-4.733 4.733l-.808-1.458a1.2 1.2 0 012.106-1.144l.872 1.573M3 11.601c.642-.056 1.291-.082 1.944-.078a9.3 9.3 0 019.6 9.6c.003.654-.021 1.303-.078 1.945m.38-1.04l2.04-2.04a2.25 2.25 0 000-3.182l-2.04-2.041" /></svg>
                                                    Decrypt Intelligence Image
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Notes Field (150 chars) */}
                                    <div className="mt-4 pt-6 border-t border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></span>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analyst Briefing Note</label>
                                        </div>
                                        <textarea
                                            maxLength={150}
                                            rows={2}
                                            defaultValue={record.notes}
                                            onBlur={(e) => onUpdateNotes(record.id, e.target.value)}
                                            placeholder="Append data insights here..."
                                            className="w-full p-4 bg-slate-50/50 border-none rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-brand-blue transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-white/10 bg-white/40 backdrop-blur-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-10 py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                    >
                        Secure Hub
                    </button>
                </div>
            </div>

            {/* Image Modal Preview */}
            {selectedImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90">
                    <button
                        onClick={() => setSelectedImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-slate-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <img src={selectedImage} alt="Electric Bill" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                </div>
            )}
        </div>
    );
};

export default LeadsList;
