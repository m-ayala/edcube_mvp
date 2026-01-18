"""
backend/main.py - PHASE 1 ONLY VERSION

This version only includes the curriculum route for box generation.
Other routes (topics, resources) are commented out.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import only curriculum route for Phase 1
from routes import curriculum
# from routes import topics, resources  # COMMENTED OUT FOR PHASE 1 TESTING

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="EdCube API - Phase 1 Only",
    description="Curriculum box generation (Phase 1 testing)",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include ONLY curriculum router for Phase 1
app.include_router(curriculum.router, prefix="/api", tags=["curriculum"])

# Topics and Resources routes are commented out for Phase 1 testing
# app.include_router(topics.router, prefix="/api", tags=["topics"])
# app.include_router(resources.router, prefix="/api", tags=["resources"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "EdCube API - Phase 1 Only",
        "status": "running",
        "phase": "1 - Box Generation Only"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "phase": "1"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting EdCube API server (Phase 1 Only)...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )