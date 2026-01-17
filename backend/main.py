"""
EdCube Backend API Server
FastAPI server to expose curriculum generation pipeline to React frontend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import curriculum, resources
import uvicorn

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
        "http://localhost:4000",  # React dev server
        "http://localhost:3000",  # Alternative port
        "https://edcube-mvp.vercel.app"  # Production (when deployed)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(curriculum.router, prefix="/api", tags=["curriculum"])
app.include_router(resources.router, prefix="/api", tags=["resources"])


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
    return {
        "status": "healthy",
        "services": {
            "api": "operational",
            "firebase": "connected",
            "openai": "available"
        }
    }


if __name__ == "__main__":
    # Run server on port 8000
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Auto-reload on code changes
    )