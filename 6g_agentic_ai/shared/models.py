from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any


class AgentSkill(BaseModel):
    id: str
    name: str
    description: str
    endpoint: str = "/"   # path on the agent, e.g. /authenticate


class AgentCapabilities(BaseModel):
    streaming: bool = False
    pushNotifications: bool = False


class SecurityScheme(BaseModel):
    type: str = "http"
    scheme: str = "bearer"
    bearerFormat: str = "OAuth2"


class AgentProvider(BaseModel):
    organization: str = "Nokia 6G Agentic AI"
    url: str = ""


class AgentAuthenticationProfile(BaseModel):
    authenticationMethod: str = "OAuth2 Client Credentials"
    authenticationStatus: str = "ACTIVE"
    credentialExpiry: str = "2027-01-01"


class AgentAuthorizationProfile(BaseModel):
    permissions: List[str] = Field(
        default_factory=lambda: [
            "ReadSubscriberProfile",
            "PredictRoaming",
            "QueryNWDAF"
        ]
    )


class PrivacyConsentProfile(BaseModel):
    allowLocationAccess: bool = True
    allowBehaviourAnalytics: bool = True
    allowHealthData: bool = False


class CapabilityProfile(BaseModel):
    llm: str = "local"
    vision: bool = True
    ArmDoF: int = 6
    pickAndPlace: bool = Field(default=True, alias="pick&Place")

    class Config:
        populate_by_name = True


class TrustProfile(BaseModel):
    trustScore: float = 91.0
    riskLevel: str = "LOW"


class SessionProfile(BaseModel):
    agentSessionId: str = "AS123"
    status: str = "ACTIVE"
    sessionStartTime: str = "2026-07-28T10:00:00Z"
    sessionExpiry: str = "2026-07-29T10:00:00Z"
    activeAFConnections: List[str] = Field(default_factory=lambda: ["AF-Agent-1001"])
    lastActivity: str = "2026-07-28T21:00:00Z"
    tokenExpiry: str = "2026-07-29T10:00:00Z"


class SubscriptionProfile(BaseModel):
    subscriptions: List[str] = Field(
        default_factory=lambda: [
            "AuthorizationChange",
            "TrustScoreChange",
            "RoamingChange"
        ]
    )


class UEAgentIdentity(BaseModel):
    agentId: str = "UE-Agent-001"
    agentType: str = "digitalAssistant"
    agentVersion: str = "v2.1"
    agentVendor: str = "Airtel"
    agentOwnerSUPI: str = "001010123456789"
    gpsi: str = "+919876543210"
    pei: str = "imei-123456789"


class UEAgentProfile(BaseModel):
    agentIdentity: UEAgentIdentity = Field(default_factory=UEAgentIdentity)
    supi: str = "001010123456789"
    gpsi: str = "+919876543210"
    pei: str = "imei-123456789"
    type: str = "mobile Robot"
    authenticationProfile: AgentAuthenticationProfile = Field(default_factory=AgentAuthenticationProfile)
    authorizationProfile: AgentAuthorizationProfile = Field(default_factory=AgentAuthorizationProfile)
    privacyProfile: PrivacyConsentProfile = Field(default_factory=PrivacyConsentProfile)
    capabilityProfile: CapabilityProfile = Field(default_factory=CapabilityProfile)
    trustProfile: TrustProfile = Field(default_factory=TrustProfile)
    sessionProfile: SessionProfile = Field(default_factory=SessionProfile)
    subscriptionProfile: SubscriptionProfile = Field(default_factory=SubscriptionProfile)


class AFAgentIdentity(BaseModel):
    afAgentId: str = "AF-Agent-1001"
    afId: str = "AF-Enterprise-001"
    service: str = "SmartFactory"


class AFAgentProfile(BaseModel):
    afAgentIdentity: AFAgentIdentity = Field(default_factory=AFAgentIdentity)
    afId: str = "AF-Enterprise-001"
    enterpriseId: str = "Enterprise-001"
    serviceContext: str = "SmartFactory"
    authProfile: Dict[str, str] = Field(
        default_factory=lambda: {
            "authenticationMethod": "OAuth2 Client Credentials",
            "authenticationStatus": "ACTIVE",
            "credentialExpiry": "2027-01-01"
        }
    )
    capabilityProfile: CapabilityProfile = Field(default_factory=CapabilityProfile)
    trustProfile: TrustProfile = Field(default_factory=TrustProfile)
    authorizationProfile: AgentAuthorizationProfile = Field(default_factory=AgentAuthorizationProfile)


class AgentCard(BaseModel):
    # Stable machine identifier used by the registry for direct A2A delivery.
    # `name` remains the human-readable A2A card name.
    id: Optional[str] = None
    name: str
    description: str
    version: str = "1.0.0"
    url: str
    capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities)
    skills: List[AgentSkill] = Field(default_factory=list)
    securitySchemes: Dict[str, SecurityScheme] = Field(
        default_factory=lambda: {"bearerAuth": SecurityScheme()}
    )
    security: List[Dict[str, list]] = Field(
        default_factory=lambda: [{"bearerAuth": []}]
    )
    provider: AgentProvider = Field(default_factory=AgentProvider)
    profile: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskRequest(BaseModel):
    sender: str
    receiver: str
    task: str
    payload: dict


class TaskResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None

