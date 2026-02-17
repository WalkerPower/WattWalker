from fastapi import FastAPI, File, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pillow_heif
import io

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