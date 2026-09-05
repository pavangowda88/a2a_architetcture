"""
Seed script — loads initial credentials, UE Agent Profile, AF Agent Profile, and test subscribers.
"""

import asyncio
import argparse
from shared.config import settings
from shared.models import UEAgentProfile, AFAgentProfile
import database
from database import init_db, SubscriberProfile, UEAgentRecord, AFAgentRecord


async def seed(reset: bool = False):
    print("Connecting to database...")
    await init_db()

    if not reset:
        print("OAuth client credentials are managed by the authorization server.")
        print("Use --reset only to recreate sample application data.")
        return

    print("Clearing old data (--reset)...")
    await database.db.subscribers.delete_many({})
    await database.db.sessions.delete_many({})
    await database.db.security_logs.delete_many({})
    await database.db.agent_registry.delete_many({})
    await database.db.ue_profiles.delete_many({})
    await database.db.af_profiles.delete_many({})
    await database.db.agent_messages.delete_many({})

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
    args = parser.parse_args()
    asyncio.run(seed(reset=args.reset))

