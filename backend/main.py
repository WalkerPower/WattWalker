from fastapi import FastAPI, File, UploadFile, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Any, Optional
from PIL import Image
import pillow_heif
import io
import os

from dotenv import load_dotenv

# Load repo-root .env for local `uvicorn` (Cloud Run uses injected env vars).
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_REPO_ROOT, ".env"))
load_dotenv(os.path.join(_REPO_ROOT, ".env.local"), override=True)

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

# Check if static directory exists (for production builds)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(STATIC_DIR):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

@app.post("/convert")
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


class GeminiGenerateRequest(BaseModel):
    model: str
    contents: dict[str, Any]
    config: Optional[dict[str, Any]] = None


def _gemini_api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY") or "").strip()


@app.post("/api/gemini/generate")
async def gemini_generate(req: GeminiGenerateRequest):
    api_key = _gemini_api_key()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server.",
        )

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        kwargs: dict[str, Any] = {"model": req.model, "contents": req.contents}
        if req.config is not None:
            kwargs["config"] = req.config
        response = client.models.generate_content(**kwargs)
        return {"text": response.text}
    except Exception as exc:
        message = str(exc)
        status = 502
        if "API key not valid" in message or "API_KEY_INVALID" in message:
            status = 400
        raise HTTPException(status_code=status, detail=message) from exc


# Serve the frontend for all other routes (SPA fallback)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Try to serve the exact file first
    file_path = os.path.join(STATIC_DIR, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Otherwise serve index.html (for SPA routing)
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return Response(content="Not Found", status_code=404)