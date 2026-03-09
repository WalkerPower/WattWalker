import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResponse, UtilityProvider } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      - **Y-Axis Labels**: List EVERY number label explicitly written on the Y-axis.
        - "yAxisMin": lowest number.
        - "yAxisMax": highest number.
      - **X-Axis**: Identify the month labels.
    `;

    // Provider Specific Instructions for Graph Bars
    if (provider === 'ACE') {
        prompt += `
      **Task 3: Extract Graph Data Points (ACE Specific)**
      - The bars represent **TOTAL MONTHLY USAGE (kWh)**.
      - **CRITICAL**: The graph likely compares this year vs last year. 
      - **ONLY measure the BLUE bars** (representing the current year). Ignore gray or other colored bars.
      - Estimate the kWh value for each BLUE bar based on the Y-axis.
        `;
    } else if (provider === 'JCPL') {
        prompt += `
      **Task 3: Extract Graph Data Points (JCP&L Specific)**
      - The bars represent **TOTAL MONTHLY USAGE (kWh)**.
      - Look for the "Usage History" graph.
      - The bars may be labeled with 'A' (Actual), 'E' (Estimate), or 'C' (Customer). Treat all these bars as valid usage.
      - Extract the value for each bar corresponding to the month labels on the X-axis.
      - Estimate the kWh value based on the Y-axis height.
        `;
    } else {
        // Default to PSE&G logic
        prompt += `
      **Task 3: Extract Graph Data Points (PSE&G Specific)**
      - The bars represent **AVERAGE DAILY USAGE (kWh)**.
      - For each bar, estimate the daily usage value based on the Y-axis.
        `;
    }

    // Select model based on user tier
    // Gemini 3.1 Pro for Premium users (better reasoning), Gemini 3.1 Flash Lite for Basic/Pro
    const modelName = useProModel ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview';

    const response = await ai.models.generateContent({
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
                  month: { type: Type.STRING },
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