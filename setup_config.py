#!/usr/bin/env python3
"""
This script helps set up the OpenAI API key configuration for the VoiceText Pro application.
It creates a config file in the user's home directory.
"""

import os
import json
import stat
import getpass
import sys

def main():
    print("VoiceText Pro - OpenAI API Key Configuration Setup")
    print("=================================================")
    print()
    print("This script will help you set up your OpenAI API key for the VoiceText Pro app.")
    print("The key will be stored in a configuration file in your home directory.")
    print()
    
    # Get the API key from the user
    api_key = getpass.getpass("Enter your OpenAI API key (input will be hidden): ")
    if not api_key:
        print("Error: API key cannot be empty. Exiting.")
        sys.exit(1)
    
    if not api_key.startswith("sk-"):
        print("Warning: OpenAI API keys typically start with 'sk-'. Your key might not be valid.")
        confirm = input("Do you want to continue anyway? (y/n): ")
        if confirm.lower() != 'y':
            print("Exiting without saving.")
            sys.exit(0)
    
    # Create the config file
    config_path = os.path.join(os.path.expanduser("~"), ".voicetext_pro_config.json")
    config_data = {"api_key": api_key}
    
    try:
        with open(config_path, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        # Set file permissions (on Unix-like systems)
        if os.name == 'posix':
            os.chmod(config_path, stat.S_IRUSR | stat.S_IWUSR)  # 0o600 - read/write for user only
            print(f"File permissions set to read/write for user only (chmod 600).")
        
        print(f"Configuration saved to: {config_path}")
        print("You can now run the VoiceText Pro application.")
        
    except Exception as e:
        print(f"Error creating configuration file: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 