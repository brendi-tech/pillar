#!/bin/bash
# Help Center Backend - Local Database Setup Script
#
# Creates the HC database and user for the standalone help center backend
# Uses .env.local for configuration
#
# Prerequisites:
#   - PostgreSQL running locally (via docker-compose or native)
#   - psql command available
#
# Usage:
#   ./scripts/setup_local_db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"

echo "================================================"
echo "Help Center Backend - Database Setup"
echo "================================================"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql command not found"
    echo "Please install PostgreSQL client or ensure it's in your PATH"
    exit 1
fi

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file not found: $ENV_FILE"
    exit 1
fi

# Load environment variables from the env file
# Only source lines that look like valid VAR=VALUE assignments
echo "Loading environment variables from .env.local..."
set -a
while IFS='=' read -r key value; do
    # Skip empty lines, comments, and lines without =
    [[ -z "$key" || "$key" =~ ^[[:space:]]*# || -z "$value" ]] && continue
    # Skip lines where key contains spaces (not valid variable names)
    [[ "$key" =~ [[:space:]] ]] && continue
    # Remove leading/trailing whitespace from key
    key=$(echo "$key" | xargs)
    # Only export if key looks like a valid variable name
    if [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
        export "$key=$value"
    fi
done < "$ENV_FILE"
set +a

# Get database configuration with defaults matching help-center-backend/config/settings/base.py
DB_NAME="${HC_POSTGRES_DB:-help_center_dev}"
DB_USER="${HC_POSTGRES_USER:-postgres}"
DB_PASSWORD="${HC_POSTGRES_PASSWORD:-postgres}"
DB_HOST="${HC_POSTGRES_HOST:-localhost}"
DB_PORT="${HC_POSTGRES_PORT:-5432}"

# Admin credentials for creating database (postgres superuser from docker-compose)
ADMIN_USER="postgres"
ADMIN_PASSWORD="postgres"

echo ""
echo "Database Configuration:"
echo "  Database: $DB_NAME"
echo "  App User: $DB_USER"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" &> /dev/null; then
    echo "Error: PostgreSQL is not running on $DB_HOST:$DB_PORT"
    echo ""
    echo "Start it with:"
    echo "  docker-compose up -d postgres"
    exit 1
fi

echo "PostgreSQL is running on $DB_HOST:$DB_PORT"
echo ""

# Check if database already exists
if PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "Database '$DB_NAME' already exists!"
    echo ""
    read -p "Drop and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d postgres -c "DROP DATABASE \"$DB_NAME\";"
    else
        echo "Keeping existing database. Exiting."
        exit 0
    fi
fi

echo "Setting up database $DB_NAME..."
echo ""

# Create user if it doesn't exist (and it's not postgres)
if [ "$DB_USER" != "postgres" ]; then
    echo "Creating user '$DB_USER' if not exists..."
    PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d postgres <<EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE USER "$DB_USER" WITH LOGIN PASSWORD '$DB_PASSWORD';
        RAISE NOTICE 'User $DB_USER created';
    ELSE
        -- Update password in case it changed
        ALTER USER "$DB_USER" WITH PASSWORD '$DB_PASSWORD';
        RAISE NOTICE 'User $DB_USER already exists, password updated';
    END IF;
END
\$\$;
EOF
fi

echo "Creating database $DB_NAME..."

# Create database
PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d postgres <<EOF
-- Create the help center database
CREATE DATABASE "$DB_NAME";

-- Grant all privileges to the app user
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";

-- Also grant to postgres for admin access
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$ADMIN_USER";
EOF

# Connect to the new database and enable pgvector + grant schema permissions
PGPASSWORD="$ADMIN_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" <<EOF
-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant schema permissions to app user
GRANT ALL ON SCHEMA public TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "$DB_USER";
EOF

echo ""
echo "================================================"
echo "Setup complete!"
echo "================================================"
echo ""
echo "Database '$DB_NAME' created successfully with:"
echo "  - pgvector extension enabled"
echo "  - User '$DB_USER' with full permissions"
echo ""
echo "Next steps:"
echo "  1. Run migrations:"
echo "     cd help-center-backend"
echo "     uv run python manage.py migrate"
echo ""
echo "  2. Start the server:"
echo "     uv run python manage.py runserver 8003"
echo ""
