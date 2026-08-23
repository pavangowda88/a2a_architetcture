"""
Seed script — loads initial credentials, UE Agent Profile, AF Agent Profile, and test subscribers.
"""

import asyncio
import argparse
from auth_service import hash_secret
from shared.config import settings
from shared.models import UEAgentProfile, AFAgentProfile
import database
from database import init_db, AgentCredential, SubscriberProfile, UEAgentRecord, AFAgentRecord


async def seed_agent_credentials(overwrite: bool = False) -> None:
    """Provision service identities; overwrite only during explicit rotation."""
    roles = {
        "supervisor_agent": "supervisor",
        "ausf_agent": "network_function",
        "udm_agent": "network_function",
        "subscriber_agent": "network_function",
        "security_agent": "network_function",
        "ue_agent": "user_equipment",
        "ue_agent_001": "user_equipment",
        "ue_agent_002": "user_equipment",
        "ue_agent_003": "user_equipment",
        "notification_agent": "infrastructure",
        "mcp_gateway_agent": "gateway",
    }
    for agent_id, role in roles.items():
        existing = await database.db.auth_keys.find_one({"agent_id": agent_id})
        if existing is None:
            await database.db.auth_keys.insert_one(
                AgentCredential(agent_id, hash_secret(settings.AGENT_SECRET), role).to_dict()
            )
        elif overwrite:
            await database.db.auth_keys.update_one(
                {"agent_id": agent_id},
                {"$set": {"hashed_secret": hash_secret(settings.AGENT_SECRET), "role": role}},
            )


async def seed(reset: bool = False, rotate_agent_credentials: bool = False):
    print("Connecting to database...")
    await init_db()

    if not reset:
        if rotate_agent_credentials:
            print("Rotating known agent credentials (subscriber and session data are preserved)...")
        else:
            print("Safely adding missing agent credentials (existing credentials are preserved)...")
        await seed_agent_credentials(overwrite=rotate_agent_credentials)
        print("Credential seeding done. Use --reset only to recreate all sample data.")
        return

    print("Clearing old data (--reset)...")
    await database.db.auth_keys.delete_many({})
    await database.db.subscribers.delete_many({})
    await database.db.sessions.delete_many({})
    await database.db.security_logs.delete_many({})
    await database.db.agent_registry.delete_many({})
    await database.db.ue_profiles.delete_many({})
    await database.db.af_profiles.delete_many({})
    await database.db.agent_messages.delete_many({})

    print("Seeding auth credentials...")
    await seed_agent_credentials()

    print("Seeding subscribers...")
    sub1 = SubscriberProfile(
        imsi="001010000000001",
        imei="356938035643809",
        name="Alice 6G Test",
        auth_key="465B5CE8B199B49FAA5F0A2EE238A6BC",
        opc="E8ED289DEBA952E4283B54E88E6183CA",
        subscription_type="6G_EXPERIMENTAL",
        qos_class="QCI_1",
    )
    sub2 = SubscriberProfile(
        imsi="001010123456789",
        imei="imei-123456789",
        name="6G Mobile Robot UE-001",
        auth_key="465B5CE8B199B49FAA5F0A2EE238A6BC",
        opc="E8ED289DEBA952E4283B54E88E6183CA",
        subscription_type="6G_ROBOTICS_SLICE",
        qos_class="QCI_1_URLLC",
    )
    await database.db.subscribers.insert_many([sub1.to_dict(), sub2.to_dict()])

    print("Seeding UE Agent profile...")
    ue_p = UEAgentProfile()
    ue_record = UEAgentRecord(
        agent_id=ue_p.agentIdentity.agentId,
        supi=ue_p.supi,
        gpsi=ue_p.gpsi,
        pei=ue_p.pei,
        agent_type=ue_p.type,
        profile_data=ue_p.model_dump(by_alias=True)
    )
    await database.db.ue_profiles.insert_one(ue_record.to_dict())

    print("Seeding UDR AF Agent profile...")
    af_p = AFAgentProfile()
    af_record = AFAgentRecord(
        af_agent_id=af_p.afAgentIdentity.afAgentId,
        af_id=af_p.afId,
        enterprise_id=af_p.enterpriseId,
        service=af_p.serviceContext,
        profile_data=af_p.model_dump(by_alias=True)
    )
    await database.db.af_profiles.insert_one(af_record.to_dict())

    print("Seeding Done!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed 6G agent credentials and sample data")
    parser.add_argument("--reset", action="store_true", help="delete and recreate all sample data")
    parser.add_argument("--rotate-agent-credentials", action="store_true", help="replace known agent credential hashes without deleting other data")
    args = parser.parse_args()
    asyncio.run(seed(reset=args.reset, rotate_agent_credentials=args.rotate_agent_credentials))

