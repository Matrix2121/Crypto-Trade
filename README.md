**Starting guide**

0. Install Docker Desktop

1. Clone the GitHub repo from a terminal:
gh repo clone Matrix2121/Crypto-Trade

2. Copy .env file:
cd c:\dev\VSCode_Projects\temp\Crypto-Trade
Copy-Item .env.example .env

3. Replace .env contents with the following contents:
# Database (Docker Compose)
DB_USER=postgres
DB_PASSWORD=root
DB_NAME=postgres
DB_HOST=db
DB_PORT=5432
PUBLISHED_DB_PORT=5432

# Backend
JWT_SECRET=local-dev-jwt-secret-change-me-32chars-minimum
GOOGLE_CLIENT_ID=REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com
ML_SERVICE_URL=http://ml-service:8000

# ML service
LLM_PROVIDER=mock
GEMINI_API_KEY=
PREDICTION_ASSETS=BTC/USD,ETH/USD,SOL/USD,LINK/USD
MIN_RAG_EVENTS=500

# Frontend (baked into Docker build) 
# Leave empty so API calls use relative /api/... paths through nginx
REACT_APP_API_URL=
REACT_APP_GOOGLE_CLIENT_ID=REPLACE_WITH_YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com

4. Open Google Cloud console and create a project - https://console.cloud.google.com/apis/credentials

5. Create OAuth 2.0 Client ID of type Web application

6. Add the following JavaScript origins:
http://localhost, http://localhost:3000

7. Copy the Client ID into both GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_CLIENT_ID in the .env file

8. Run docker:
cd Crypto-Trade
docker compose up -d --build

9. Add your email as an admin:
.\scripts\grant_admin.ps1 -Email "your@gmail.com"

10. (Optional) Download market data from Kraken:
.\scripts\sync_kraken_history.ps1 -Wipe -ConfirmWipe

If docker compose up fails with "address already in use" on port 5432, set PUBLISHED_DB_PORT=5434 (or another free port) in .env and run docker compose up -d again.

After successful starting of the containers, website should be availabel at "http://localhost/"
