FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for Allternit Vision if needed
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# UI-TARS has been absorbed into Allternit Operator as Allternit Vision
# No external cloning needed - code is now part of this repository

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

EXPOSE 3007

CMD ["python", "src/main.py"]

