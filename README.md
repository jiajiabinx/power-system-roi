# Smart Grid ROI Calculator

A web application for calculating ROI on smart grid projects with real-time market data integration.

## Prerequisites

- Python 3.10+
- Node.js 14+
- poetry (Python package manager)
- npm (Node package manager)

## Installation

### Backend Setup

1. Navigate to the backend directory:
bash
cd backend

2. Create a virtual environment (optional but recommended):

bash
python -m venv .venv
source .venv/bin/activate # On Windows use: .venv\Scripts\activate

3. Install required Python packages:

bash
poetry install

### Frontend Setup

1. Navigate to the frontend directory:

bash
cd frontend

2. Install Node dependencies:

bash
npm install

## Running the Application

### Start the Backend Server

1. From the backend directory:
uvicorn app.main:app --reload

### Start the Frontend Development Server

1. From the frontend directory:

bash
npm dev run

The frontend will start at `http://localhost:3000`

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Fill in the project details:
   - Company Name
   - Site Zip Code
   - Credit Rating
   - Total Project Cost
   - Payback Period
3. Click "Get Credit Assumptions" to fetch LTV ratio and interest rate
4. Click "Calculate ROI" to see the results

## API Endpoints

- `GET /api/credit-assumptions`: Get LTV ratio and interest rate based on credit rating
- `POST /api/calculate-roi`: Calculate project ROI metrics
- `GET /api/leads`: Get all saved project calculations

## Technologies Used

- Frontend:
  - React.js
  - JavaScript
  - CSS

- Backend:
  - FastAPI
  - Python
  - SQLite
  - numpy-financial
  - yfinance

## Notes

- The application uses real-time treasury rates for calculations
- All financial calculations include market-based assumptions
- Results include IRR, NPV, and other key financial metrics
