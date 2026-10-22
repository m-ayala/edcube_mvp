# backend/main.py
import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

import uvicorn
from routes.file_upload import router as file_upload_router
from routes.uploads import router as uploads_router
import os
from routes import curriculum, resources, topics, teachers, contact, notifications, synopsis, afterschool_synopsis, orgs, knowledge_base, course_builder, account, admin, waitlist, sharing
from services.usage_service import QuotaExceeded

app = FastAPI(title="EdCube API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://edcube.org",
    "https://www.edcube.org",
    "https://edcube1.web.app",
    "https://edcube1.firebaseapp.com",
    "https://edcubeai-fdba7-6c559.web.app",
    "https://edcubeai-fdba7-6c559.firebaseapp.com",
    "https://edcubeai-fdba7.web.app",
    "https://edcubeai-fdba7.firebaseapp.com",
    "https://edcubeai.web.app",
    "https://edcubeai.firebaseapp.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    # X-EdCube-Workspace: the client's chosen workspace (personal|<orgId>), TASK-031
    allow_headers=["*", "X-EdCube-Workspace"],
)

# Include routers
app.include_router(curriculum.router, prefix="/api", tags=["curriculum"])
app.include_router(resources.router, prefix="/api", tags=["resources"])
app.include_router(topics.router, prefix="/api", tags=["topics"])
app.include_router(file_upload_router, prefix="/api", tags=["file_upload"])
app.include_router(teachers.router, tags=["teachers"])
app.include_router(contact.router, prefix="/api", tags=["contact"])
app.include_router(notifications.router, tags=["notifications"])
app.include_router(uploads_router, tags=["uploads"])
app.include_router(synopsis.router, tags=["synopsis"])
app.include_router(afterschool_synopsis.router, tags=["afterschool_synopsis"])
app.include_router(orgs.router, tags=["orgs"])
app.include_router(knowledge_base.router, tags=["knowledge_base"])
app.include_router(course_builder.router, prefix="/api", tags=["course-builder"])
app.include_router(account.router, tags=["account"])
app.include_router(admin.router, tags=["admin"])
app.include_router(waitlist.router, tags=["waitlist"])
app.include_router(sharing.router, tags=["sharing"])

ALLOWED_ORIGINS = {
    "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
    "https://edcube.org", "https://www.edcube.org",
    "https://edcube1.web.app", "https://edcube1.firebaseapp.com",
    "https://edcubeai-fdba7-6c559.web.app", "https://edcubeai-fdba7-6c559.firebaseapp.com",
    "https://edcubeai-fdba7.web.app", "https://edcubeai-fdba7.firebaseapp.com",
    "https://edcubeai.web.app", "https://edcubeai.firebaseapp.com",
}

@app.exception_handler(QuotaExceeded)
async def quota_exceeded_handler(request: Request, exc: QuotaExceeded):
    # 402 {"detail": {code, kind, limit, used, resets_at, plan}} (TASK-029)
    return JSONResponse(status_code=402, content={"detail": exc.to_detail()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.getLogger(__name__).error("Unhandled exception", exc_info=exc)
    # Explicitly add CORS headers so they are never stripped by error paths
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(status_code=500, content={"detail": "Internal server error"}, headers=headers)


@app.get("/")
async def root():
    return {"message": "EdCube API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)