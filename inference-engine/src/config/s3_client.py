import os
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
        aws_access_key_id=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        aws_secret_access_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        config=Config(signature_version='s3v4'),
        region_name=os.getenv("MINIO_REGION", "us-east-1")
    )

def init_s3_bucket():
    """Ensures the required MinIO bucket exists before processing begins."""
    s3 = get_s3_client()
    bucket_name = os.getenv("STORAGE_BUCKET", "surveillance-videos")
    
    try:
        # Check if bucket exists
        s3.head_bucket(Bucket=bucket_name)
        print(f"[+] MinIO bucket '{bucket_name}' is ready.")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            # Create bucket if not found
            print(f"[*] MinIO bucket '{bucket_name}' not found. Creating it now...")
            s3.create_bucket(Bucket=bucket_name)
        else:
            print(f"[-] Failed to verify MinIO bucket: {e}")