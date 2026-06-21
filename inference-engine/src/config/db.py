import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from src.config.redis_client import get_redis_client

load_dotenv()

_connection = None

def get_db_connection():
    global _connection
    if _connection is None or _connection.closed != 0:
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            # Strip Prisma-specific query parameters like ?schema=public
            if "?" in db_url:
                base_url, query = db_url.split("?", 1)
                params = [p for p in query.split("&") if not p.startswith("schema=")]
                if params:
                    db_url = base_url + "?" + "&".join(params)
                else:
                    db_url = base_url
            _connection = psycopg2.connect(db_url)
        else:
            _connection = psycopg2.connect(
                host=os.getenv("DB_HOST"),
                port=os.getenv("DB_PORT"),
                database=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD")
            )
    return _connection

def update_job_status(job_id, status, error_log=None):
    """Directly interacts with PostgreSQL to change job states"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        if error_log:
            cur.execute(
                'UPDATE "Job" SET status = %s, "errorLog" = %s, "updatedAt" = NOW() WHERE id = %s',
                (status, error_log, job_id)
            )
        else:
            cur.execute(
                'UPDATE "Job" SET status = %s, "updatedAt" = NOW() WHERE id = %s',
                (status, job_id)
            )
            
        conn.commit()
        cur.close()
        print(f"[DB] Job {job_id} -> {status}")

        # Publish status change so the Core API can fan it out via SSE.
        # A fresh client is used here to avoid interfering with the blocking
        # blpop client held by the worker loop.
        try:
            publisher = get_redis_client()
            publisher.publish(
                'job:updates',
                json.dumps({'job_id': job_id, 'status': status})
            )
        except Exception as pub_err:
            # Non-fatal — DB is already updated; SSE just won't fire for this event.
            print(f"[-] Redis publish failed for job {job_id}: {pub_err}")
    except Exception as e:
        print(f"[-] Database connectivity error for job {job_id}: {e}")
        # Invalidate the connection so it can be re-established on next try
        if _connection is not None:
            try:
                _connection.close()
            except:
                pass
            _connection = None

def insert_detections(records):
    """
    Bulk insert detection metadata into the Detection table.
    Expects a list of tuples: (id, jobId, cameraId, frameNumber, timestampSeconds, detectedAt, bbox, cropS3Key)
    """
    if not records:
        return

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        insert_query = '''
            INSERT INTO "Detection" (id, "jobId", "cameraId", "frameNumber", "timestampSeconds", "detectedAt", bbox, "cropS3Key")
            VALUES %s
        '''
        
        # Fast bulk insert
        psycopg2.extras.execute_values(cur, insert_query, records, page_size=100)
        conn.commit()
        cur.close()
        print(f"[DB] Bulk inserted {len(records)} detection metadata records.")
    except Exception as e:
        print(f"[-] Database connectivity error during batch insert: {e}")
        global _connection
        if _connection is not None:
            try:
                _connection.close()
            except:
                pass
            _connection = None