# Use an official Python runtime as a parent image
# Using slim version for smaller image size
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Install ffmpeg which is required by pydub
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
# Use --no-cache-dir to reduce image size
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code and necessary directories into the container
COPY app ./app
COPY static ./static
COPY templates ./templates
COPY run.py .
# We will rely on environment variables for configuration in Docker,
# so config.json and .env files are not copied.

# Make port 9090 available (as defined in run.py, can be overridden by PORT env var)
EXPOSE 9090

# Define environment variable for Flask environment
ENV FLASK_ENV=production

# Specify the command to run the application
# This will execute 'python run.py' when the container starts
CMD ["python", "run.py"] 