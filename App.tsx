import React, { useState, useEffect, useRef } from 'react';
import ImageUploader from './components/ImageUploader';
import DataVisualizer from './components/DataVisualizer';
import LoadingState from './components/LoadingState';
import Auth from './components/Auth';
import PricingModal from './components/PricingModal';
import SplashScreen from './components/SplashScreen';
import LeadsList from './components/LeadsList';
import { analyzeGraphImage } from './services/geminiService';
import { isHeic, convertHeicToJpg } from './services/imageService';
import { auth } from './services/firebase';
import { subscribeToStripeSubscription } from './services/subscriptionFirestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AnalysisResponse, AnalysisStatus, CalculatedEnergyData, CalculationSummary, SavedRecord, UtilityProvider, UserRole } from './types';
import { calendarMonthIndexForCsv } from './utils/billMonth';
import { formatPricePerKwhForPresentation, parsePricePerKwhInput } from './utils/pricePerKwh';

const STORAGE_KEY = 'wattwalker_saved_records';

function escapeCsvCell(val: string): string {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/** App owners: same inbox for @njsolar.today and @walkerpower.energy; match is case-insensitive */
function isVipEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const e = email.trim().toLowerCase();
    const at = e.indexOf('@');
    if (at < 1) return false;
    const local = e.slice(0, at);
    const domain = e.slice(at + 1);
    if (domain !== 'walkerpower.energy' && domain !== 'njsolar.today') return false;
    return local === 'paulwalker' || local === 'jasmine';
}

/** Manual Premium (Zelle / comp): same app treatment as VIP; remove when they pay via Stripe or term ends */
const COMPED_PREMIUM_EMAILS = new Set(['wayne@yourpartnerinsolar.com']);

function isCompedPremiumEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return COMPED_PREMIUM_EMAILS.has(email.trim().toLowerCase());
}

function formatAnalysisError(err: unknown): string {
    if (err instanceof Error) {
        try {
            const parsed = JSON.parse(err.message) as { error?: { message?: string } };
            if (parsed?.error?.message) return parsed.error.message;
        } catch {
            /* plain text message */
        }
        return err.message;
    }
    return 'Failed to analyze image';
}

const App: React.FC = () => {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole>('basic');
    const [authLoading, setAuthLoading] = useState(true);

    // Subscription: bill analysis requires Stripe role (basic / pro / premium) or VIP
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

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
    const [contactInfo, setContactInfo] = useState({
        address: '',
        email: '',
        phone: '',
        notes: '',
        pricePerKwh: '',
    });

    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageFromCamera, setImageFromCamera] = useState(false);
    const [imageSaveStatus, setImageSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Storage State
    const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
    const [showDownloadSection, setShowDownloadSection] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');

    // Professional View Records Modal
    const [showRecordsModal, setShowRecordsModal] = useState(false);
    const [proSearchUpsellBlocking, setProSearchUpsellBlocking] = useState(false);
    const proSearchGateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Premium lead hub (full-screen list + search)
    const [showLeadsList, setShowLeadsList] = useState(false);

    // Splash Screen State - shows once per session after login
    const [showSplash, setShowSplash] = useState(false);

    // Force document title update
    useEffect(() => {
        document.title = "WattWalker";
    }, []);

    useEffect(() => {
        if (!showRecordsModal) {
            if (proSearchGateTimerRef.current) {
                clearTimeout(proSearchGateTimerRef.current);
                proSearchGateTimerRef.current = null;
            }
            setProSearchUpsellBlocking(false);
        }
    }, [showRecordsModal]);

    const stripeSubUnsubRef = useRef<(() => void) | null>(null);

    // Listen to Auth State and Stripe subscription (Firebase extension path)
    useEffect(() => {
        const timeout = setTimeout(() => {
            setAuthLoading(false);
        }, 10000);

        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            stripeSubUnsubRef.current?.();
            stripeSubUnsubRef.current = null;

            if (currentUser) {
                const isVip = isVipEmail(currentUser.email);
                const isComped = isCompedPremiumEmail(currentUser.email);
                const forcedRole: UserRole | null = isVip || isComped ? 'premium' : null;

                if (currentUser.emailVerified || isVip || isComped) {
                    const hasSeenSplash = sessionStorage.getItem('wattwalker_splash_shown');
                    if (!hasSeenSplash) {
                        setShowSplash(true);
                        sessionStorage.setItem('wattwalker_splash_shown', 'true');
                    }

                    setUser(currentUser);

                    if (forcedRole) {
                        setUserRole(forcedRole);
                        setHasActiveSubscription(true);
                        setShowPricingModal(false);
                        sessionStorage.setItem('wattwalker_pricing_shown', 'true');
                    } else {
                        // Stripe extension syncs to customers/{uid}/subscriptions — not users.role
                        stripeSubUnsubRef.current = subscribeToStripeSubscription(
                            currentUser.uid,
                            ({ hasActiveSubscription: active, userRole: role }) => {
                                setUserRole(role);
                                setHasActiveSubscription(active);
                                if (active) setShowPricingModal(false);
                            }
                        );
                    }
                } else {
                    setUser(null);
                    setHasActiveSubscription(false);
                }
            } else {
                setUser(null);
                setUserRole('basic');
                setHasActiveSubscription(false);
            }
            setAuthLoading(false);
        });
        return () => {
            clearTimeout(timeout);
            stripeSubUnsubRef.current?.();
            stripeSubUnsubRef.current = null;
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

    const handleSaveImageToDevice = async () => {
        if (!selectedImage) return;
        
        setImageSaveStatus('saving');
        
        try {
            const response = await fetch(selectedImage);
            const blob = await response.blob();
            const timestamp = new Date().toISOString().slice(0, 10);
            const filename = `WattWalker_Bill_${timestamp}.jpg`;
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            setImageSaveStatus('saved');
            setTimeout(() => setImageSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Error saving image:', error);
            alert('Failed to save image. Please try again.');
            setImageSaveStatus('idle');
        }
    };

    const handleImageSelected = async (file: File, fromCamera: boolean = false) => {
        if (!hasActiveSubscription) {
            setShowPricingModal(true);
            return;
        }

        // Reset states
        setResult(null);
        setCalculatedData(null);
        setSummary(null);
        setContactInfo({ address: '', email: '', phone: '', notes: '', pricePerKwh: '' });
        setError(null);
        setShowDownloadSection(false);
        setImageFromCamera(fromCamera);
        setImageSaveStatus('idle');

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
            const useProModel = hasActiveSubscription && userRole === 'premium';

            // Pass the selected provider to the AI service
            const analysisResult = await analyzeGraphImage(fileToProcess, provider, useProModel);
            setResult(analysisResult);

            const billCost = analysisResult.billCost ?? 0;
            const billUsage = analysisResult.billUsage ?? 0;
            const pricePerKwh = (billCost > 0 && billUsage > 0) ? billCost / billUsage : 0;

            setContactInfo((prev) => ({
                ...prev,
                ...(analysisResult.fullAddress ? { address: analysisResult.fullAddress } : {}),
                pricePerKwh: pricePerKwh > 0 ? pricePerKwh.toFixed(3) : '',
            }));

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

            // Rightmost bar = current period on the graph; align with bill text totals (billUsage / billCost).
            // Graph-only estimates often drift from "Total electric used this month" on the bill.
            if (billUsage > 0 && processedData.length > 0) {
                const i = processedData.length - 1;
                const row = processedData[i];
                const days = row.daysInMonth > 0 ? row.daysInMonth : 30;
                const avgDaily = billUsage / days;
                processedData[i] = {
                    ...row,
                    monthlyTotal: billUsage,
                    adjustedDailyUsage: Number(avgDaily.toFixed(1)),
                    estimatedCost: pricePerKwh > 0 ? billUsage * pricePerKwh : row.estimatedCost,
                    usage: provider === 'PSEG' ? Number(avgDaily.toFixed(1)) : billUsage
                };
            }

            // JCP&L: "Last 12 Months Use (KWH)" on bill must equal sum of the rightmost 12 bars.
            // Keep current month = billUsage; scale the other 11 months in that window proportionally.
            if (provider === 'JCPL' && processedData.length >= 12) {
                const annualKwh = analysisResult.last12MonthsBillKwh ?? 0;
                if (annualKwh > 0) {
                    const n = processedData.length;
                    const lastIdx = n - 1;
                    const firstOf12 = n - 12;
                    const currentMonthKwh = processedData[lastIdx].monthlyTotal;
                    const targetPrior11 = annualKwh - currentMonthKwh;
                    if (targetPrior11 >= 0) {
                        let sumPrior11 = 0;
                        for (let j = firstOf12; j < lastIdx; j++) {
                            sumPrior11 += processedData[j].monthlyTotal;
                        }
                        if (sumPrior11 > 0) {
                            const scale = targetPrior11 / sumPrior11;
                            for (let j = firstOf12; j < lastIdx; j++) {
                                const row = processedData[j];
                                const newTotal = row.monthlyTotal * scale;
                                const d = row.daysInMonth > 0 ? row.daysInMonth : 30;
                                processedData[j] = {
                                    ...row,
                                    monthlyTotal: newTotal,
                                    adjustedDailyUsage: Number((newTotal / d).toFixed(1)),
                                    usage: newTotal,
                                    estimatedCost:
                                        pricePerKwh > 0 ? newTotal * pricePerKwh : row.estimatedCost
                                };
                            }
                            let sum12 = 0;
                            for (let j = firstOf12; j <= lastIdx; j++) {
                                sum12 += processedData[j].monthlyTotal;
                            }
                            const drift = annualKwh - sum12;
                            if (Math.abs(drift) > 1e-5) {
                                const fixIdx = lastIdx - 1;
                                const row = processedData[fixIdx];
                                const newTotal = row.monthlyTotal + drift;
                                const d = row.daysInMonth > 0 ? row.daysInMonth : 30;
                                processedData[fixIdx] = {
                                    ...row,
                                    monthlyTotal: newTotal,
                                    adjustedDailyUsage: Number((newTotal / d).toFixed(1)),
                                    usage: newTotal,
                                    estimatedCost:
                                        pricePerKwh > 0 ? newTotal * pricePerKwh : row.estimatedCost
                                };
                            }
                        }
                    }
                }
            }

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
        } catch (err: unknown) {
            console.error(err);
            setError(formatAnalysisError(err));
            setStatus(AnalysisStatus.ERROR);
        }
    };

    const handleReset = () => {
        setStatus(AnalysisStatus.IDLE);
        setResult(null);
        setCalculatedData(null);
        setSummary(null);
        setContactInfo({ address: '', email: '', phone: '', notes: '', pricePerKwh: '' });
        setError(null);
        setSelectedImage(null);
        setProcessingMessage('');
        if (savedRecords.length > 0) {
            setShowDownloadSection(true);
        }
    };

    const handleContactInfoChange = (field: string, value: string) => {
        setContactInfo((prev) => ({ ...prev, [field]: value }));
        if (field === 'pricePerKwh' && result) {
            const rate = parsePricePerKwhInput(value, result.billCost ?? 0, result.billUsage ?? 0);
            setCalculatedData((prevData) => {
                if (!prevData) return null;
                return prevData.map((row) => ({
                    ...row,
                    estimatedCost: rate > 0 ? row.monthlyTotal * rate : 0,
                }));
            });
        }
    };

    const handleUpdateLeadNotes = (recordId: string, notes: string) => {
        setSavedRecords((prev) => {
            const next = prev.map((r) => (r.id === recordId ? { ...r, notes } : r));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const handleProRecordSearchFocus = () => {
        if (userRole !== 'pro') return;
        setProSearchUpsellBlocking(true);
        if (proSearchGateTimerRef.current) {
            clearTimeout(proSearchGateTimerRef.current);
        }
        proSearchGateTimerRef.current = setTimeout(() => {
            setProSearchUpsellBlocking(false);
            proSearchGateTimerRef.current = null;
        }, 5000);
    };

    const handleProSearchUpgradeClick = () => {
        if (proSearchGateTimerRef.current) {
            clearTimeout(proSearchGateTimerRef.current);
            proSearchGateTimerRef.current = null;
        }
        setProSearchUpsellBlocking(false);
        setShowPricingModal(true);
    };

    const handleSaveToStorage = () => {
        if (!result || !calculatedData || !summary) return;

        const pricePerKwh = parsePricePerKwhInput(
            contactInfo.pricePerKwh,
            result.billCost || 0,
            result.billUsage || 0
        );

        const notesTrimmed = (contactInfo.notes ?? '').slice(0, 150);

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
            data: calculatedData,
            notes: notesTrimmed || undefined,
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
            ...months.map(m => [m]), // Usage rows (January–December)
            ['Notes'],
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
            rows[6].push(formatPricePerKwhForPresentation(record.pricePerKwh));
            rows[7].push(annualUsage.toFixed(0));
            rows[8].push(`$${annualCost.toFixed(0)}`);
            rows[9].push(avgMonthlyUsage.toFixed(0));
            rows[10].push(`$${avgMonthlyCost.toFixed(0)}`);

            const monthUsageMap = new Array(12).fill('');
            last12Data.forEach(item => {
                const idx = calendarMonthIndexForCsv(item.month);
                if (idx >= 0 && idx < 12) {
                    monthUsageMap[idx] = item.monthlyTotal.toFixed(0);
                }
            });

            // Append monthly data to the corresponding rows (starting at index 11)
            months.forEach((_, idx) => {
                rows[11 + idx].push(monthUsageMap[idx]);
            });

            rows[23].push(escapeCsvCell(record.notes ?? ''));
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
            'July', 'August', 'September', 'October', 'November', 'December',
            'Notes',
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
                const idx = calendarMonthIndexForCsv(item.month);
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
                formatPricePerKwhForPresentation(record.pricePerKwh),
                annualUsage.toFixed(0),
                `$${annualCost.toFixed(0)}`,
                avgMonthlyUsage.toFixed(0),
                `$${avgMonthlyCost.toFixed(0)}`,
                ...monthUsageMap,
                escapeCsvCell(record.notes ?? ''),
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
                    if (!hasActiveSubscription) {
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
                    onClose={() => setShowPricingModal(false)}
                />
            )}

            {showLeadsList && userRole === 'premium' && (
                <LeadsList
                    records={savedRecords}
                    userRole={userRole}
                    onClose={() => setShowLeadsList(false)}
                    onUpdateNotes={handleUpdateLeadNotes}
                />
            )}

            {/* Professional View Records Modal */}
            {showRecordsModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRecordsModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
                            <div className="flex justify-between items-center gap-2">
                                <h2 className="text-xl font-bold text-slate-900">Saved Records (Professional View)</h2>
                                <button type="button" onClick={() => setShowRecordsModal(false)} className="text-slate-400 hover:text-slate-600 shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            {userRole === 'pro' && (
                                <label className="block">
                                    <span className="sr-only">Search records</span>
                                    <input
                                        type="search"
                                        autoComplete="off"
                                        placeholder="Search records…"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00a8f9] focus:border-transparent bg-white"
                                        onFocus={handleProRecordSearchFocus}
                                    />
                                </label>
                            )}
                        </div>
                        <div className="relative flex-1 min-h-0 flex flex-col">
                            {userRole === 'pro' && proSearchUpsellBlocking && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/95 px-6 py-8 text-center">
                                    <p className="text-slate-800 font-semibold text-sm sm:text-base max-w-sm">
                                        Advanced Search only available in Premium subscription
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleProSearchUpgradeClick}
                                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-black tracking-wide shadow-md"
                                    >
                                        UPGRADE
                                    </button>
                                </div>
                            )}
                            <div className="flex-1 overflow-auto p-4 bg-slate-100 font-mono text-xs whitespace-pre min-h-[200px]">
                                {generateTransposedCSV()}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCopyTransposed}
                                className="px-4 py-2 bg-[#00a8f9] text-white font-bold rounded-lg hover:bg-[#0096e0]"
                            >
                                Copy Transposed Data
                            </button>
                            <button
                                type="button"
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
                            {!hasActiveSubscription && (
                                <button
                                    type="button"
                                    onClick={() => setShowPricingModal(true)}
                                    className="text-[10px] text-orange-600 font-bold bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded inline-block w-fit cursor-pointer transition-colors"
                                >
                                    Subscribe to analyze bills
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!hasActiveSubscription && (
                            <button
                                type="button"
                                onClick={() => setShowPricingModal(true)}
                                className="hidden sm:block text-xs sm:text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-sm transition-all"
                            >
                                View plans
                            </button>
                        )}
                        {hasActiveSubscription && userRole !== 'premium' && (
                            <button
                                type="button"
                                onClick={() => setShowPricingModal(true)}
                                className="hidden sm:block text-xs sm:text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold shadow-sm transition-all"
                            >
                                Upgrade
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

                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-slate-900">2. Upload Bill Graph</h2>
                                    {imageFromCamera && selectedImage && (
                                        <button
                                            onClick={handleSaveImageToDevice}
                                            disabled={imageSaveStatus === 'saving'}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            {imageSaveStatus === 'saving' ? (
                                                <>
                                                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Saving...
                                                </>
                                            ) : imageSaveStatus === 'saved' ? (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Saved!
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    Save to Device
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <ImageUploader
                                    onImageSelected={handleImageSelected}
                                    selectedImage={selectedImage}
                                    disabled={status === AnalysisStatus.ANALYZING}
                                    canSelectBillImage={hasActiveSubscription}
                                    onRequireSubscription={() => setShowPricingModal(true)}
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
                                <div className="flex flex-col sm:flex-row gap-3">
                                    {userRole === 'premium' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowLeadsList(true)}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-lg transition-colors font-bold text-sm order-first sm:order-none"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path d="M10 3.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM2 10a8 8 0 1114.32 4.906l3.387 3.387a.75.75 0 11-1.06 1.06l-3.387-3.387A8 8 0 012 10z" />
                                                </svg>
                                                My Leads
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDownloadStandardCSV}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-[#00a8f9] border border-blue-100 rounded-lg transition-colors font-bold text-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                                                </svg>
                                                Download Spreadsheet
                                            </button>
                                        </>
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
                                {!hasActiveSubscription && (
                                    <p className="text-xs text-amber-700 mt-4 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg max-w-sm">
                                        Choose a plan to upload and analyze bills.
                                    </p>
                                )}
                                {hasActiveSubscription && userRole === 'basic' && (
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