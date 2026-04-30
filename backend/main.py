# backend/main.py
import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

import uvicorn
from routes.file_upload import router as file_upload_router
import os
from routes import curriculum, resources, topics, teachers, contact, notifications

app = FastAPI(title="EdCube API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://edcube-8fe7d.web.app",
    "https://edcube-8fe7d.firebaseapp.com",
    "https://edcubeai.web.app",
    "https://edcubeai.firebaseapp.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(curriculum.router, prefix="/api", tags=["curriculum"])
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(topics.router, prefix="/api", tags=["topics"])
app.include_router(file_upload_router, prefix="/api", tags=["file_upload"])
app.include_router(teachers.router, tags=["teachers"])
app.include_router(contact.router, prefix="/api", tags=["contact"])
app.include_router(notifications.router, tags=["notifications"])

@app.get("/")
async def root():
    return {"message": "EdCube API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)