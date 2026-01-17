"""
EdCube Backend API Server
FastAPI server to expose curriculum generation pipeline to React frontend
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routes import curriculum, resources, topics  # ADD topics here
from config import LoggingConfig

# Configure logging
logging.basicConfig(
    level=getattr(logging, LoggingConfig.LOG_LEVEL),
    format=LoggingConfig.LOG_FORMAT,
    datefmt=LoggingConfig.LOG_DATE_FORMAT
)

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="EdCube API",
    description="AI-powered curriculum generation for teachers",
    version="1.0.0"
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4000",
        "http://localhost:3000",
        "https://edcube-mvp.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(curriculum.router, prefix="/api", tags=["curriculum"])
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(topics.router, prefix="/api", tags=["topics"])  # ADD THIS LINE


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "message": "EdCube API is running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    logger.info("Health check requested")
    return {
        "status": "healthy",
        "services": {
            "api": "operational",
            "firebase": "connected",
            "openai": "available"
        }
    }


if __name__ == "__main__":
    logger.info("Starting EdCube API server...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )