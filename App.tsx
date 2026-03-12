import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import DataVisualizer from './components/DataVisualizer';
import LoadingState from './components/LoadingState';
import Auth from './components/Auth';
import PricingModal from './components/PricingModal';
import SplashScreen from './components/SplashScreen';
import { analyzeGraphImage } from './services/geminiService';
import { isHeic, convertHeicToJpg } from './services/imageService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { AnalysisResponse, AnalysisStatus, CalculatedEnergyData, CalculationSummary, SavedRecord, UtilityProvider, UserRole } from './types';

const STORAGE_KEY = 'wattwalker_saved_records';

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

const App: React.FC = () => {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole>('basic');
    const [authLoading, setAuthLoading] = useState(true);

    // Subscription & Trial Logic
    const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
    const [isTrialExpired, setIsTrialExpired] = useState(false);

    // App State
    const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
    const [result, setResult] = useState<AnalysisResponse | null>(null);
    const [processingMessage, setProcessingMessage] = useState<string>('');
    const [showPricingModal, setShowPricingModal] = useState(false);

    // State for Utility Provider (PSEG default)
    const [provider, setProvider] = useState<UtilityProvider>('PSEG');

    // State for calculated values
    const [calculatedData, setCalculatedData] = useState<CalculatedEnergyData[] | null>(null);
    const [summary, setSummary] = useState<CalculationSummary | null>(null);

    // State for Manual User Inputs
    const [contactInfo, setContactInfo] = useState({ address: '', email: '', phone: '' });

    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Storage State
    const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
    const [showDownloadSection, setShowDownloadSection] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');

    // Professional View Records Modal
    const [showRecordsModal, setShowRecordsModal] = useState(false);

    // Splash Screen State - shows once per session after login
    const [showSplash, setShowSplash] = useState(false);

    // Force document title update
    useEffect(() => {
        document.title = "WattWalker";
    }, []);

    // Listen to Auth State and User Role
    useEffect(() => {
        const timeout = setTimeout(() => {
            setAuthLoading(false);
        }, 10000);

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            // Enforce email verification.
            if (currentUser) {
                const userEmail = currentUser.email?.toLowerCase() || '';

                // Special handling for specific users (Always Premium, No Trial logic needed)
                let forcedRole: UserRole | null = null;
                if (userEmail === 'paulwalker@walkerpower.energy') {
                    forcedRole = 'premium';
                } else if (userEmail === 'jasmine@walkerpower.energy') {
                    forcedRole = 'premium';
                }

                const isVip = !!forcedRole;

                // Allow access if verified OR if they are a VIP
                if (currentUser.emailVerified || isVip) {
                    // Show splash screen once per session after login
                    const hasSeenSplash = sessionStorage.getItem('wattwalker_splash_shown');
                    if (!hasSeenSplash) {
                        setShowSplash(true);
                        sessionStorage.setItem('wattwalker_splash_shown', 'true');
                    }
                    
                    setUser(currentUser);

                    if (forcedRole) {
                        setUserRole(forcedRole);
                        setIsTrialExpired(false); // VIPs never expire
                        setShowPricingModal(false);
                    } else {
                        // Listen to User Document for Role changes and Trial Logic
                        const userDocRef = doc(db, 'users', currentUser.uid);
                        const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
                            if (docSnap.exists()) {
                                const data = docSnap.data();

                                // 1. Determine Subscription Status
                                // 'role' field is updated by Stripe/Firebase Extension (basic, pro, premium)
                                const paidRole = data.role as UserRole;
                                const hasActivePayment = paidRole === 'basic' || paidRole === 'pro' || paidRole === 'premium';

                                if (hasActivePayment) {
                                    setUserRole(paidRole);
                                    setIsTrialExpired(false);
                                    setShowPricingModal(false);
                                    setTrialDaysLeft(null); // Not in trial
                                } else {
                                    // 2. Check Trial Status
                                    const createdAt = data.createdAt || Date.now(); // Fallback for legacy users
                                    const now = Date.now();
                                    const diffMs = now - createdAt;
                                    const diffDays = diffMs / (1000 * 60 * 60 * 24);
                                    const trialDuration = 5;

                                    if (diffDays < trialDuration) {
                                        // IN TRIAL: Give them Premium access to test everything
                                        setUserRole('premium');
                                        setIsTrialExpired(false);
                                        setTrialDaysLeft(Math.ceil(trialDuration - diffDays));
                                        setShowPricingModal(false);
                                    } else {
                                        // TRIAL EXPIRED & NO PAYMENT
                                        setUserRole('basic'); // Or null, essentially restricted
                                        setIsTrialExpired(true);
                                        setTrialDaysLeft(0);
                                        // Block access
                                        setShowPricingModal(true);
                                    }
                                }

                            } else {
                                // No doc? Assume new user, reset to trial
                                setUserRole('premium');
                                setTrialDaysLeft(5);
                            }
                        });
                        return () => { unsubscribeDoc(); };
                    }

                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
                setUserRole('basic');
            }
            setAuthLoading(false);
        });
        return () => {
            clearTimeout(timeout);
            unsubscribeAuth();
        };
    }, []);

    // Load saved records on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setSavedRecords(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load saved records", e);
        }
    }, []);

    // Update showDownloadSection based on activity
    useEffect(() => {
        if (status === AnalysisStatus.ANALYZING) {
            setShowDownloadSection(false);
        } else if (status === AnalysisStatus.IDLE && savedRecords.length > 0) {
            setShowDownloadSection(true);
        }
    }, [status, savedRecords.length]);


    const getDaysInMonth = (monthStr: string): number => {
        const lower = monthStr.toLowerCase();

        // Check for leap year if year is present (e.g., "Feb 2024")
        if (lower.includes('feb')) {
            const yearMatch = monthStr.match(/\d{4}/);
            if (yearMatch) {
                const year = parseInt(yearMatch[0]);
                if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) return 29;
            }
            return 28;
        }

        if (lower.includes('jan') || lower.includes('mar') || lower.includes('may') ||
            lower.includes('jul') || lower.includes('aug') || lower.includes('oct') ||
            lower.includes('dec')) {
            return 31;
        }

        if (lower.includes('apr') || lower.includes('jun') || lower.includes('sep') ||
            lower.includes('nov')) {
            return 30;
        }

        return 30; // Default fallback
    };

    const handleImageSelected = async (file: File) => {
        // Reset states
        setResult(null);
        setCalculatedData(null);
        setSummary(null);
        setContactInfo({ address: '', email: '', phone: '' });
        setError(null);
        setShowDownloadSection(false);

        if (!isHeic(file)) {
            const imageUrl = URL.createObjectURL(file);
            setSelectedImage(imageUrl);
        }

        setStatus(AnalysisStatus.ANALYZING);
        setProcessingMessage('Checking image format...');

        let fileToProcess = file;

        // 2. HEIC Conversion
        if (isHeic(file)) {
            setProcessingMessage('Converting HEIC image to JPG...');
            try {
                fileToProcess = await convertHeicToJpg(file);
                const jpgUrl = URL.createObjectURL(fileToProcess);
                setSelectedImage(jpgUrl);
            } catch (err) {
                console.error("Conversion failed", err);
                setError("Could not convert HEIC image. Ensure backend is running or use a JPG/PNG.");
                setStatus(AnalysisStatus.ERROR);
                return;
            }
        } else if (!selectedImage) {
            setSelectedImage(URL.createObjectURL(fileToProcess));
        }

        // 3. AI Analysis
        setProcessingMessage(`Analyzing ${provider} bill data...`);
        try {
            // Use Premium Model (Gemini 3 Pro) if user is premium
            const useProModel = userRole === 'premium';

            // Pass the selected provider to the AI service
            const analysisResult = await analyzeGraphImage(fileToProcess, provider, useProModel);
            setResult(analysisResult);

            // Pre-fill address if detected (common for JCP&L bills)
            if (analysisResult.fullAddress) {
                setContactInfo(prev => ({ ...prev, address: analysisResult.fullAddress! }));
            }

            const billCost = analysisResult.billCost ?? 0;
            const billUsage = analysisResult.billUsage ?? 0;
            const pricePerKwh = (billCost > 0 && billUsage > 0) ? billCost / billUsage : 0;

            // --- Post-Processing Logic ---
            const processedData: CalculatedEnergyData[] = analysisResult.data.map(item => {
                const daysInMonth = getDaysInMonth(item.month);
                let adjustedDailyUsage = 0;
                let monthlyTotal = 0;

                if (provider === 'PSEG') {
                    // PSE&G: Graph shows Average Daily Usage
                    const roundedUsage = Math.round(item.usage);
                    // Rule: Extract daily total as whole number, then subtract 1.
                    adjustedDailyUsage = Math.max(0, roundedUsage - 1);
                    monthlyTotal = adjustedDailyUsage * daysInMonth;
                } else {
                    // ACE and JCP&L: Graph shows Total Monthly Usage directly
                    // No subtraction logic mentioned for these, just pure usage.
                    monthlyTotal = item.usage;
                    adjustedDailyUsage = monthlyTotal / daysInMonth; // Calculated for reference/chart consistency
                }

                const estimatedCost = monthlyTotal * pricePerKwh;

                return {
                    ...item,
                    adjustedDailyUsage: Number(adjustedDailyUsage.toFixed(1)), // Keep clean
                    daysInMonth,
                    monthlyTotal,
                    estimatedCost
                };
            });

            setCalculatedData(processedData);

            // Calculate Last 12 Months Summary
            const last12 = processedData.slice(-12);
            const totalUsage = last12.reduce((sum, item) => sum + item.monthlyTotal, 0);
            const averageUsage = last12.length > 0 ? totalUsage / last12.length : 0;

            setSummary({
                last12MonthsTotal: totalUsage,
                last12MonthsAverage: averageUsage
            });

            setStatus(AnalysisStatus.SUCCESS);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to analyze image");
            setStatus(AnalysisStatus.ERROR);
        }
    };

    const handleReset = () => {
        setStatus(AnalysisStatus.IDLE);
        setResult(null);
        setCalculatedData(null);
        setSummary(null);
        setContactInfo({ address: '', email: '', phone: '' });
        setError(null);
        setSelectedImage(null);
        setProcessingMessage('');
        if (savedRecords.length > 0) {
            setShowDownloadSection(true);
        }
    };

    const handleContactInfoChange = (field: string, value: string) => {
        setContactInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveToStorage = () => {
        if (!result || !calculatedData || !summary) return;

        const pricePerKwh = (result.billCost && result.billUsage) ? result.billCost / result.billUsage : 0;

        const newRecord: SavedRecord = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            provider: provider,
            customerName: result.customerName || 'Unknown',
            fullAddress: contactInfo.address,
            email: contactInfo.email,
            phoneNumber: contactInfo.phone,
            billCost: result.billCost || 0,
            billUsage: result.billUsage || 0,
            pricePerKwh: pricePerKwh,
            summary: summary,
            data: calculatedData
        };

        const updatedRecords = [...savedRecords, newRecord];
        setSavedRecords(updatedRecords);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        setShowDownloadSection(true);
    };

    // Generate transposed data for Professional View (Date in Row 1)
    const generateTransposedCSV = () => {
        // Row headers (first column)
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const rows = [
            ['Date Scanned'], // Row 1: Date/Time
            ['Utility'],      // Row 2 starts actual data fields
            ['Customer Name'],
            ['Full Address'],
            ['Current Bill Cost'],
            ['Current Month Usage'],
            ['Price per kWh'],
            ['Annual Usage'],
            ['Annual Cost'],
            ['Avg Monthly Usage'],
            ['Avg Monthly Cost'],
            ...months.map(m => [m]) // Usage rows
        ];

        savedRecords.forEach(record => {
            const dateStr = new Date(record.timestamp).toLocaleString();
            const last12Data = record.data.slice(-12);
            const annualUsage = last12Data.reduce((sum, item) => sum + item.monthlyTotal, 0);
            const annualCost = last12Data.reduce((sum, item) => sum + item.estimatedCost, 0);
            const avgMonthlyUsage = last12Data.length > 0 ? annualUsage / last12Data.length : 0;
            const avgMonthlyCost = last12Data.length > 0 ? annualCost / last12Data.length : 0;

            // Populate Columns
            rows[0].push(dateStr);
            rows[1].push(record.provider || 'PSEG');
            rows[2].push(record.customerName);
            rows[3].push(record.fullAddress || '');
            rows[4].push(`$${record.billCost.toFixed(2)}`);
            rows[5].push(record.billUsage.toString());
            rows[6].push(`$${record.pricePerKwh.toFixed(3)}`);
            rows[7].push(annualUsage.toFixed(0));
            rows[8].push(`$${annualCost.toFixed(0)}`);
            rows[9].push(avgMonthlyUsage.toFixed(0));
            rows[10].push(`$${avgMonthlyCost.toFixed(0)}`);

            const monthUsageMap = new Array(12).fill('');
            last12Data.forEach(item => {
                const idx = getMonthIndex(item.month);
                if (idx >= 0 && idx < 12) {
                    monthUsageMap[idx] = item.monthlyTotal.toFixed(0);
                }
            });

            // Append monthly data to the corresponding rows (starting at index 11)
            months.forEach((_, idx) => {
                rows[11 + idx].push(monthUsageMap[idx]);
            });
        });

        return rows.map(r => r.join(',')).join('\n');
    };

    // Standard Download for Premium (Date in Column A)
    const handleDownloadStandardCSV = () => {
        if (savedRecords.length === 0) return;
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

        const headers = [
            'Date Scanned', 'Utility', 'Customer Name', 'Full Address', 'Email', 'Phone Number',
            'Current Bill Cost', 'Current Month Usage', 'Price per kWh',
            'Annual Usage', 'Annual Cost', 'Avg Monthly Usage', 'Avg Monthly Cost',
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const csvRows = [headers.join(',')];

        savedRecords.forEach(record => {
            const dateStr = new Date(record.timestamp).toLocaleString();
            const last12Data = record.data.slice(-12);
            const annualUsage = last12Data.reduce((sum, item) => sum + item.monthlyTotal, 0);
            const annualCost = last12Data.reduce((sum, item) => sum + item.estimatedCost, 0);
            const avgMonthlyUsage = last12Data.length > 0 ? annualUsage / last12Data.length : 0;
            const avgMonthlyCost = last12Data.length > 0 ? annualCost / last12Data.length : 0;

            const monthUsageMap = new Array(12).fill('');
            last12Data.forEach(item => {
                const idx = getMonthIndex(item.month);
                if (idx >= 0 && idx < 12) {
                    monthUsageMap[idx] = item.monthlyTotal.toFixed(0);
                }
            });

            const row = [
                `"${dateStr}"`,
                `"${record.provider || 'PSEG'}"`,
                `"${record.customerName}"`,
                `"${record.fullAddress || ''}"`,
                `"${record.email || ''}"`,
                `"${record.phoneNumber || ''}"`,
                `$${record.billCost.toFixed(2)}`,
                record.billUsage,
                `$${record.pricePerKwh.toFixed(3)}`,
                annualUsage.toFixed(0),
                `$${annualCost.toFixed(0)}`,
                avgMonthlyUsage.toFixed(0),
                `$${avgMonthlyCost.toFixed(0)}`,
                ...monthUsageMap
            ];

            csvRows.push(row.join(','));
        });

        downloadFile(csvRows.join('\n'), `WattWalker_Standard_${timestamp}.csv`);
    };

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleCopyTransposed = () => {
        const csv = generateTransposedCSV();
        navigator.clipboard.writeText(csv).then(() => {
            alert("Transposed data copied to clipboard! You can paste it into Excel.");
        });
    };

    const handleClearStorage = () => {
        if (confirm("Are you sure you want to clear all saved records?")) {
            setSavedRecords([]);
            localStorage.removeItem(STORAGE_KEY);
            setShowDownloadSection(false);
        }
    };

    const handleSignOut = () => {
        signOut(auth);
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#a2dffc]">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-t-2 border-[#00a8f9] border-solid rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Auth />;
    }

    return (
        <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: '#a2dffc' }}>

            {/* Splash Screen - plays once after login */}
            {showSplash && (
                <SplashScreen onComplete={() => {
                    setShowSplash(false);
                    // Show pricing modal for new users without a subscription
                    if (!userRole || userRole === 'basic') {
                        const hasSeenPricing = sessionStorage.getItem('wattwalker_pricing_shown');
                        if (!hasSeenPricing) {
                            setShowPricingModal(true);
                            sessionStorage.setItem('wattwalker_pricing_shown', 'true');
                        }
                    }
                }} duration={5000} />
            )}

            {/* Pricing Modal */}
            {showPricingModal && user && (
                <PricingModal
                    userId={user.uid}
                    onClose={() => {
                        // If trial is expired, user CANNOT close the modal without paying
                        if (!isTrialExpired) {
                            setShowPricingModal(false);
                        }
                    }}
                />
            )}

            {/* Professional View Records Modal */}
            {showRecordsModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRecordsModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-900">Saved Records (Professional View)</h2>
                            <button onClick={() => setShowRecordsModal(false)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 overflow-auto bg-slate-100 font-mono text-xs whitespace-pre">
                            {/* Render a simple preview of the CSV text */}
                            {generateTransposedCSV()}
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button
                                onClick={handleCopyTransposed}
                                className="px-4 py-2 bg-[#00a8f9] text-white font-bold rounded-lg hover:bg-[#0096e0]"
                            >
                                Copy Transposed Data
                            </button>
                            <button
                                onClick={() => setShowRecordsModal(false)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="border-b border-white/20 bg-white shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <img src="/logo.png" alt="WattWalker Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                                WattWalker
                            </h1>
                            {trialDaysLeft !== null && trialDaysLeft > 0 && (
                                <button 
                                    onClick={() => setShowPricingModal(true)}
                                    className="text-[10px] text-orange-600 font-bold bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded inline-block w-fit cursor-pointer transition-colors"
                                >
                                    Trial: {trialDaysLeft} days left - View Plans
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {(userRole !== 'premium' || (trialDaysLeft !== null && trialDaysLeft > 0)) && (
                            <button
                                onClick={() => setShowPricingModal(true)}
                                className="hidden sm:block text-xs sm:text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-sm transition-all"
                            >
                                {trialDaysLeft !== null && trialDaysLeft > 0 ? 'View Plans' : 'Upgrade'}
                            </button>
                        )}
                        {status === AnalysisStatus.SUCCESS && (
                            <button
                                onClick={handleReset}
                                className="text-xs sm:text-sm px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#00a8f9] border border-slate-200 transition-colors font-semibold"
                            >
                                New Scan
                            </button>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="text-xs sm:text-sm px-3 py-2 rounded-lg bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 transition-colors font-semibold"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow container mx-auto px-4 py-6 sm:py-8">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">

                    {/* Left Column: Input and Download Queue */}
                    <div className="space-y-6">
                        <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-xl">
                            <div className="bg-white rounded-xl p-4 sm:p-6">
                                <div className="flex flex-col gap-3 mb-6">
                                    <h2 className="text-lg font-bold text-slate-900">1. Select Utility Provider</h2>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['PSEG', 'ACE', 'JCPL'] as UtilityProvider[]).map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => setProvider(p)}
                                                className={`py-2 px-3 rounded-lg font-bold text-sm transition-all ${provider === p
                                                        ? 'bg-[#00a8f9] text-white shadow-md'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {p === 'PSEG' ? 'PSE&G' : p === 'JCPL' ? 'JCP&L' : p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <h2 className="text-lg font-bold mb-4 text-slate-900">2. Upload Bill Graph</h2>
                                <ImageUploader
                                    onImageSelected={handleImageSelected}
                                    selectedImage={selectedImage}
                                    disabled={status === AnalysisStatus.ANALYZING}
                                />
                                <div className="mt-4 text-xs sm:text-sm text-slate-500">
                                    <p className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#00a8f9]">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                        {provider === 'PSEG' ? 'Detecting Average Daily Usage' : 'Detecting Monthly Total Usage (Blue Bars)'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Download/View Section - Only visible to Pro/Premium */}
                        {showDownloadSection && savedRecords.length > 0 && userRole !== 'basic' && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-4 sm:p-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-slate-900 font-semibold">Saved Records</h3>
                                        <p className="text-slate-500 text-sm">{savedRecords.length} items</p>
                                    </div>
                                    <button onClick={handleClearStorage} className="text-xs text-red-500 hover:text-red-700 font-medium">
                                        Clear
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    {userRole === 'premium' ? (
                                        <button
                                            onClick={handleDownloadStandardCSV}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-[#00a8f9] border border-blue-100 rounded-lg transition-colors font-bold text-sm"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                                            </svg>
                                            Download Spreadsheet
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setShowRecordsModal(true)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-colors font-bold text-sm"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 8.201 2.665 9.336 6.41.147.481.147.99 0 1.476C18.201 14.335 14.257 17 10 17c-4.257 0-8.201-2.665-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                            View Records
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {status === AnalysisStatus.ERROR && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-600 mt-0.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                <div>
                                    <h3 className="text-red-800 font-medium text-sm">Analysis Failed</h3>
                                    <p className="text-red-600 text-xs mt-1">{error}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Results */}
                    <div className="h-full min-h-[400px] sm:min-h-[500px]">
                        {status === AnalysisStatus.IDLE && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-white/50 shadow-sm">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 text-slate-700 shadow-md">
                                    <img src="/logo.png" alt="WattWalker Logo" className="w-12 h-12 object-contain" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800">Ready to WattWalk</h3>
                                <p className="text-slate-500 mt-2 max-w-sm text-sm">
                                    Select a provider and upload a bill to analyze.
                                </p>
                                {userRole === 'basic' && (
                                    <p className="text-xs text-slate-400 mt-4 bg-slate-100 px-3 py-1 rounded-full">
                                        Currently using Basic Tier
                                    </p>
                                )}
                            </div>
                        )}

                        {status === AnalysisStatus.ANALYZING && (
                            <div className="h-full flex items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-lg">
                                <LoadingState message={processingMessage} />
                            </div>
                        )}

                        {status === AnalysisStatus.SUCCESS && result && calculatedData && (
                            <DataVisualizer
                                data={calculatedData}
                                metadata={result.metadata}
                                summary={summary}
                                customerName={result.customerName}
                                billCost={result.billCost}
                                billUsage={result.billUsage}
                                onSaveRecord={handleSaveToStorage}
                                contactInfo={contactInfo}
                                onContactInfoChange={handleContactInfoChange}
                                provider={provider}
                                userRole={userRole}
                                onUpgradeClick={() => setShowPricingModal(true)}
                                saveStatus={saveStatus}
                            />
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
};

export default App;