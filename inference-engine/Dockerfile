FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for OpenCV and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Step 1: Install all standard packages first (provides build-time dependencies like numpy)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Step 2: Install GitHub-sourced packages (e.g. torchreid) after standard packages are ready
# We use --no-build-isolation because torchreid's setup.py imports numpy at build-time.
COPY requirements-github.txt .
RUN pip install --no-cache-dir --no-build-isolation -r requirements-github.txt


# Copy application source
COPY src ./src
COPY main.py .
COPY worker.py .

EXPOSE 5001
CMD ["python", "main.py"]
