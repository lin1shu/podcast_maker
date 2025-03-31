from flask import Blueprint, render_template, session, current_app, redirect, url_for

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Render the main index page"""
    # Clear any previous session data
    session.clear()
    
    # Get configuration values needed for the template
    return render_template(
        'index.html', 
        voices=current_app.config['AVAILABLE_VOICES'],
        tones=current_app.config['AVAILABLE_TONES'],
        api_key_set=bool(current_app.config['OPENAI_API_KEY'])
    )

@main_bp.route('/podcast_list')
def legacy_podcast_list():
    """Redirect to the new podcast list route"""
    return redirect(url_for('podcast.podcast_list')) 