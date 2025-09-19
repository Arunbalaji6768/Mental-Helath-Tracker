#!/usr/bin/env python3
"""
PostgreSQL Setup Script for Mental Health Tracker
This script will create the database and tables for PostgreSQL
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_database():
    """Create the MHT database if it doesn't exist"""
    try:
        # Connect to default postgres database
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            user="postgres",
            password="postgres",  # Change this to your actual password
            database="postgres"
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname='mht'")
        exists = cursor.fetchone()
        
        if not exists:
            print("Creating database 'mht'...")
            cursor.execute("CREATE DATABASE mht")
            print("✅ Database 'mht' created successfully!")
        else:
            print("✅ Database 'mht' already exists!")
            
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.OperationalError as e:
        print(f"❌ Connection failed: {e}")
        print("\nPlease check:")
        print("1. PostgreSQL is running")
        print("2. Password is correct (update line 28 in this script)")
        print("3. PostgreSQL is listening on port 5432")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_connection():
    """Test connection to the MHT database"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            port="5432",
            user="postgres",
            password="postgres",  # Change this to your actual password
            database="mht"
        )
        cursor = conn.cursor()
        
        # Test basic query
        cursor.execute("SELECT version()")
        version = cursor.fetchone()
        print(f"✅ Connected to PostgreSQL: {version[0]}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

def main():
    print("🚀 Setting up PostgreSQL for Mental Health Tracker...")
    print("=" * 50)
    
    # Step 1: Create database
    if not create_database():
        print("\n❌ Failed to create database. Please fix the issues above.")
        sys.exit(1)
    
    # Step 2: Test connection
    if not test_connection():
        print("\n❌ Failed to connect to database. Please fix the issues above.")
        sys.exit(1)
    
    print("\n" + "=" * 50)
    print("✅ PostgreSQL setup completed successfully!")
    print("\nNext steps:")
    print("1. Update the password in this script if different from 'postgres'")
    print("2. Run: cd backend && python app.py")
    print("3. The app will automatically create all tables")
    print("4. Test with: http://127.0.0.1:5000/health")
    
    # Step 3: Set environment variable
    os.environ["DATABASE_URL"] = "postgresql+psycopg2://postgres:postgres@localhost:5432/mht"
    print(f"\n📝 Environment variable set: DATABASE_URL={os.environ['DATABASE_URL']}")

if __name__ == "__main__":
    main()
