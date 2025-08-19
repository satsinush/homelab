# Use an official Node.js Alpine image as the base
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies for your React app
RUN npm install

# The 'command: npm run dev' in your override file will run after this.
CMD ["npm", "run", "dev"]

EXPOSE 5173