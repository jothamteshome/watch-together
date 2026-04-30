#!/bin/bash
set -e
exec node --max-old-space-size=384 dist/server.js
