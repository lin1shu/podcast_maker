#!/bin/bash

# Kill any existing server processes (both old and new format)
echo "Checking for existing server processes..."
OLD_PID=$(ps aux | grep 'python app.py' | grep -v grep | awk '{print $2}')
NEW_PID=$(ps aux | grep 'python run.py' | grep -v grep | awk '{print $2}')

# Kill old format process if found
if [ -n "$OLD_PID" ]; then
    echo "Killing existing old server process (PID: $OLD_PID)..."
    kill $OLD_PID
    sleep 2
    
    # Check if it's still running and force kill if needed
    if ps -p $OLD_PID > /dev/null; then
        echo "Process still running, force killing..."
        kill -9 $OLD_PID
    fi
fi

# Kill new format process if found
if [ -n "$NEW_PID" ]; then
    echo "Killing existing new server process (PID: $NEW_PID)..."
    kill $NEW_PID
    sleep 2
    
    # Check if it's still running and force kill if needed
    if ps -p $NEW_PID > /dev/null; then
        echo "Process still running, force killing..."
        kill -9 $NEW_PID
    fi
fi

if [ -z "$OLD_PID" ] && [ -z "$NEW_PID" ]; then
    echo "No existing server processes found."
fi

# Set environment variables if needed
# Default port to 9090
export PORT=9090  # Always use port 9090
# Other environment variables (uncomment if needed)
# export FLASK_ENV=development
# export MONGODB_HOST=localhost
# export MONGODB_PORT=27017
# export MONGODB_USER=admin
# export MONGODB_PASSWORD=password
# export MONGODB_DB=podcast_maker_db

# Check if port 9090 is in use by another application
if lsof -Pi :9090 -sTCP:LISTEN -t >/dev/null ; then
    echo "Port 9090 is already in use. Killing existing process..."
    lsof -ti:9090 | xargs kill -9
    sleep 1
fi

# Start the server with the new refactored structure
echo "Starting server with new structure on port 9090..."
nohup python run.py > app_output.log 2>&1 &

# Get the PID of the new server
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"

# Check if server started successfully
sleep 2
if ps -p $SERVER_PID > /dev/null; then
    echo "Server running successfully."
    echo "Logs available in app_output.log"
    echo "Server should be available at: http://localhost:9090"
else
    echo "Server failed to start. Check app_output.log for details."
    echo "Showing last 10 lines of log:"
    tail -n 10 app_output.log
fi 