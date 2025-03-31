import os
import sys
import logging
from app import create_app
import socket
import signal

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='[%(asctime)s] [%(levelname)s] %(message)s',
                   datefmt='%Y-%m-%d %H:%M:%S')
logger = logging.getLogger(__name__)

def is_port_in_use(port):
    """Check if a port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def kill_process_using_port(port):
    """Kill process using the specified port"""
    if sys.platform.startswith('win'):
        # Windows
        os.system(f'FOR /F "tokens=5" %P IN (\'netstat -ano ^| findstr :{port}\') DO TaskKill /PID %P /F')
    else:
        # Linux/Mac
        os.system(f'lsof -ti:{port} | xargs kill -9')

if __name__ == "__main__":
    # Get environment or use development by default
    env = os.environ.get('FLASK_ENV', 'development')
    
    # Create app with specified environment
    app = create_app(env)
    
    # Get port from environment or use 9090 by default
    port = int(os.environ.get('PORT', 9090))
    
    # Check if port is already in use
    if is_port_in_use(port):
        logger.warning(f"Port {port} is already in use. Attempting to kill existing process...")
        kill_process_using_port(port)
    
    logger.info(f"Starting app in {env} mode on port {port}")
    # Use the debug setting from the app config
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG']) 