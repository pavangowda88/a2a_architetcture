"""
UE Agent — User Equipment Agent representing 6G Digital Assistant / Mobile Robot.
Verifies UE from MongoDB and communicates with supervisor via A2A protocol.
"""

from fastapi import FastAPI, APIRouter, Request
from shared.models import AgentCard, AgentSkill, UEAgentProfile
from shared.a2a_client import A2AClient
from shared.config import settings

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os


load_dotenv()


# ============================
# MongoDB Connection
# ============================

mongo_client = AsyncIOMotorClient(
    os.getenv("MONGO_URI")
)

db = mongo_client["6g_agentic_ai"]

ue_collection = db["ue_profiles"]


# ============================
# A2A Client
# ============================

a2a_client = A2AClient(
    agent_id="ue_agent",
    agent_secret=settings.AGENT_SECRET
)


router = APIRouter()


current_session = None


# ============================
# UE Profile
# ============================

ue_profile = UEAgentProfile()


# ============================
# Agent Card
# ============================

UE_CARD = AgentCard(
    name="UE Agent",
    description="User Equipment Agent (Mobile Robot / Digital Assistant)",

    url=f"{settings.BASE_URI}:8004",

    skills=[

        AgentSkill(
            id="attach",
            name="Attach",
            description="6G Network attach & Agent-AKA authentication",
            endpoint="/attach",
        ),

        AgentSkill(
            id="service-request",
            name="Service Request",
            description="Issue service request under active session",
            endpoint="/service-request",
        ),

        AgentSkill(
            id="ue-profile-local",
            name="Local Profile",
            description="Get local UE Agent Card Profile",
            endpoint="/profile",
        ),
    ],

    profile=ue_profile.model_dump(by_alias=True),
)



# =====================================================
# ATTACH PROCEDURE
# =====================================================

@router.post("/attach")
async def attach(request: Request):

    global current_session


    try:
        body = await request.json()

    except Exception:
        body = {}


    params = body.get("params", body)


    sub_imsi = params.get("imsi")
    sub_imei = params.get("imei")



    response = await a2a_client.send_by_skill(

        "orchestrate",

        "authenticate_subscriber",

        {

            "imsi": sub_imsi,

            "imei": sub_imei,

            "agent_profile":
                ue_profile.model_dump(by_alias=True)

        }

    )



    result = response.get("result", {})



    if result.get("status") == "completed":


        inner = result.get("result", {})


        current_session = inner.get(
            "session_token"
        )


        ue_profile.sessionProfile.agentSessionId = (
            current_session or "AS123"
        )


        ue_profile.trustProfile.trustScore = (
            inner.get("trustScore",91)
        )


        ue_profile.trustProfile.riskLevel = (
            inner.get("riskLevel","LOW")
        )



    return {

        "jsonrpc":"2.0",

        "result":result,

        "id":body.get("id",1)

    }





# =====================================================
# SERVICE REQUEST
# =====================================================

@router.post("/service-request")
async def request_service(request: Request):

    global current_session


    try:
        body = await request.json()

    except Exception:
        body = {}



    params = body.get("params",body)



    service_type = params.get(
        "service_type",
        "video_call"
    )


    sub_imsi = params.get("imsi")

    sub_imei = params.get("imei")



    # ======================================
    # UE DATABASE VERIFICATION
    # ======================================


    ue = await ue_collection.find_one(

        {
            "supi": sub_imsi,

            "pei": sub_imei

        }

    )



    if ue is None:


        return {

            "jsonrpc":"2.0",

            "error":{

                "code":404,

                "message":
                "UE is not registered"

            },

            "id":body.get("id")

        }



    # ======================================
    # UE FOUND
    # Continue Network Procedure
    # ======================================


    if not current_session:


        await attach(request)



    response = await a2a_client.send_by_skill(

        "orchestrate",

        "service_request",

        {

            "imsi":sub_imsi,

            "session_token":
                current_session,

            "service_type":
                service_type

        }

    )



    return {


        "jsonrpc":"2.0",

        "result":
            response.get("result",response),

        "id":
            body.get("id",2)

    }





# =====================================================
# PROFILE
# =====================================================

@router.get("/profile")
@router.post("/profile")
async def get_profile():

    return {

        "jsonrpc":"2.0",

        "result":
            ue_profile.model_dump(by_alias=True),

        "id":
            "profile_request"

    }





# =====================================================
# FASTAPI APP
# =====================================================

app = FastAPI(

    title="UE Agent",

    version="2.1.0"

)



@app.on_event("startup")
async def startup_event():

    await a2a_client.register_with_retry(

        UE_CARD.model_dump()

    )



app.include_router(router)



@app.get("/.well-known/agent.json")
async def agent_card():

    return UE_CARD.model_dump()