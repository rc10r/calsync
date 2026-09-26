#!/bin/sh

NVM_DIR="$HOME/.nvm"
APP_DIR="$HOME/dev+rc10r/calsync"
APP="$APP_DIR/dist/app.js"

cd "$APP_DIR" && . "$NVM_DIR/nvm.sh" && nvm use && node "$APP"

