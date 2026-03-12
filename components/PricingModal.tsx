import React, { useState } from 'react';
import { PRICE_IDS } from '../billingConfig';
import { createCheckoutSession } from '../services/stripe';

interface PricingModalProps {
  userId: string;
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ userId, onClose }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (tier: 'basic' | 'professional' | 'premium') => {
    setLoading(tier);
    try {
      const priceId = PRICE_IDS[tier][billingCycle];
      await createCheckoutSession(userId, priceId);
    } catch (error) {
      console.error(error);
      alert("Failed to start checkout process.");
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Choose your Plan</h2>
            <p className="text-slate-500 text-sm">Select a plan to continue accessing WattWalker.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-slate-100 p-1 rounded-lg flex items-center cursor-pointer">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Yearly <span className="text-green-600 text-xs ml-1">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            
             {/* Basic Tier */}
            <div className="border border-slate-200 rounded-xl p-5 flex flex-col hover:border-slate-300 transition-colors">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-700">Basic</h3>
                <div className="flex items-baseline gap-1 mt-2">
                   <span className="text-2xl font-extrabold text-slate-900">
                     {billingCycle === 'monthly' ? '$5.99' : '$59.99'}
                   </span>
                   <span className="text-slate-500 font-medium text-xs">
                     /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                   </span>
                </div>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Instant electric bill evaluation</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Capture bill images during evaluation</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-400">
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>No stored history</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-400">
                  <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Records cleared on new evaluation</span>
                </li>
              </ul>
              <button
                onClick={() => handleSubscribe('basic')}
                disabled={!!loading}
                className="w-full py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm"
              >
                {loading === 'basic' ? 'Loading...' : 'Choose Basic'}
              </button>
            </div>

            {/* Professional Tier */}
            <div className="border border-slate-200 rounded-xl p-5 flex flex-col hover:border-slate-300 transition-colors">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900">Professional</h3>
                <div className="flex items-baseline gap-1 mt-2">
                   <span className="text-2xl font-extrabold text-slate-900">
                     {billingCycle === 'monthly' ? '$12.99' : '$129.99'}
                   </span>
                   <span className="text-slate-500 font-medium text-xs">
                     /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                   </span>
                </div>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Secure Firebase database storage</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Chronological lead history</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>150-character notes per lead</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Bill image stored with lead</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Tap-to-copy address</span>
                </li>
              </ul>
              <button
                onClick={() => handleSubscribe('professional')}
                disabled={!!loading}
                className="w-full py-2 rounded-lg border-2 border-[#00a8f9] text-[#00a8f9] font-bold hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm"
              >
                {loading === 'professional' ? 'Loading...' : 'Choose Professional'}
              </button>
            </div>

            {/* Premium Tier */}
            <div className="border-2 border-[#00a8f9] rounded-xl p-5 flex flex-col relative bg-blue-50/30">
              <div className="absolute top-0 right-0 bg-[#00a8f9] text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl rounded-tr-lg">
                BEST VALUE
              </div>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-slate-900">Premium</h3>
                <div className="flex items-baseline gap-1 mt-2">
                   <span className="text-2xl font-extrabold text-slate-900">
                     {billingCycle === 'monthly' ? '$19.99' : '$199.00'}
                   </span>
                   <span className="text-slate-500 font-medium text-xs">
                     /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                   </span>
                </div>
                <div className="text-green-600 text-xs font-bold mt-1">5 Days Free Trial</div>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Search leads by date or last name</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Calendar appointment links</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>150-character notes per lead</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>Downloadable lead data (CSV)</span>
                </li>
                <li className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span>All Professional features included</span>
                </li>
              </ul>
              <button
                onClick={() => handleSubscribe('premium')}
                disabled={!!loading}
                className="w-full py-2 rounded-lg bg-[#00a8f9] text-white font-bold hover:bg-[#0096e0] shadow-md transition-colors disabled:opacity-50 text-sm"
              >
                {loading === 'premium' ? 'Loading...' : 'Start 5-Day Free Trial'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;