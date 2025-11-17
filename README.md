# Corrupt Watch 🕵️‍♂️  
A civic-tech web platform that enables citizens to report corruption or public grievances with text, images, or video evidence.  
The system uses AI for complaint analysis, blockchain for secure storage, and dashboards for authorities to manage reports.

## 🚀 Features

### 📝 Citizen Features
- Submit corruption complaints with text, images, or videos  
- Track your submitted complaints  
- Geo-tagging support  

### 👮 Authority Dashboard
- View, verify, and prioritize complaints  
- AI-assisted complaint classification  
- Access evidence files uploaded by citizens  
- Status updates and communication tools  

### 🔐 Security
- Blockchain-backed complaint storage  
- Immutable audit trails  
- Authentication & role-based access  

## 📦 Tech Stack

### Frontend
- React + Vite (TypeScript)
- Tailwind CSS
- shadcn/ui
- Radix UI
- React-Leaflet
- Supabase

### Backend (optional)
- Node.js / Supabase Functions
- Blockchain layer (optional)

## 🗂 Project Structure

corrupt-watch-project/  
├── public/  
├── src/  
│   ├── components/  
│   ├── hooks/  
│   ├── integrations/  
│   ├── lib/  
│   ├── pages/  
│   ├── App.tsx  
│   ├── main.tsx  
│   └── index.css  
├── supabase/  
├── .env  
├── package.json  
├── tailwind.config.ts  
├── vite.config.ts  
└── README.md  

## 🛠 Installation & Setup

### 1. Install dependencies
npm install

### 2. Start development server
npm run dev

### 3. Build for production
npm run build

### 4. Preview production build
npm run preview

## 🔑 Environment Variables
Create a `.env` file:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MAPBOX_KEY=

## 🗺 Leaflet Setup
npm install react-leaflet@4 @react-leaflet/core@2 leaflet  
Add in main.tsx:
import "leaflet/dist/leaflet.css";

## 🤝 Contributing
Pull requests are welcome!

## 📄 License
MIT License
EOF
