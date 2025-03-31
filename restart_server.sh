#!/bin/bash

# Kill any existing python app.py processes
echo "Checking for existing server processes..."
EXISTING_PID=$(ps aux | grep 'python app.py' | grep -v grep | awk '{print $2}')

if [ -n "$EXISTING_PID" ]; then
    echo "Killing existing server process (PID: $EXISTING_PID)..."
    kill $EXISTING_PID
    sleep 2
    
    # Check if it's still running and force kill if needed
    if ps -p $EXISTING_PID > /dev/null; then
        echo "Process still running, force killing..."
        kill -9 $EXISTING_PID
    fi
else
    echo "No existing server process found."
fi

# Start the server
echo "Starting server..."
nohup python app.py > app_output.log 2>&1 &

# Get the PID of the new server
NEW_PID=$!
echo "Server started with PID: $NEW_PID"

# Check if server started successfully
sleep 2
if ps -p $NEW_PID > /dev/null; then
    echo "Server running successfully."
    echo "Logs available in app_output.log"
else
    echo "Server failed to start. Check app_output.log for details."
fi 