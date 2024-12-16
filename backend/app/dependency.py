import geopandas as gpd
from shapely.geometry import Point
from datetime import datetime,timedelta
import pgeocode
import yfinance as yf
import numpy as np
from scipy import interpolate
import numpy_financial as npf
import pandas as pd
import glob
import os
import numpy as np


def get_treasury_rates(payback_period):
    # Treasury tickers
    tickers = {
        '3m': '^IRX',  # 13-week Treasury Bill
        '2y': '^TWO',  # 2-year Treasury Note
        '5y': '^FVX',  # 5-year Treasury Note
        '10y': '^TNX', # 10-year Treasury Note
        '30y': '^TYX'  # 30-year Treasury Bond
    }
    
    rates = {}
    for period, ticker in tickers.items():
        try:
            treasury = yf.Ticker(ticker)
            current_rate = treasury.info.get('previousClose', 0) / 100  # Convert to decimal
            rates[period] = current_rate
        except:
            rates[period] = None
    
    # Convert periods to numeric values (in years)
    x = [0.25, 2, 5, 10, 30]  # corresponding to 3m, 2y, 5y, 10y, 30y
    y = [rates['3m'], rates['2y'], rates['5y'], rates['10y'], rates['30y']]
    
    # Create interpolation function
    f = interpolate.interp1d(x, y, kind='cubic')
    
    # Get 15-year rate
    rates['15y'] = float(f(15))
    rates['20y'] = float(f(20))
    rates['25y'] = float(f(25))
    return rates[payback_period]

def get_credit_assumptions(credit_rating,payback_period):
    
    assert payback_period in ["5y","10y","15y","20y","25y"], "Payback period must be 5y, 10y, 15y, 20y, or 25y"
    
    if credit_rating == "AAA":
        spread = 0.005
        ltv_ratio = 0.9
    elif credit_rating == "AA":
        spread = 0.01
        ltv_ratio = 0.8
    elif credit_rating == "A":
        spread = 0.015
        ltv_ratio = 0.7
    elif credit_rating == "BBB":
        spread = 0.02
        ltv_ratio = 0.6
    elif credit_rating == "BB":
        spread = 0.025
        ltv_ratio = 0.5
    else:
        spread = 0.03
        ltv_ratio = 0.4
        
    interest_rate = get_treasury_rates(payback_period) + spread
    
    return round(interest_rate/100,3), ltv_ratio
       


def roi_helper(data,look_back_period,params):
    """
    Calculate IRR and NPV based on historical data and parameters
    
    Parameters:
    data: DataFrame with datetime, operate, and price columns
    look_back_period: str, period to look back (e.g., "6m", "12m", "24m")
    params: dict containing:
        - lng_price
        - gas_price_growth_rate
        - eletricity_price_growth_rate
        - steam_demand
        - energy_unit_conversion
        - boiler_eff
        - total_project_cost
        - interest_rate
        - ltv_ratio
        - equity_discount_rate
        - pay_back_period
    
    Returns:
    tuple: (IRR, NPV)
    """
    
    today = datetime.today()
    month = int(look_back_period[:-1])
    look_back_days = month * 30
    start_date = today - timedelta(days=look_back_days)
    
    filtered_data = data[data.datetime > start_date]
    total_hours = 8760
    economic_capacity_factor = filtered_data.operate.mean()
    average_eletricity_rate = filtered_data[filtered_data.operate==True].price.mean()
    metrics=["gas price","steam price","generation",'revenue',"avg eletricity rate", 'total eletricity cost','EBITDA','interest expense','cash flow','discount factor','present value']

    dcf = pd.DataFrame(
        0.0,
        index=metrics,
        columns=range(params['pay_back_period'])
    )
    dcf.loc["gas price"] = pd.Series(range(params['pay_back_period'])).apply(
        lambda x: params['lng_price'] * (1 + params['gas_price_growth_rate']) ** x
    )
    
    dcf.loc["steam price"] = dcf.loc['gas price'] * params['energy_unit_conversion'] / params['boiler_eff']
    dcf.loc["generation"] =  economic_capacity_factor * total_hours * params['steam_demand']
    dcf.loc['revenue'] = dcf.loc['generation'] * dcf.loc['steam price']
    
    dcf.loc['avg eletricity rate'] = pd.Series(range(params['pay_back_period'])).apply(
        lambda x: average_eletricity_rate * (1 + params['eletricity_price_growth_rate']) ** x
    )
    
    dcf.loc['total eletricity cost'] = dcf.loc['generation'] * dcf.loc['avg eletricity rate']
    dcf.loc['EBITDA'] = dcf.loc['revenue'] - dcf.loc['total eletricity cost']
    
    dcf.loc['interest expense'] = - params['total_project_cost'] * params['interest_rate']
    dcf.loc['cash flow'] = dcf.loc['EBITDA'] + dcf.loc['interest expense']
    
    # Add terminal value and initial investment
    dcf.loc['cash flow', params['pay_back_period']-1] -= params['total_project_cost'] * params['ltv_ratio']
    dcf.loc['cash flow', 0] -= params['total_project_cost'] * (1 - params['ltv_ratio'])
    
    # Calculate present values
    dcf.loc['discount factor'] = pd.Series(range(params['pay_back_period'])).apply(
        lambda x: 1/(1 + params['equity_discount_rate'])**x
    )
    dcf.loc['present value'] = dcf.loc['cash flow'] * dcf.loc['discount factor']
    # Calculate returns
    npv = int(dcf.loc['present value'].sum())
    irr = - npf.irr(dcf.loc['cash flow'].values)
    
    if np.isnan(irr):
        irr = None
    return irr, npv

def get_lat_long_from_zip(zip_code):
    nomi = pgeocode.Nominatim('us')
    result = nomi.query_postal_code(zip_code)
    if not result.empty:
        return result.latitude, result.longitude
    return None


def find_location_label(zip_code):
    try:
        latitude,longitude = get_lat_long_from_zip(zip_code)
        point = Point(longitude, latitude)  # Note: longitude comes first in Point

        # Read the geospatial data

        gdf = gpd.read_file("backend/app/data/RTO_Regions.geojson")

        # Find which polygon contains the point
        for _, row in gdf.iterrows():
            try:
                if row.geometry.is_valid and row.geometry.contains(point):
                    return row['RTO_ISO'], row['LOC_ABBREV']
            except Exception as e:
                print(f"Error processing geometry: {e}")
                continue
        
        distances = gdf.geometry.distance(point)
        closest_idx = distances.idxmin()
        
        return gdf.iloc[closest_idx]['RTO_ISO'], gdf.iloc[closest_idx]['LOC_ABBREV']
    
    except Exception as e:
        return None, None

def read_caiso_data():
    return pd.read_pickle("backend/app/data/combined_caiso_data.pkl")

def compile_caiso_data():
    # Get all CSV files matching the pattern
    csv_files = glob.glob("backend/app/data/caiso_lmp_rt_15min_zones_*.csv")
    
    # Create an empty list to store individual dataframes
    dfs = []
    
    # Read each CSV file and append to the list
    for file in csv_files:
        try:
            df = pd.read_csv(file,skiprows=3)
            # You might want to add a column to identify which quarter/year the data is from
            filename = os.path.basename(file)
            period = filename.split('_')[-1].replace('.csv', '')  # Gets '2023Q1', '2023Q2', etc.
            df['Local Date'] = pd.to_datetime(df['Local Date'])
            df['Hour'] = df['Hour Number']
            df['datetime'] = df.apply(lambda x: x['Local Date'] + pd.Timedelta(hours=x['Hour Number']-1), axis=1)
            hourly_prices = df.groupby('datetime').agg({
                'NP-15 LMP': 'mean',
                'SP-15 LMP': 'mean',
                'ZP-26 LMP': 'mean'
            }).round(2)
            hourly_prices = hourly_prices.reset_index()
            
            melted_df = pd.melt(hourly_prices, id_vars=['datetime'], value_vars=['NP-15 LMP', 'SP-15 LMP', 'ZP-26 LMP'], var_name='zone', value_name='price')
            melted_df['operate'] = melted_df.price.apply(lambda x: True if x < 0 else False)
            dfs.append(melted_df)
        except Exception as e:
            print(f"Error reading {file}: {e}")
    
    # Concatenate all dataframes
    combined_df = pd.concat(dfs, ignore_index=True)
    
    # Save as pickle file
    combined_df.to_pickle("backend/app/data/combined_caiso_data.pkl")
    
    print(f"Combined shape: {combined_df.shape}")
    print(f"Columns: {combined_df.columns.tolist()}")
    
    return combined_df
   

if __name__ == "__main__":
    iso,loc = find_location_label("90210")
    
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
            "total_project_cost":2.5e6 ,
            "ltv_ratio":0.9,
            "equity_discount_rate":0.12,
            "interest_rate":0.06,
            "pay_back_period":15,
        }
    
    irr, npv = roi_helper(data,'6m',params)
    print(irr,npv)