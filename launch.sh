#!/bin/bash

echo "Stopping any processes using port 9090..."

# Find the process using port 9090 on macOS
PID=$(lsof -i :9090 -t)

if [ -n "$PID" ]; then
    echo "Killing process $PID using port 9090"
    kill -9 $PID
    sleep 1
else
    echo "No process found using port 9090"
fi

# On macOS, check if AirPlay is using port 5000
if [ "$(uname)" == "Darwin" ]; then
    echo "Note: On macOS, port 5000 might be used by AirPlay Receiver."
    echo "If you still have issues, disable it in System Preferences -> General -> AirDrop & Handoff."
fi

echo "Starting the TTS web application..."
python app.py 