# Full-Stack Group Chat Application

A real-time, fully responsive group chat application built with the MERN stack (MongoDB, Express, React, Node.js) and Socket.io for live messaging.

## Features
- Real-time messaging with Socket.io
- Attachments: Share Images, Documents, and Stickers
- Real-time Location sharing
- User Authentication (JWT)
- Video & Audio Calling (WebRTC)
- Fully responsive, mobile-friendly UI

## Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) installed
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or local MongoDB instance
- [Cloudinary](https://cloudinary.com/) credentials (optional, for cloud file uploads. Otherwise, files are saved locally).

### Setup & Run
1. **Clone the repository**

2. **Start Backend Server**
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *Note: Ensure your `server/.env` file is configured with your `MONGO_URI` and `JWT_SECRET`.*

3. **Start Frontend Client**
   ```bash
   cd client
   npm install
   npm start
   ```

## Deployment Guide (Unified Railway Deployment)

This project has been optimized for a unified deployment on Platform-as-a-Service providers like **Railway**, **Render**, or **Heroku**. In production, the backend server automatically serves the built frontend React application, meaning you only need to deploy **one service** to host the entire full-stack app.

### Deploying to Railway
1. **Connect Repository:** Log into Railway and create a new project from this GitHub repository.
2. **Automatic Build:** Railway will automatically detect the root `package.json`. It will run the `npm run build` script, which installs dependencies for both folders and builds the React frontend.
3. **Automatic Start:** Railway will then run `npm start`, which starts the Express server.
4. **Environment Variables:** In your Railway project settings, add the following Environment Variables:
   - `MONGO_URI`: Your MongoDB connection string.
   - `JWT_SECRET`: A secret string for authentication.
   - `NODE_ENV`: Set to `production`.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (if you want cloud file uploads).
   - *(Note: You no longer need `CLIENT_URL` because the frontend and backend share the same domain!)*

> [!TIP]
> **Why this approach?** Deploying both the client and server together eliminates frustrating CORS errors and saves you money by using only a single container/dyno on your hosting provider.
