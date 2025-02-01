#!/bin/bash

# Exit on errors
set -e

# Define the environment (staging or production)
ENV=${1:-staging}

echo "Starting deployment in $ENV environment..."

# Navigate to the workspace
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Run database migrations
echo "Running database migrations..."
npx sequelize-cli db:migrate --config=config/config.json

# Start the server
echo "Starting server..."
if [ "$ENV" = "production" ]; then
    NODE_ENV=production node app.js
else
    NODE_ENV=staging node app.js
fi

echo "Deployment completed!"
