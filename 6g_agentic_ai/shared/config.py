import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    MONGO_URI = os.getenv("MONGO_URI")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "sixg_agentic")
    JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "30"))

    # single base uri — ports are appended where needed
    BASE_URI = os.getenv("BASE_URI", "http://localhost").rstrip("/")
    AGENT_SECRET = os.getenv("AGENT_SECRET", "").strip()

    def __init__(self):
        if not self.MONGO_URI:
            raise ValueError("MONGO_URI is missing. Set it in the .env file.")
        if not self.JWT_SECRET:
            raise ValueError("JWT_SECRET is missing. Set it in the .env file.")
        if not self.AGENT_SECRET:
            raise ValueError("AGENT_SECRET is missing. Set it in the .env file.")
        if self.JWT_SECRET != self.JWT_SECRET.strip() or self.AGENT_SECRET != self.AGENT_SECRET.strip():
            raise ValueError("JWT_SECRET and AGENT_SECRET must not have leading or trailing whitespace.")
        if len(self.JWT_SECRET.encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET must be at least 32 bytes.")
        if len(self.AGENT_SECRET.encode("utf-8")) < 32:
            raise ValueError("AGENT_SECRET must be at least 32 bytes.")

    @property
    def AUTH_URL(self):
        return f"{self.BASE_URI}:9000"

    @property
    def REGISTRY_URL(self):
        return f"{self.BASE_URI}:9001"

    @property
    def NOTIFICATION_URL(self):
        return f"{self.BASE_URI}:8006"


settings = Settings()
