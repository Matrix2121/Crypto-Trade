# Stage 1: Build the React Application
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 1. Define the build arguments coming from docker-compose
ARG REACT_APP_API_URL
ARG REACT_APP_GOOGLE_CLIENT_ID

# 2. Convert those arguments into environment variables for the Node build process
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

# 3. Now build (React will successfully bake these variables into the JS files)
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]