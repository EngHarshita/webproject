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

## Deployment Guide

### Frontend Deployment (Vercel or Netlify)
This project is pre-configured for seamless deployment of the frontend React application on Vercel or Netlify.

1. Connect this GitHub repository to Vercel or Netlify.
2. The root directory contains `vercel.json` and `netlify.toml` which automatically configure the build process to target the `client` folder.
3. **Important:** After deploying your backend (see below), you must add the `REACT_APP_BACKEND_URL` Environment Variable in your Vercel/Netlify dashboard, pointing to your deployed backend API URL (e.g., `https://your-backend-api.onrender.com`).

### Backend Deployment (Render, Heroku, or Railway)
> ⚠️ **Important Limitation:** Vercel and Netlify use Serverless functions for their APIs, which **do not support persistent WebSockets (Socket.io)**. Because this chat app relies on Socket.io for real-time messaging and WebRTC signaling, the `server` directory must be deployed to a persistent Node.js host.

1. Deploy the `server` directory to a service like [Render](https://render.com/), [Railway](https://railway.app/), or [Heroku](https://www.heroku.com/).
2. Set the following Environment Variables on your backend hosting provider:
   - `MONGO_URI`: Your MongoDB connection string.
   - `JWT_SECRET`: A secret string for authentication.
   - `CLIENT_URL`: Set this to your Vercel/Netlify frontend URL (e.g., `https://your-frontend.vercel.app`). This is crucial to prevent CORS errors.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (if you want cloud file uploads).
