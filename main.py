import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import base64
import requests
from PIL import Image
import io

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI API Key
OPENAI_API_KEY = os.environ.get("...")

# Create an "uploads" directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def process_image(file: UploadFile) -> str:
    try:
        # Read the file content
        content = file.file.read()

        # Open the image using PIL
        image = Image.open(io.BytesIO(content))

        # Convert to RGB if the image is in RGBA mode (e.g., PNG with transparency)
        if image.mode == 'RGBA':
            image = image.convert('RGB')

        # Create a byte stream to hold the JPEG data
        byte_arr = io.BytesIO()

        # Save the image as JPEG to the byte stream
        image.save(byte_arr, format='JPEG')

        # Get the byte string and encode it to base64
        base64_image = base64.b64encode(byte_arr.getvalue()).decode('utf-8')

        return base64_image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

@app.post("/analyze-image/")
async def analyze_image(file: UploadFile = File(...), question: str = Form(...)):
    # Process the image
    base64_image = process_image(file)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }

    payload = {
        "model": "gpt-4o",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": question},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }
        ],
        "max_tokens": 300
    }

    try:
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        answer = result['choices'][0]['message']['content']
        return JSONResponse(content={"answer": answer})
    except requests.exceptions.HTTPError as http_err:
        error_detail = response.json().get('error', {}).get('message', str(http_err))
        raise HTTPException(status_code=response.status_code, detail=f"OpenAI API Error: {error_detail}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
