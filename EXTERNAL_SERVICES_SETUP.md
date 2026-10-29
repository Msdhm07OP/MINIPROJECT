# External Services and Additional Setup Requirements

## Overview

**IMPORTANT**: This EventSync implementation is **completely self-contained** and does NOT require any external services for core functionality. However, this document outlines what you would need if you wanted to add optional enhancements.

---

## ✅ Currently NO External Services Required

The current implementation uses:
- **SQLite**: Local file-based database (no external database server needed)
- **Node.js/Express**: Local backend server
- **React/Vite**: Local frontend development server

Everything runs locally on your machine. No cloud services, payment integrations, or external APIs are needed.

---

## 🔧 Optional Enhancements (Future Work)

If you want to extend this project beyond the hackathon requirements, here are external services you might consider:

### 1. Cloud Database (Optional)

**Why**: For production deployment with multiple users

**Options**:
- **Supabase** (PostgreSQL as a service)
  - Free tier available
  - Setup: Create account at https://supabase.com
  - Get connection string
  - Replace SQLite with PostgreSQL adapter
  
- **MongoDB Atlas**
  - Free tier available
  - Setup: Create account at https://www.mongodb.com/cloud/atlas
  - Get connection string
  - Modify database.js to use MongoDB

**Required Changes**:
```javascript
// backend/src/config/database.js
// Replace better-sqlite3 with pg (PostgreSQL) or mongoose (MongoDB)
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
```

**Environment Variables Needed**:
```bash
# Add to backend/.env
DATABASE_URL=postgresql://user:password@host:5432/dbname
# or for MongoDB:
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/dbname
```

### 2. Email Notifications (Optional)

**Why**: Notify clients when bookings are confirmed/rejected/cancelled

**Options**:
- **SendGrid** (email API)
  - Free tier: 100 emails/day
  - Setup: Get API key from https://sendgrid.com
  
- **Resend** (modern email API)
  - Free tier: 3,000 emails/month
  - Setup: Get API key from https://resend.com

**Required Changes**:
```javascript
// backend/src/services/emailService.js (new file)
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendBookingConfirmation = async (booking, client) => {
  await sgMail.send({
    to: client.email,
    from: 'noreply@eventsync.com',
    subject: 'Booking Confirmed',
    html: `Your event ${booking.event_name} is confirmed...`
  });
};
```

**Environment Variables Needed**:
```bash
# Add to backend/.env
SENDGRID_API_KEY=your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

### 3. Authentication (Optional)

**Why**: Multi-user support with login

**Options**:
- **Clerk** (authentication as a service)
  - Free tier available
  - React components included
  - Setup: https://clerk.com
  
- **Auth0**
  - Free tier available
  - Industry standard
  - Setup: https://auth0.com

**Required Changes**:
```javascript
// frontend/src/App.jsx
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react';

function App() {
  return (
    <ClerkProvider publishableKey={process.env.VITE_CLERK_KEY}>
      <SignedIn>
        {/* Your app */}
      </SignedIn>
      <SignedOut>
        {/* Login page */}
      </SignedOut>
    </ClerkProvider>
  );
}
```

**Environment Variables Needed**:
```bash
# Add to frontend/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 4. Cloud Deployment (Optional)

**Why**: Make the app accessible online

**Options**:

**Backend (API) Hosting:**
- **Railway** (easiest)
  - Free tier available
  - Auto-deployment from GitHub
  - Setup: Connect GitHub repo at https://railway.app
  
- **Render**
  - Free tier available
  - Setup: https://render.com

**Frontend Hosting:**
- **Vercel** (recommended for Vite/React)
  - Unlimited free projects
  - Setup: Connect GitHub repo at https://vercel.com
  
- **Netlify**
  - Free tier available
  - Setup: https://netlify.com

**Required Changes**:
```javascript
// frontend/src/services/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

**Environment Variables Needed**:
```bash
# Add to frontend/.env
VITE_API_URL=https://your-backend.railway.app/api
```

### 5. File Storage (Optional)

**Why**: Store event documents, images, contracts

**Options**:
- **Cloudinary** (image/video storage)
  - Free tier: 25GB storage
  - Setup: https://cloudinary.com
  
- **AWS S3** (general file storage)
  - Pay as you go
  - Setup: AWS account required

**Required Changes**:
```javascript
// backend/package.json - add dependency
"cloudinary": "^1.41.0"

// backend/src/config/cloudinary.js (new file)
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
```

**Environment Variables Needed**:
```bash
# Add to backend/.env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 📋 Current Environment Variables

For the hackathon submission, you only need these (all optional):

### Backend (.env)
```bash
PORT=3000  # Optional, defaults to 3000
```

### Frontend (.env)
```bash
# No environment variables required
# API proxy is configured in vite.config.js
```

---

## 🚀 Quick Start (No Setup Needed)

```bash
# Backend
cd backend
npm install
npm run seed
npm start

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

That's it! No API keys, no cloud accounts, no configuration files needed.

---

## ⚠️ Important Notes

1. **SQLite is Production-Ready**: For the hackathon scale (hundreds of bookings), SQLite is perfectly adequate and requires zero setup.

2. **No Secrets in Git**: If you add any external services, create `.env` files and add them to `.gitignore`. Never commit API keys or passwords.

3. **Environment Variables Template**: If you add external services, create `.env.example` files:
   ```bash
   # backend/.env.example
   PORT=3000
   DATABASE_URL=your_database_url_here
   SENDGRID_API_KEY=your_key_here
   ```

4. **Free Tiers**: All suggested external services have free tiers suitable for development and demonstration.

---

## 📞 When You Actually Need External Services

You would only need external services if:
- ✅ Deploying to the internet (not running locally)
- ✅ Sending real email notifications
- ✅ Supporting 1000+ concurrent users (SQLite limit)
- ✅ Adding file uploads
- ✅ Implementing user authentication

**For the hackathon demonstration**: You don't need any of these!

---

## 🎯 Recommendation for Hackathon

**Keep it simple!** The current implementation:
- ✅ Meets all official requirements
- ✅ Runs completely locally
- ✅ Zero external dependencies
- ✅ Easy to demonstrate
- ✅ No internet required
- ✅ No API rate limits
- ✅ No billing concerns

Focus on demonstrating the **scheduling algorithm**, **conflict handling**, and **user experience** — these are what the judges will evaluate.

---

## 📧 After Hackathon

If you want to continue this project:
1. Deploy backend to Railway (free)
2. Deploy frontend to Vercel (free)
3. Add Clerk for authentication (free tier)
4. Keep SQLite or upgrade to Supabase PostgreSQL (free tier)
5. Add SendGrid for emails (free tier)

Total cost: **$0/month** for moderate usage!

---

**Summary**: You can complete the entire hackathon without setting up any external services. Everything runs locally with npm install and npm start.
