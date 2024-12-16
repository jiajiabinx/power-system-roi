from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime,timedelta
from decimal import Decimal
from backend.app.dependency import *



class ProjectInput(BaseModel):
    zip_code: str
    company_name: str
    credit_rating: str = "AA"
    selectedPeriod: str
    
    payback_period: str = "15y"
    ltv_ratio: float = None
    interest_rate: float = None
    
    total_project_cost: float
    


class CreditAssumptions(BaseModel):
    ltv_ratio: float
    interest_rate: float
    payback_period: str

    
class ROIResult(BaseModel):
    irr: float
    npv: float
    payback_period: float

class Lead(BaseModel):
    id: int
    company_name: str
    iso_rto: str
    zip_code: str
    loc: str
    credit_rating: Optional[str]
    irr_6m: float | None
    irr_12m: float | None
    irr_24m: float | None
    npv_6m: float | None
    npv_12m: float | None
    npv_24m: float | None
    payback_period_6m: float
    payback_period_12m: float
    payback_period_24m: float
    total_project_cost: float
    ltv_ratio: float
    interest_rate: float
    avg_ssp_price: float

# In-memory storage for leads (replace with database later)
leads_db = []
lead_id_counter = 1

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/api/credit-assumptions")
async def credit_assumptions(credit_rating: str, payback_period: str) -> CreditAssumptions:
    try:
        interest_rate, ltv_ratio = get_credit_assumptions(credit_rating,payback_period)
        return CreditAssumptions(ltv_ratio=ltv_ratio, 
                                 interest_rate=interest_rate,
                                 payback_period=payback_period
                                 )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/calculate-roi")
async def calculate_roi(project: ProjectInput):
    try:
        
        iso,loc = find_location_label(project.zip_code)
        
        global lead_id_counter

        data = read_caiso_data()
        zone = loc + " LMP"
        data  = data[data.zone == zone]
        today = datetime.now().date()
        
        params = {
            "lng_price":2.12,
            "gas_price_growth_rate":0.025,
            "eletricity_price_growth_rate":0.025,
            "steam_demand":11,
            "energy_unit_conversion":3.412,
            "boiler_eff":0.8,
            "total_project_cost":project.total_project_cost,
            "ltv_ratio": project.ltv_ratio,
            "equity_discount_rate":0.12,
            "interest_rate":project.interest_rate,
            "pay_back_period":int(project.payback_period[:-1]),
        }
        avg_ssp_price = data.price.mean()
        irr_6m,npv_6m = roi_helper(data,"6m",params)
        irr_12m,npv_12m = roi_helper(data,"12m",params)
        irr_24m,npv_24m = roi_helper(data,"24m",params)

        new_lead = Lead(
            id=lead_id_counter,
            company_name=project.company_name,
            iso_rto=iso,
            loc=loc,
            zip_code=project.zip_code,
            credit_rating=project.credit_rating,
            irr_6m=irr_6m,  
            irr_12m=irr_12m,
            irr_24m=irr_24m,
            npv_6m=npv_6m,
            npv_12m=npv_12m,
            npv_24m=npv_24m,
            payback_period_6m=5.0,
            payback_period_12m=6.0,
            payback_period_24m=7.0,
            total_project_cost=params['total_project_cost'],  # Include total project cost
            ltv_ratio=params['ltv_ratio'],
            avg_ssp_price=avg_ssp_price,
            interest_rate=params['interest_rate'],
        )
        leads_db.append(new_lead)
        lead_id_counter += 1
        return new_lead  # Return the Lead model directly
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/leads")
async def get_leads():
    return {"leads": leads_db} 