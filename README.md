# Multi-Brand Inbox Manager

A React-based inbox management system with Supabase authentication and multi-brand support.

## Features

- 🔐 **Authentication**: User signup/login with Supabase Auth
- 🏢 **Multi-Brand Support**: Each user only sees their own leads via `brand_id` filtering
- 📧 **Lead Management**: View, filter, and manage leads from your `retention_harbor` table
- 🎨 **Dark/Light Theme**: Toggle between themes
- 📱 **Responsive Design**: Works on desktop and mobile

## Setup

### 1. Install Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url_here
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Supabase Database Setup

Your `retention_harbor` table should have a `brand_id` column that stores the user ID for each lead.

#### Row Level Security (RLS) Policies

Enable RLS on your `retention_harbor` table and add these policies:

**SELECT Policy:**
```sql
CREATE POLICY "Users can view their own leads" ON retention_harbor
FOR SELECT USING (brand_id = auth.uid()::text);
```

**INSERT Policy:**
```sql
CREATE POLICY "Users can insert their own leads" ON retention_harbor
FOR INSERT WITH CHECK (brand_id = auth.uid()::text);
```

**UPDATE Policy:**
```sql
CREATE POLICY "Users can update their own leads" ON retention_harbor
FOR UPDATE USING (brand_id = auth.uid()::text);
```

**DELETE Policy:**
```sql
CREATE POLICY "Users can delete their own leads" ON retention_harbor
FOR DELETE USING (brand_id = auth.uid()::text);
```

### 4. API Endpoint

Your API endpoint at `https://leads-api-nu.vercel.app/api/retention-harbor` should:

1. Accept a `brand_id` query parameter
2. Filter results by `brand_id` when provided
3. Return leads in the expected format

Example API response:
```json
{
  "leads": [
    {
      "id": "123",
      "brand_id": "user-uuid",
      "first_name": "John",
      "last_name": "Doe",
      "lead_email": "john@example.com",
      "email_message_body": "[conversation JSON]",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Usage

1. **Sign Up/Login**: Users create accounts or sign in
2. **View Leads**: Each user sees only their leads (filtered by `brand_id`)
3. **Manage Inbox**: Filter, search, and respond to leads
4. **Sign Out**: Users can sign out to return to login screen

## Security

- API keys are encrypted before storage
- Row Level Security ensures data isolation
- User authentication required for all operations
- XSS protection on HTML content

## Development

```bash
npm start
```

The app will run on `http://localhost:3000` 