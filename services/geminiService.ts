import { AnalysisResponse, UtilityProvider } from "../types";

// Configuration for the analysis endpoint
const ANALYZE_ENDPOINT = '/analyze';

export const analyzeGraphImage = async (file: File, provider: UtilityProvider, useProModel: boolean = false): Promise<AnalysisResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('provider', provider);
  formData.append('isPremium', useProModel.toString());

  try {
    const response = await fetch(ANALYZE_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Analysis failed: ${response.statusText}`);
    }

    const result: AnalysisResponse = await response.json();

    if (result.error) {
      throw new Error(`${result.error}: ${result.details || 'Unknown error'}`);
    }

    if (!result.data || !Array.isArray(result.data)) {
      throw new Error("Invalid data format received from backend");
    }

    return result;

  } catch (error) {
    console.error("Error analyzing graph:", error);
    throw error;
  }
};
