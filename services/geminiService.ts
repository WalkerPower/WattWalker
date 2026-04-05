import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, UtilityProvider } from "../types";

// Lazy initialization - only create client when needed
let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error("Gemini API key is not configured. Please contact support.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

/**
 * Converts a File object to a Base64 string.
 */
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeGraphImage = async (file: File, provider: UtilityProvider, useProModel: boolean = false): Promise<AnalysisResponse> => {
  try {
    const imagePart = await fileToGenerativePart(file);

    let prompt = `
      Analyze the attached image, which is an electricity bill or usage graph for ${provider}.

      **Task 1: Extract Bill Details**
      - **Customer Name**: Find the First and Last Name. If multiple, use the first one found (e.g. under "Bill For").
      - **Full Address**: Extract the full service address (Street, City, State, Zip) often found under the customer name or "Service Address".
      - **Bill Cost**: Extract the total amount due/current charges ($).
      - **Consistency**: The **Total Usage (Current Month)** value you extract from the bill text (used for billUsage) MUST be the same total kWh represented by the **rightmost bar** on the usage graph for the current billing period. The graph bar for that month must reflect that total (for PSE&G: total kWh for the period; the graph may show average daily, but that bar corresponds to this total divided by days in that billing month).
    `;

    // Provider Specific Instructions for Bill Usage (Current Month)
    if (provider === 'ACE') {
        prompt += `
      - **Total Usage (Current Month)**: Look for line items labeled "Basic Generation Service". 
        - If there are multiple lines (e.g., "First X kWh", "Next Y kWh"), SUM them together to get the total kWh.
        - If not found, look for "Total kWh" or similar.
        `;
    } else {
        prompt += `
      - **Total Usage (Current Month)**: Extract the total kWh used in this billing period.
        `;
    }

    prompt += `
      **Task 2: Identify Axis Scales (Graph Analysis)**
      - **Typical NJ usage graph layout**: The bar chart is usually a **rectangle** with **kWh** on the **vertical (left)** axis. Bars start at **zero** (no bar extends below zero). The **month** for each bar is shown with a **1–3 letter abbreviation** (or full month name) **below** that chart area, along the bottom—not plotted as a Y-axis value above zero.
      - **Y-Axis Labels**: List EVERY number label explicitly written on the Y-axis.
        - "yAxisMin": lowest number.
        - "yAxisMax": highest number.
      - **X-Axis / months**: Use **only** the labels **under** the bar group that denote **calendar months** (e.g. J F M A M J J A S O N D or Mar, Apr, Aug). JCP&L also shows **A / E / C** (**Actual / Estimate / Customer**) **inside the chart rectangle**, on or above each bar—these are **not** month labels; see JCP&L instructions below.
    `;

    // Provider Specific Instructions for Graph Bars
    if (provider === 'ACE') {
        prompt += `
      **Task 3: Extract Graph Data Points (ACE Specific)**
      - The bars represent **TOTAL MONTHLY USAGE (kWh)**.
      - **CRITICAL**: The graph likely compares this year vs last year. 
      - **ONLY measure the BLUE bars** (representing the current year). Ignore gray or other colored bars.
      - Estimate the kWh value for each BLUE bar based on the Y-axis.
      - **Rightmost BLUE bar** (most recent month): Its kWh value must match **billUsage** (total kWh for that month from the bill / generation charges), not a conflicting estimate.
        `;
    } else if (provider === 'JCPL') {
        prompt += `
      **JCP&L — Annual total (required)**
      - Below the Usage History graph, in the **"This Year"** section, find **"Last 12 Months Use (KWH)"** (or the same meaning, e.g. annual / rolling 12‑month kWh).
      - Return that exact integer as **last12MonthsBillKwh**. The sum of the **last 12 months** of bar data must equal this number together with **billUsage** for the current (rightmost) month.

      **Task 3: Extract Graph Data Points (JCP&L Specific)**
      - The bars represent **TOTAL MONTHLY USAGE (kWh)** for each month on the Usage History graph.
      - **CRITICAL — Two different letter rows under the chart (do not confuse them):**
        1. **Reading-type letters** (legend **A**=Actual, **E**=Estimate, **C**=Customer): appear **inside the graph rectangle**, on or **above** each bar. They mean **meter read type**, not the month. **Do not** put **only** A, E, or C from **these** positions into \`month\`. **April** and **August** are normal months—use the **month labels below the chart** and output **Apr 2025** / **Aug 2025** (or **MMM YYYY**).
        2. **Month row**: The **month initials or names** printed **below** the bar chart identify each bar’s calendar month. Use **that** row plus statement dates to assign each bar’s \`month\`.
      - For **each bar left to right**, output \`month\` as **three-letter month + space + 4-digit year** (e.g. **Sep 2024**, **Oct 2024**, … **Sep 2025** for the rightmost bar if that is the current period). Use the bill’s statement date and billing period to infer years so **June vs July** and **April vs August** are never ambiguous.
      - Estimate kWh from the **bar height** and Y-axis.
      - **Rightmost bar** kWh must match **billUsage** for the current billing period.
        `;
    } else {
        // Default to PSE&G logic
        prompt += `
      **Task 3: Extract Graph Data Points (PSE&G Specific)**
      - The bars represent **AVERAGE DAILY USAGE (kWh)**.
      - For each bar, estimate the daily usage value based on the Y-axis.
      - **Rightmost bar (current / most recent month on the graph)**: Its implied **monthly total** (average daily × number of days in that month on the graph) must match the **Total Usage (Current Month)** you report in billUsage. Adjust your reading of that bar if needed so the numbers agree.
        `;
    }

    // Select model based on user tier
    // Gemini 3.1 Pro for Premium users (better reasoning), Gemini 3.1 Flash Lite for Basic/Pro
    const modelName = useProModel ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';

    const monthFieldDescription =
      provider === 'JCPL'
        ? 'REQUIRED format "MMM YYYY" (e.g. Apr 2025, Aug 2025, Sep 2025). One per bar left to right. Do not use lone A/E/C from the Actual/Estimate/Customer row; April and August must be Apr/Aug with year.'
        : provider === 'PSEG'
          ? 'Month label for the bar (as on the graph axis).'
          : 'Month label for the bar (as on the graph axis).';

    const response = await getAI().models.generateContent({
      model: modelName,
      contents: {
        parts: [
          imagePart,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: "First and Last Name of the customer" },
            fullAddress: { type: Type.STRING, description: "Full Service Address (Street, City, State, Zip)" },
            billCost: { type: Type.NUMBER, description: "Total cost of the current bill" },
            billUsage: { type: Type.NUMBER, description: "Total kWh usage for the current bill" },
            last12MonthsBillKwh: {
              type: Type.NUMBER,
              description:
                "JCP&L only: integer kWh from 'Last 12 Months Use (KWH)' in This Year below graph; omit or 0 if not JCP&L or not visible",
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                yAxisMin: { type: Type.NUMBER },
                yAxisMax: { type: Type.NUMBER },
                yAxisLabels: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER } 
                }
              },
              required: ['yAxisMin', 'yAxisMax', 'yAxisLabels']
            },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  month: { type: Type.STRING, description: monthFieldDescription },
                  usage: { type: Type.NUMBER, description: provider === 'PSEG' ? "Average Daily Usage" : "Total Monthly Usage" }
                },
                required: ['month', 'usage']
              }
            }
          },
          required: ['metadata', 'data']
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from Gemini.");
    }

    const result: AnalysisResponse = JSON.parse(text);
    
    if (!result.data || !Array.isArray(result.data)) {
        throw new Error("Invalid data format received from AI");
    }
    
    return result;

  } catch (error) {
    console.error("Error analyzing graph:", error);
    throw error;
  }
};

/**
 * OCR the first page of a bill to extract only the **service address** (not mailing address).
 * PSE&G: section labeled "SERVICE ADDRESS" (often with a small house icon).
 * Atlantic City Electric (ACE): text after the label "Service Address:".
 */
export const extractServiceAddressFromBillPage = async (
  file: File,
  provider: 'PSEG' | 'ACE',
  useProModel: boolean = true
): Promise<string> => {
  const imagePart = await fileToGenerativePart(file);

  const providerLines =
    provider === 'ACE'
      ? `
      This is an **Atlantic City Electric (ACE)** bill first page.
      Find the line or label **"Service Address:"** (spacing/case may vary).
      Extract **only** the service address text **immediately following** that label — typically the street line and the city, state, and ZIP line(s).
      Do **not** use the payment coupon duplicate unless the header block is unreadable.
      Do **not** confuse with mailing address or account names.
      `
      : `
      This is a **PSE&G (PSEG)** energy bill first page.
      Find the section headed **"SERVICE ADDRESS"** (often shown in bold uppercase, sometimes near a small house icon).
      Extract **only** the address lines under that heading (street, then city/state/ZIP including ZIP+4 if shown).
      Do **not** use customer name, account number, or mailing address blocks.
      `;

  const prompt = `
      You are reading a photo of the first page of a New Jersey electric utility bill.

      ${providerLines}

      **Output**: Return the full service address as a single string suitable for a form field.
      Use a comma between street and city if both are present (e.g. "123 MAIN ST, TOWN NJ 08081").
      Preserve digits and abbreviations as printed. If the service address cannot be found, return an empty string.
    `;

  const modelName = useProModel ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';

  const response = await getAI().models.generateContent({
    model: modelName,
    contents: {
      parts: [imagePart, { text: prompt }],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullAddress: {
            type: Type.STRING,
            description: 'Service address only; empty if not found',
          },
        },
        required: ['fullAddress'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('No data returned from AI for address extraction.');
  }

  const parsed = JSON.parse(text) as { fullAddress?: string };
  return (parsed.fullAddress ?? '').trim();
};