import os
import redis
from dotenv import load_dotenv

load_dotenv()

def get_redis_client():
    """Returns a connected Redis client"""
    return redis.Redis(
        host=os.getenv("REDIS_HOST") or "localhost", 
        port=int(os.getenv("REDIS_PORT", 6379)), 
        db=0,
        decode_responses=True
    )