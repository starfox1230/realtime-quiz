# Real-Time Collaborative Quiz App (Azure Web App + Azure Web PubSub)

This is a starter repo for a two-player, real-time quiz game. It uses:
- **Node.js + Express** for the API and static hosting
- **Socket.IO** with **Azure Web PubSub adapter** for real-time
- **(Optional) Azure Blob Storage** to persist uploaded quizzes by sessionId

> If you specifically need **Azure SignalR Service**, consider a .NET server or an Azure Functions (JavaScript) hub. For Node servers, **Azure Web PubSub** is the most straightforward choice and functionally equivalent for this use case.

## Requirements

- Node.js 18 or newer

## Quick Start (Local)
1. `npm install`
2. `npm start`
3. Open `http://localhost:8080`

## Deploy to Azure App Service (Portal-only flow)
1. Create a **Resource Group**.
2. Create **Azure Web PubSub** (Standard S1 or Free for testing). Copy the **connection string**.
3. (Optional) Create **Azure Storage Account**; copy its **connection string**.
4. Create an **Azure App Service** (Linux, Node 18+), connect GitHub (Deployment Center).
5. In App Service → **Configuration** → **Application settings**, add:
   - `WEB_PUBSUB_CONNECTION_STRING` = (from step 2)
   - `BLOB_CONNECTION_STRING` = (from step 3, optional)
   - `CORS_ORIGIN` = `https://<your-app>.azurewebsites.net`
   - `NODE_ENV` = `production`
6. Browse to your site URL.

## JSON Schema
See `sample-quiz.json` for format.
