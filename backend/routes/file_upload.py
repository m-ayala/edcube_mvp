from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
import os
import tempfile

router = APIRouter()

@router.post("/upload-course-file")
async def upload_course_file(
    file: UploadFile = File(...),
    teacherUid: str = Query(...)
):
    """
    Accept a file upload (Excel/Word), parse it with GPT-4, 
    return structured course data
    """
    
    # Validate file type
    allowed_extensions = ['.xlsx', '.xls', '.docx', '.doc']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        # Parse the file with GPT-4
        from services.file_parser import parse_course_file
        
        course_data = await parse_course_file(tmp_file_path, file_ext, teacherUid)
        
        return JSONResponse(content={
            "success": True,
            "course_data": course_data
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File parsing failed: {str(e)}")
    
    finally:
        # Clean up temp file
        if os.path.exists(tmp_file_path):
            os.remove(tmp_file_path)