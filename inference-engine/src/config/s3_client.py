import os
import json
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

def init_crops_bucket():
    """
    Ensures the crops bucket exists and is publicly readable.
    Public read is required so the React frontend can load crop thumbnail
    images directly from MinIO without signed URLs or auth headers.
    """
    s3 = get_s3_client()
    bucket_name = os.getenv("CROPS_BUCKET", "surveillance-crops")

    try:
        s3.head_bucket(Bucket=bucket_name)
        print(f"[+] MinIO crops bucket '{bucket_name}' is ready.")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            print(f"[*] MinIO crops bucket '{bucket_name}' not found. Creating it now...")
            s3.create_bucket(Bucket=bucket_name)
        else:
            print(f"[-] Failed to verify MinIO crops bucket: {e}")
            return

    # Apply a public-read bucket policy so the frontend can fetch images directly
    public_read_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": ["*"]},
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
            }
        ]
    }
    try:
        s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(public_read_policy))
        print(f"[+] Public-read policy applied to crops bucket '{bucket_name}'.")
    except Exception as e:
        print(f"[-] Failed to set public-read policy on crops bucket: {e}")