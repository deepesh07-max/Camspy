import csv
import io
import json
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import desc

import models
from database import engine, get_db

# Auto-create all required database tables on app launch
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CamSpy - Object Detection Sensor Hub",
    description="Web-based real-time object detection sensor and logging analytics",
    version="1.0.0"
)

# Mount static directory for stylesheets and browser scripts
app.mount("/static", StaticFiles(directory="static"), name="static")


# --- WEB ROUTE ---

@app.get("/", response_class=HTMLResponse)
async def read_dashboard():
    """
    Renders the beautiful sci-fi/cyberpunk CamSpy HUD dashboard.
    """
    try:
        with open("templates/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html template not found")


# --- API ENDPOINTS ---

@app.get("/api/events")
def get_events(limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieves the most recent detection events sorted by timestamp descending.
    """
    events = db.query(models.DetectionEvent).order_by(desc(models.DetectionEvent.timestamp)).limit(limit).all()
    return [event.to_dict() for event in events]


@app.post("/api/events")
async def create_event(request: Request, db: Session = Depends(get_db)):
    """
    Logs a newly detected sensor event to the SQLite database.
    """
    try:
        data = await request.json()
        label = data.get("label")
        confidence = data.get("confidence")
        bbox = data.get("bbox")  # Expecting list/dict, will convert to JSON string

        if not label or confidence is None:
            raise HTTPException(status_code=400, detail="Missing required fields: label and confidence")

        # Convert bbox back to string for storage if it is a list or dictionary
        bbox_str = json.dumps(bbox) if bbox is not None else None

        # Build database event model
        new_event = models.DetectionEvent(
            label=label.lower(),
            confidence=float(confidence),
            timestamp=datetime.utcnow(),
            bbox=bbox_str
        )

        db.add(new_event)
        db.commit()
        db.refresh(new_event)

        return JSONResponse(
            status_code=201,
            content={"status": "success", "event": new_event.to_dict()}
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database logging failure: {str(e)}")


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """
    Deletes an individual event log entry by its primary key.
    """
    event = db.query(models.DetectionEvent).filter(models.DetectionEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=444, detail="Event log not found")
    
    db.delete(event)
    db.commit()
    return {"status": "success", "message": f"Event {event_id} deleted."}


@app.delete("/api/events")
def clear_all_events(db: Session = Depends(get_db)):
    """
    Clears the entire database event log.
    """
    try:
        db.query(models.DetectionEvent).delete()
        db.commit()
        return {"status": "success", "message": "All sensor event logs cleared."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database clear failure: {str(e)}")


@app.get("/api/export")
def export_events_csv(db: Session = Depends(get_db)):
    """
    Generates and returns a downloadable CSV file containing all sensor logs.
    """
    events = db.query(models.DetectionEvent).order_by(desc(models.DetectionEvent.timestamp)).all()
    
    # Create in-memory string buffer
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write CSV Header
    writer.writerow(["Event ID", "Object Label", "Confidence Score", "Timestamp (UTC)", "Bounding Box (JSON)"])
    
    # Write rows
    for event in events:
        writer.writerow([
            event.id,
            event.label,
            event.confidence,
            event.timestamp.strftime("%Y-%m-%d %H:%M:%S") if event.timestamp else "",
            event.bbox or ""
        ])
    
    # Reset stream pointer
    output.seek(0)
    
    # Create stream response as downloadable CSV
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=camspy_sensor_logs.csv"}
    )


if __name__ == "__main__":
    import uvicorn
    # Launch application using live-reloading dev server
    print("Launching CamSpy Sensor Hub on http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
