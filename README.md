# Atlas Cortex 🎮✨

> A mobile RPG that uses Generative AI as an infinite "Dungeon Master" with hybrid AI architecture.

![React Native](https://img.shields.io/badge/React%20Native-Expo-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Firebase](https://img.shields.io/badge/Firebase-Backend-orange)

## 🌟 Features

### Core Mechanics
- **Hybrid AI Architecture**: Logic Engine (GPT-4o-mini) + Narrator (Claude Sonnet 4)
- **Smart Game State**: Tracks HP, inventory, dice rolls like a real video game
- **Real-time HUD**: Animated health bars, stat displays, and resource tracking

### World Modules
| Module | Theme | Key Mechanics |
|--------|-------|---------------|
| ⚔️ The Classic | D&D 5th Edition | Stats, spell slots, AC, proficiency |
| 🌌 The Outworlder | HWFWM | Essence system, rank progression, Blue Box alerts |
| 👤 Shadow Monarch | Solo Leveling | Daily quests, shadow army, gate dungeons |

### Subscription Tiers

All tiers use the same hybrid AI system:
- **GPT-4o-mini** handles game logic, state updates, inventory, and dice rolls
- **Claude Sonnet 4** generates immersive narrative and storytelling

| Tier | Monthly Turns | Price | Notes |
|------|---------------|-------|-------|
| **Scout** (Free) | 15 | Free | Full AI experience with limited turns |
| **Hero** | 300 | $9.99/month | 20x more turns |
| **Legend** (BYOK) | Unlimited | $49.99 (One-time) | One-time license + BYOK |


## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Expo CLI (`npm install -g expo-cli`)
- Firebase account
- API keys for OpenAI and Anthropic (for full features)

### Installation

```bash
# Clone and install dependencies
cd ghost-armstrong
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase config

# Start the development server
npm start
```

### Firebase Setup

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password, Google, Apple)
3. Create a Firestore database
4. Deploy Cloud Functions:

```bash
cd functions
npm install
firebase login
firebase deploy --only functions
```

5. Set API keys in Firebase config:
```bash
firebase functions:config:set openai.key="sk-xxx" anthropic.key="sk-ant-xxx"
```

## 📁 Project Structure

```
atlas-cortex/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root navigation
│   ├── index.tsx           # Home screen
│   ├── campaign/[id].tsx   # Game session
│   ├── world-select.tsx    # World picker
│   └── settings.tsx        # Settings + BYOK
├── components/
│   ├── chat/               # Chat UI components
│   └── hud/                # Game HUD components
├── lib/
│   ├── theme.ts            # Design system
│   ├── types.ts            # TypeScript definitions
│   └── store.ts            # Zustand state
├── schemas/                # World module JSON schemas
├── functions/              # Firebase Cloud Functions
│   └── src/
│       ├── index.ts        # Entry point
│       ├── brain.ts        # Logic engine (GPT)
│       └── voice.ts        # Narrator (Claude)
└── firebase.json           # Firebase config
```

## 🎨 Design System

The app uses a dark fantasy theme with:
- **Primary**: Deep purples (#6d28d9)
- **Accent**: Gold (#f59e0b)
- **Background**: Space black (#0f0a1e)

See `lib/theme.ts` for the complete design token system.

## 🔧 Development

### Running the App

```bash
# iOS Simulator
npm run ios

# Android Emulator
npm run android

# Web (for quick testing)
npm run web
```

### Running Cloud Functions Locally

```bash
cd functions
npm run serve
```

## 📜 License

MIT License - see LICENSE file for details.

---

Built with ❤️ using React Native, Expo, Firebase, and AI
