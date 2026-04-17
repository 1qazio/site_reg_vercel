# Neon + Vercel Setup

This project now uses a standard PostgreSQL connection and is intended to work well with Neon on Vercel.

## 1. Create a Neon database

1. Sign in to Neon.
2. Create a new project.
3. Copy the connection string for the primary database.
4. Make sure the connection string includes `sslmode=require`.

Example:

`postgresql://neondb_owner:password@ep-example-region.aws.neon.tech/neondb?sslmode=require`

## 2. Initialize the schema

Run the SQL from [db-schema.sql](/c:/Users/1qazw/Desktop/studi/db-schema.sql) in the Neon SQL editor.

## 3. Configure Vercel environment variables

Add these variables in Vercel:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=0`
- `ALLOWED_HOSTS=.vercel.app,your-domain.com`
- `TIME_ZONE=Europe/Moscow`
- `DATABASE_URL=<your Neon connection string>`

## 4. Deploy

Import the repository into Vercel and deploy. The API is routed through `api/index.py`.
