from flask import Flask
from flask_cors import CORS
import logging
import sys
from datetime import timedelta
import os

def create_app(config_name='default'):
    app = Flask(__name__, 
                static_folder='../static', 
                template_folder='../templates')
    
    # Load configuration
    from app.config.config import config_dict
    app.config.from_object(config_dict[config_name])
    
    # Configure logging
    configure_logging(app)
    
    # Configure CORS
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Set session configuration
    app.secret_key = app.config['SECRET_KEY']
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
    app.config['SESSION_TYPE'] = 'filesystem'
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.podcast import podcast_bp
    from app.routes.audio import audio_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(podcast_bp, url_prefix='/podcast')
    app.register_blueprint(audio_bp, url_prefix='/audio')
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # Create required directories
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs('audio', exist_ok=True)
    
    # Initialize database
    from app.services.database import init_db
    init_db(app)
    
    # Configure CORS headers globally
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    return app
    
def configure_logging(app):
    """Configure logging for the application"""
    logging.basicConfig(
        level=logging.DEBUG, 
        format='[%(asctime)s] [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('app.log')
        ]
    )
    app.logger.setLevel(logging.DEBUG)
    
    # Set pymongo logger to INFO level to filter out heartbeat messages
    logging.getLogger("pymongo").setLevel(logging.INFO)
    logging.getLogger("pymongo.monitoring").setLevel(logging.INFO) 