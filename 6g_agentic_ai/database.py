import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from shared.config import settings

client = None
db = None


# simple model classes (just hold data)

class AgentCredential:
    def __init__(self, agent_id, hashed_secret, role="agent"):
        self.agent_id = agent_id
        self.hashed_secret = hashed_secret
        self.role = role

    def to_dict(self):
        return {
            "agent_id": self.agent_id,
            "hashed_secret": self.hashed_secret,
            "role": self.role,
        }


class SubscriberProfile:
    def __init__(self, imsi, name, auth_key, opc, imei=None, msisdn=None,
                 subscription_type="5G_BASIC", qos_class="QCI_9",
                 service_plan="prepaid", status="active",
                 preferences=None, usage_history=None):
        self.imsi = imsi
        self.imei = imei
        self.msisdn = msisdn
        self.name = name
        self.auth_key = auth_key
        self.opc = opc
        self.subscription_type = subscription_type
        self.qos_class = qos_class
        self.service_plan = service_plan
        self.status = status
        self.created_at = datetime.datetime.utcnow().isoformat()
        self.preferences = preferences or {}
        self.usage_history = usage_history or []

    def to_dict(self):
        return {
            "imsi": self.imsi,
            "imei": self.imei,
            "msisdn": self.msisdn,
            "name": self.name,
            "auth_key": self.auth_key,
            "opc": self.opc,
            "subscription_type": self.subscription_type,
            "qos_class": self.qos_class,
            "service_plan": self.service_plan,
            "status": self.status,
            "created_at": self.created_at,
            "preferences": self.preferences,
            "usage_history": self.usage_history,
        }


class ActiveSession:
    def __init__(self, imsi, session_token, service="general", status="active"):
        self.imsi = imsi
        self.session_token = session_token
        self.service = service
        self.status = status
        self.updated_at = datetime.datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "imsi": self.imsi,
            "session_token": self.session_token,
            "service": self.service,
            "status": self.status,
            "updated_at": self.updated_at,
        }


class SecurityLog:
    def __init__(self, imsi, event_type, details=None):
        self.imsi = imsi
        self.event_type = event_type
        self.details = details or {}
        self.timestamp = datetime.datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "imsi": self.imsi,
            "event_type": self.event_type,
            "details": self.details,
            "timestamp": self.timestamp,
        }


class AgentRegistry:
    def __init__(self, agent_id, card):
        self.agent_id = agent_id
        self.card = card

    def to_dict(self):
        return {
            "agent_id": self.agent_id,
            "card": self.card,
        }


class UEAgentRecord:
    def __init__(self, agent_id, supi, gpsi, pei, agent_type, profile_data):
        self.agent_id = agent_id
        self.supi = supi
        self.gpsi = gpsi
        self.pei = pei
        self.agent_type = agent_type
        self.profile_data = profile_data

    def to_dict(self):
        return {
            "agent_id": self.agent_id,
            "supi": self.supi,
            "gpsi": self.gpsi,
            "pei": self.pei,
            "agent_type": self.agent_type,
            "profile_data": self.profile_data,
        }


class AFAgentRecord:
    def __init__(self, af_agent_id, af_id, enterprise_id, service, profile_data):
        self.af_agent_id = af_agent_id
        self.af_id = af_id
        self.enterprise_id = enterprise_id
        self.service = service
        self.profile_data = profile_data

    def to_dict(self):
        return {
            "af_agent_id": self.af_agent_id,
            "af_id": self.af_id,
            "enterprise_id": self.enterprise_id,
            "service": self.service,
            "profile_data": self.profile_data,
        }


class InMemoryCursor:
    def __init__(self, documents, query=None):
        self.documents = documents
        self.query = query or {}

    async def to_list(self, length=100):
        res = []
        for doc in self.documents:
            match = True
            for k, v in self.query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                res.append(dict(doc))
        return res[:length]


class InMemoryCollection:
    def __init__(self, name):
        self.name = name
        self.documents = []

    async def find_one(self, query=None):
        query = query or {}
        for doc in self.documents:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    async def insert_one(self, doc):
        d = dict(doc)
        self.documents.append(d)
        return d

    async def insert_many(self, docs):
        res = []
        for doc in docs:
            d = dict(doc)
            self.documents.append(d)
            res.append(d)
        return res

    async def update_one(self, query, update):
        target = await self.find_one(query)
        if target:
            set_vals = update.get("$set", {})
            for k, v in set_vals.items():
                target[k] = v
        return target

    async def delete_many(self, query=None):
        if not query:
            self.documents.clear()
        else:
            self.documents = [d for d in self.documents if not any(d.get(k) == v for k, v in query.items())]
        return True

    async def count_documents(self, query=None):
        if not query:
            return len(self.documents)
        count = 0
        for doc in self.documents:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    def find(self, query=None):
        return InMemoryCursor(self.documents, query)


class InMemoryDatabase:
    def __init__(self):
        self.auth_keys = InMemoryCollection("auth_keys")
        self.subscribers = InMemoryCollection("subscribers")
        self.sessions = InMemoryCollection("sessions")
        self.security_logs = InMemoryCollection("security_logs")
        self.agent_registry = InMemoryCollection("agent_registry")
        self.ue_profiles = InMemoryCollection("ue_profiles")
        self.af_profiles = InMemoryCollection("af_profiles")
        self.agent_messages = InMemoryCollection("agent_messages")


async def init_db():
    global client, db
    try:
        client = AsyncIOMotorClient(settings.MONGO_URI, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=2500)
        await client.admin.command('ping')
        db = client[settings.DATABASE_NAME]
        print("Connected to MongoDB Atlas database.")
    except Exception as e:
        print(f"MongoDB connection offline ({e}). Using in-memory fallback store.")
        if db is None or not isinstance(db, InMemoryDatabase):
            db = InMemoryDatabase()



