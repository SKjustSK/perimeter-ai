import os
import psycopg2
from dotenv import load_dotenv

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
    except Exception as e:
        print(f"[-] Database connectivity error for job {job_id}: {e}")
        # Invalidate the connection so it can be re-established on next try
        global _connection
        if _connection is not None:
            try:
                _connection.close()
            except:
                pass
            _connection = None