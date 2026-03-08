#!/bin/sh

NVM_DIR=$HOME/.nvm
NODE_DIR=$NVM_DIR/versions/node/v20.8.0/bin
NODE=node
APP_DIR=$HOME/Developer/_projects_personal/calsync/calsync-bg
APP=$APP_DIR/dist/app.js

source $NVM_DIR/nvm.sh && cd $APP_DIR && $NODE $APP

