#!/bin/bash
set -e

if [ "$ENV" = "production" ]; then
    echo "Fetching environment variables from AWS SSM..."

    export BACKEND_PORT=$(aws ssm get-parameter \
        --name "/watch-together/backend/port" \
        --with-decryption \
        --query "Parameter.Value" \
        --output text \
        --region $AWS_REGION)

    export YOUTUBE_API_KEY=$(aws ssm get-parameter \
        --name "/watch-together/backend/youtube-api-key" \
        --with-decryption \
        --query "Parameter.Value" \
        --output text \
        --region $AWS_REGION)

    echo "All environment variables set!"
fi

exec node dist/server.js
