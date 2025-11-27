# Up System

A real-time queue management system for retail sales reps. Track who's "up" to help the next customer, manage check-ins, step-aways, and view performance stats.

## Features

- **Real-time sync** across all devices using Firebase
- **Home tab** - View all reps on the schedule, check them in/out
- **Queue tab** - See the rotation order, mark reps as "with customer"
- **Stats tab** - Track how many customers each rep has helped
- **History tab** - Activity log of all check-ins, customers taken, etc.
- **Mobile-friendly** - Designed for phones, works great as a home screen app

## Quick Start

1. Clone this repo
2. Run `npm install`
3. Set up Firebase (see DEPLOYMENT-GUIDE.md)
4. Update `src/firebase.js` with your Firebase config
5. Run `npm run dev` for local development
6. Deploy to Vercel for production

## Tech Stack

- React 18
- Firebase Realtime Database
- Vite (build tool)

## Documentation

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for full deployment instructions.
