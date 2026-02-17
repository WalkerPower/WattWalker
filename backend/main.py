from fastapi import FastAPI, File, UploadFile, Response, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pillow_heif
import io
import os
import google.generativeai as genai
import json

# Register HEIF opener to allow Pillow to handle HEIC files
pillow_heif.register_heif_opener()

app = FastAPI()

# Configure CORS to allow requests from the React app (and React Native in future)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/convert")
@app.post("/convert/")
async def convert_heic_to_jpg(file: UploadFile = File(...)):
    # Read the uploaded file bytes
    content = await file.read()
    
    # Open image using Pillow (uses pillow-heif automatically)
    image = Image.open(io.BytesIO(content))
    
    # Convert to RGB (standard for JPEG)
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    # Save as JPEG with 95% quality
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=95)
    output.seek(0)
    
    # Return the raw JPEG bytes
    return Response(content=output.getvalue(), media_type="image/jpeg")

from pydantic import BaseModel
from typing import List, Optional

# Initialize Gemini
api_key = os.environ.get("API_KEY")
if api_key:
    genai.configure(api_key=api_key)

@app.post("/analyze")
@app.post("/analyze/")
async def analyze_bill(
    provider: str = Form(...),
    isPremium: str = Form(...),  # Received as "true" or "false"
    file: UploadFile = File(...)
):
    try:
        # Convert string bool to actual bool
        premium_bool = isPremium.lower() == "true"
        
        print(f"Starting analysis for provider: {provider}, Premium: {premium_bool}")
        
        content = await file.read()
        if not content:
            return {"error": "Empty file uploaded"}

        # Ensure AI is configured
        if not os.environ.get("API_KEY"):
            return {"error": "API_KEY not found in environment variables"}
        
        genai.configure(api_key=os.environ.get("API_KEY"))
        
        model_name = "gemini-3-pro-preview" if premium_bool else "gemini-3-flash-preview"
        print(f"Using model: {model_name}")
        model = genai.GenerativeModel(model_name)
        
        prompt = f"""
          Analyze the attached image, which is an electricity bill or usage graph for {provider}.

          **Task 1: Extract Bill Details**
          - **Customer Name**: Find the First and Last Name. If multiple, use the first one found (e.g. under "Bill For").
          - **Full Address**: Extract the full service address (Street, City, State, Zip) often found under the customer name or "Service Address".
          - **Bill Cost**: Extract the total amount due/current charges ($).
        """

        if provider == 'ACE':
            prompt += """
          - **Total Usage (Current Month)**: Look for line items labeled "Basic Generation Service". 
            - If there are multiple lines (e.g., "First X kWh", "Next Y kWh"), SUM them together to get the total kWh.
            - If not found, look for "Total kWh" or similar.
            """
        else:
            prompt += """
          - **Total Usage (Current Month)**: Extract the total kWh used in this billing period.
            """

        prompt += """
          **Task 2: Identify Axis Scales (Graph Analysis)**
          - **Y-Axis Labels**: List EVERY number label explicitly written on the Y-axis.
            - "yAxisMin": lowest number.
            - "yAxisMax": highest number.
          - **X-Axis**: Identify the month labels.
        """

        if provider == 'ACE':
            prompt += """
          **Task 3: Extract Graph Data Points (ACE Specific)**
          - The bars represent **TOTAL MONTHLY USAGE (kWh)**.
          - **CRITICAL**: The graph likely compares this year vs last year. 
          - **ONLY measure the BLUE bars** (representing the current year). Ignore gray or other colored bars.
          - Estimate the kWh value for each BLUE bar based on the Y-axis.
            """
        elif provider == 'JCPL':
            prompt += """
          **Task 3: Extract Graph Data Points (JCP&L Specific)**
          - The bars represent **TOTAL MONTHLY USAGE (kWh)**.
          - Look for the "Usage History" graph.
          - The bars may be labeled with 'A' (Actual), 'E' (Estimate), or 'C' (Customer). Treat all these bars as valid usage.
          - Extract the value for each bar corresponding to the month labels on the X-axis.
          - Estimate the kWh value based on the Y-axis height.
            """
        else:
            prompt += """
          **Task 3: Extract Graph Data Points (PSE&G Specific)**
          - The bars represent **AVERAGE DAILY USAGE (kWh)**.
          - For each bar, estimate the daily usage value based on the Y-axis.
            """

        # Generate response
        print("Calling Gemini API...")
        response = model.generate_content(
            [
                {"mime_type": "image/jpeg", "data": content},
                prompt
            ],
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": {
                    "type": "object",
                    "properties": {
                        "customerName": {"type": "string"},
                        "fullAddress": {"type": "string"},
                        "billCost": {"type": "number"},
                        "billUsage": {"type": "number"},
                        "data": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "month": {"type": "string"},
                                    "usage": {"type": "number"}
                                },
                                "required": ["month", "usage"]
                            }
                        },
                        "metadata": {
                            "type": "object",
                            "properties": {
                                "yAxisMin": {"type": "number"},
                                "yAxisMax": {"type": "number"},
                                "yAxisLabels": {
                                    "type": "array",
                                    "items": {"type": "number"}
                                }
                            },
                            "required": ["yAxisMin", "yAxisMax", "yAxisLabels"]
                        }
                    },
                    "required": ["data", "metadata"]
                }
            }
        )
        
        print("Received response from Gemini.")
        try:
            # Gemini may return data inside a markdown code block or just raw JSON
            text = response.text.strip()
            if text.startswith("```json"):
                text = text.split("```json")[1].split("```")[0].strip()
            elif text.startswith("```"):
                text = text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(text)
            
            # Additional safety check for the frontend
            if "data" not in data or not isinstance(data["data"], list):
                 raise ValueError("Missing or invalid 'data' array in AI response")
                 
            return data
        except Exception as e:
            print(f"JSON Parse/Validation Error: {str(e)}")
            return {"error": "Failed to parse AI response", "details": str(e), "raw": response.text}
            
    except Exception as e:
        print(f"General Error in analyze_bill: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": "Internal Server Error", "details": str(e)}

# Serves the frontend (must be last)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Check if static directory exists (it will be populated in the Docker image)
static_dir = "static"
if os.path.exists(static_dir):
    # Mount static files for assets (js, css, images, etc.)
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    
    # Catch-all route for SPA - serves index.html for any non-API route
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # If the path is a file that exists, serve it
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise, serve index.html for client-side routing
        return FileResponse(os.path.join(static_dir, "index.html"))