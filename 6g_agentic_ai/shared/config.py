import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    MONGO_URI = os.getenv("MONGO_URI")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "sixg_agentic")
    JWT_SECRET = os.getenv("JWT_SECRET", "Nokia6GSecretKey2026")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRY_MINUTES = int(os.getenv("JWT_EXPIRY_MINUTES", "30"))

    # single base uri — ports are appended where needed
    BASE_URI = os.getenv("BASE_URI", "http://localhost").rstrip("/")
    AGENT_SECRET = os.getenv("AGENT_SECRET", "secret123")

    def __init__(self):
        if not self.MONGO_URI:
            raise ValueError("MONGO_URI is missing. Set it in the .env file.")

    @property
    def AUTH_URL(self):
        return f"{self.BASE_URI}:9000"

    @property
    def REGISTRY_URL(self):
        return f"{self.BASE_URI}:9001"


settings = Settings()
