# StadiumAI

StadiumAI is a full-stack web application designed for a smart stadium experience. It features real-time crowd density monitoring, AI-powered chats, Telegram bot integration for attendee assistance, and a live tracking admin panel.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm or yarn

## Getting Started Locally

1. **Install Dependencies**
   Run the following command in the root directory to install all necessary packages:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory based on the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and fill in your API keys:
   - `GEMINI_API_KEY`: Your Google Gemini API key (Required for the AI chat features and vision crowd analysis). Get one at [Google AI Studio](https://aistudio.google.com/).
   - `TELEGRAM_BOT_TOKEN`: (Optional) Your Telegram Bot Token. Talk to BotFather on Telegram to generate this if you want the telegram integration.
   - `CRIC_API_KEY`: (Optional) Your Cricket API key.

3. **Firebase Configuration**
   This project uses Firebase for real-time state and database. The connection details are stored in `firebase-applet-config.json`. 
   If you want to use your own Firebase project (recommended for production):
   - Set up a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
   - Enable the **Firestore Database**.
   - Update the `firebase-applet-config.json` with your own Firebase configuration keys and Project ID.

4. **Run the Development Server**
   Start the development server. This project runs a custom Express server (`server.ts`) that also serves the React frontend via Vite middleware.
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

## Production Build

To build the application for production (compiles the React app into static files in `/dist`):
```bash
npm run build
```

To run the production build using the Express server:
```bash
npm start
```

## Architecture & Stack
- **Frontend**: React (Vite), Tailwind CSS, Lucide React (Icons).
- **Backend / Routing**: Node.js with Express (`server.ts`).
- **Database**: Firebase Firestore (for live synchronizations of zones and chat logs).
- **AI Integration**: Google's new `@google/genai` TypeScript SDK.
