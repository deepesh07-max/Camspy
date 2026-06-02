from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from database import Base

class DetectionEvent(Base):
    """
    SQLAlchemy model representing a captured object sensor event.
    """
    __tablename__ = "detection_events"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, index=True, nullable=False)
    confidence = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    bbox = Column(String, nullable=True)  # JSON-encoded list: "[x, y, width, height]"

    def to_dict(self):
        """
        Converts the database object into a serializable dictionary format.
        """
        return {
            "id": self.id,
            "label": self.label,
            "confidence": round(self.confidence, 4),
            "timestamp": self.timestamp.isoformat() + "Z" if self.timestamp else None,
            "bbox": self.bbox
        }
