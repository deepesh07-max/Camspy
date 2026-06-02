import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Path to persistent database within the workspace
DB_PATH = "sensor_log.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create SQLite engine
# 'check_same_thread' is set to False to permit FastAPI's async loops to read/write concurrently
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Set up local session maker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative database models
Base = declarative_base()

def get_db():
    """
    Dependency helper that yields a clean database session context,
    guaranteeing automatic connection closure after requests terminate.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
