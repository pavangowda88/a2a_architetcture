import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    MONGO_URI = os.getenv("MONGO_URI")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "sixg_agentic")
    BASE_URI = os.getenv("BASE_URI", "http://127.0.0.1").rstrip("/")
    OAUTH_ISSUER_URL = os.getenv("OAUTH_ISSUER_URL", "http://localhost:8080/realms/6g").rstrip("/")
    OAUTH_TOKEN_URL = os.getenv(
        "OAUTH_TOKEN_URL",
        f"{OAUTH_ISSUER_URL}/protocol/openid-connect/token",
    )
    OAUTH_INTROSPECTION_URL = os.getenv(
        "OAUTH_INTROSPECTION_URL",
        f"{OAUTH_ISSUER_URL}/protocol/openid-connect/token/introspect",
    )
    OAUTH_AUDIENCE = os.getenv("OAUTH_AUDIENCE", "6g-agent-services")
    OAUTH_SCOPES = os.getenv("OAUTH_SCOPES", "agent:read agent:write")
    RESOURCE_CLIENT_ID = os.getenv("RESOURCE_CLIENT_ID", "6g-resource-server")
    RESOURCE_CLIENT_SECRET = os.getenv("RESOURCE_CLIENT_SECRET", "")

    def __init__(self):
        if not self.MONGO_URI:
            raise ValueError("MONGO_URI is missing. Set it in the .env file.")

    def client_credentials(self, client_id: str) -> tuple[str, str]:
        env_name = client_id.upper().replace("-", "_") + "_CLIENT_SECRET"
        secret = os.getenv(env_name, "")
        return client_id, secret

    @property
    def REGISTRY_URL(self):
        return f"{self.BASE_URI}:9001"

    @property
    def NOTIFICATION_URL(self):
        return f"{self.BASE_URI}:{os.getenv('NOTIFICATION_PORT', '8106')}"


settings = Settings()
