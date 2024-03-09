# Use an official Node.js runtime as the base image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install global TypeScript compiler
RUN npm install -g typescript

# Install app dependencies
# A wildcard is used to ensure both package.json and package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Build TypeScript code
RUN npm run build

# Run the app
CMD ["npm", "run", "run:prod"]
