import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [leads, setLeads] = useState([]);
  const [formData, setFormData] = useState({
    zip_code: '',
    load_zone: '',
    hub_name: '',
    company_name: '',
    credit_rating: '',
    ltv_ratio: '',
    total_project_cost: '',
    selectedPeriod: '6m',
    total_project_cost: '2500000',  // Default 2.5M
    payback_period: '15y',            // Default 6 months
    ltv_ratio: '',
    interest_rate: ''
  });
  const [lead, setLead] = useState(null); 
  const [selectedPeriod, setSelectedPeriod] = useState('6m');
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Fetch initial data
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const response = await fetch('/api/leads');
    const data = await response.json();
    setLeads(data.leads);
  };

  const handleGetCreditAssumptions = async (e) => {
    e.preventDefault();
    
    // Check if credit rating and payback period are selected
    if (!formData.credit_rating || !formData.payback_period) {
        alert("Please select both Credit Rating and Payback Period first");
        return;
    }

    try {
      const response = await fetch(`/api/credit-assumptions?credit_rating=${formData.credit_rating}&payback_period=${formData.payback_period}`);
      const data = await response.json();
        
        // Update form with credit assumptions
        setFormData(prev => ({
            ...prev,
            ltv_ratio: data.ltv_ratio,
            interest_rate: data.interest_rate
        }));
    } catch (error) {
        console.error('Error fetching credit assumptions:', error);
        alert('Error fetching credit assumptions. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: value
    }));

    // If credit rating or payback period changes, fetch new assumptions
    if ((name === 'credit_rating' || name === 'payback_period') && 
        formData.credit_rating && formData.payback_period) {
        fetchCreditAssumptions(formData.credit_rating, formData.payback_period);
    }
  };

  const calculateROI = async (e) => {
    e.preventDefault();

    // Validate LTV ratio
    const ltvRatio = parseFloat(formData.ltv_ratio);
    if (ltvRatio >= 1) {
        alert("LTV ratio must be less than 1.");
        return; // Stop the submission if the LTV ratio is invalid
    }

    try {
        const response = await fetch('/api/calculate-roi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        const leadData = await response.json(); // Get the lead data
        console.log(leadData); 
        setLead(leadData); 

        // Fetch all leads again to update the table
        const leadsResponse = await fetch('/api/leads');
        const leadsData = await leadsResponse.json();
        setLeads(leadsData.leads);

    } catch (error) {
        console.error('Error calculating ROI:', error);
    }
  };

  const fetchCreditAssumptions = async (creditRating, paybackPeriod) => {
    try {
        const response = await fetch('/api/credit-assumptions', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                credit_rating: creditRating,
                payback_period: paybackPeriod
            })
        });
        const data = await response.json();
        
        // Update form with credit assumptions
        setFormData(prev => ({
            ...prev,
            ltv_ratio: data.ltv_ratio,
            interest_rate: data.interest_rate
        }));
    } catch (error) {
        console.error('Error fetching credit assumptions:', error);
    }
  };

  const getMetricsByPeriod = (lead, metric) => {
    const period = selectedPeriod;
    switch(metric) {
      case 'irr':
        return lead[`irr_${period}`];
      case 'npv':
        return lead[`npv_${period}`];
      case 'payback':
        return lead[`payback_period_${period}`];
      default:
        return 0;
    }
  };

  const handleSort = (field) => {
    // If clicking the same field, toggle direction
    if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
        // If clicking a new field, set it with ascending direction
        setSortField(field);
        setSortDirection('asc');
    }
  };

  const getSortedLeads = () => {
    if (!sortField) return leads;

    return [...leads].sort((a, b) => {
        let aValue, bValue;

        // Get the correct values based on the sort field
        switch (sortField) {
            case 'npv':
                // Use the NPV based on selected period
                aValue = selectedPeriod === '6m' ? a.npv_6m :
                        selectedPeriod === '12m' ? a.npv_12m : a.npv_24m;
                bValue = selectedPeriod === '6m' ? b.npv_6m :
                        selectedPeriod === '12m' ? b.npv_12m : b.npv_24m;
                break;
            case 'irr':
                // Use the IRR based on selected period
                aValue = selectedPeriod === '6m' ? a.irr_6m :
                        selectedPeriod === '12m' ? a.irr_12m : a.irr_24m;
                bValue = selectedPeriod === '6m' ? b.irr_6m :
                        selectedPeriod === '12m' ? b.irr_12m : b.irr_24m;
                break;
            default:
                return 0;
        }

        // Sort based on direction
        if (sortDirection === 'asc') {
            return aValue - bValue;
        } else {
            return bValue - aValue;
        }
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Smart Grid ROI Calculator</h1>
      </header>
      
      <main className="two-column-layout">
        <div className="left-column">
          <section className="calculator-section">
            <h2>Calculate Project ROI</h2>
            <form onSubmit={calculateROI}>
              <div className="form-group">
                <label>Company Name:</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Total Project Cost ($):</label>
                <input
                    type="number"
                    name="total_project_cost"
                    value={formData.total_project_cost}
                    onChange={handleInputChange}
                    step="100000"
                    required
                />
              </div>
              <div className="form-group">
                <label>Loan Term (years):</label>
                <select
                  name="payback_period"
                  value={formData.payback_period}
                  onChange={handleInputChange}
                >
                  <option value="">Select Loan Term</option>
                  <option value="5y">5 Years</option>
                  <option value="10y">10 Years</option>
                  <option value="15y">15 Years</option>
                  <option value="20y">20 Years</option>
                  <option value="25y">25 Years</option>
                </select>
              </div>

              <div className="form-group">
                <label>Site Zip Code:</label>
                <input
                  type="text"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                  <label>Select Lookback Period:</label>
                  <select
                      name="selectedPeriod"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                      <option value="6m">6 Months</option>
                      <option value="12m">12 Months</option>
                      <option value="24m">24 Months</option>
                  </select>
              </div>

              <div className="form-group">
                <label>Credit Rating:</label>
                <select
                  name="credit_rating"
                  value={formData.credit_rating}
                  onChange={handleInputChange}
                >
                  <option value="">Select Rating</option>
                  <option value="AAA">AAA</option>
                  <option value="AA">AA</option>
                  <option value="A">A</option>
                  <option value="BBB">BBB</option>
                  <option value="BB">BB</option>
                </select>
              </div>

              <div className="form-group">
                <label>LTV Ratio:</label>
                <input
                    type="text"
                    name="ltv_ratio"
                    value={formData.ltv_ratio ? `${(formData.ltv_ratio * 100).toFixed(2)}%` : ''}
                    onChange={handleInputChange}
                    required
                    readOnly  // Changed from disabled to readOnly
                    style={{ backgroundColor: formData.ltv_ratio ? '#e8f0fe' : '#fff' }}  // Visual feedback
                />
              </div>
              <div className="form-group">
                <label>Interest Rate:</label>
                <input
                    type="text"
                    name="interest_rate"
                    value={formData.interest_rate ? `${(formData.interest_rate*100).toFixed(2)}%` : ''}
                    onChange={handleInputChange}
                    required
                    readOnly  // Changed from disabled to readOnly
                    style={{ backgroundColor: formData.interest_rate ? '#e8f0fe' : '#fff' }}  // Visual feedback
                />
              </div>

              <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
                <button 
                    type="button" 
                    onClick={handleGetCreditAssumptions}
                    className="secondary-button"  // Add this class for styling
                >
                    Get Credit Assumptions
                </button>
                <button type="submit">Calculate ROI and Add to Leads</button>
              </div>
            </form>

            {lead && (
              <div className="roi-results">
                  <h3>Results for {selectedPeriod === '6m' ? '6 Months' : 
                              selectedPeriod === '12m' ? '12 Months' : 
                              '24 Months'}</h3>

                  <div className="metric-card">
                      <h4>IRR</h4>
                      <p>{(() => {
                          const irr = selectedPeriod === '6m' ? lead.irr_6m : 
                                    selectedPeriod === '12m' ? lead.irr_12m : 
                                    lead.irr_24m;
                          return (irr !== null && irr !== undefined && !isNaN(irr)) ? 
                                 `${(irr * 100).toFixed(2)}%` : 'N/A';
                      })()}</p>
                  </div>
                  <div className="metric-card">
                      <h4>NPV</h4>
                      <p>{(() => {
                          const npv = selectedPeriod === '6m' ? lead.npv_6m : 
                                    selectedPeriod === '12m' ? lead.npv_12m : 
                                    lead.npv_24m;
                          return (npv !== null && npv !== undefined && !isNaN(npv)) ? 
                                 `$${npv.toLocaleString()}` : 'N/A';
                      })()}</p>
                  </div>
                  <div className="metric-card">
                      <h4>Interest Rate</h4>
                      <p>{(lead.interest_rate !== null && 
                           lead.interest_rate !== undefined && 
                           !isNaN(lead.interest_rate)) ? 
                          `${(lead.interest_rate * 100).toFixed(2)}%` : 'N/A'}</p>
                  </div>
                  <div className="metric-card">
                      <h4>Average SSP Price</h4>
                      <p>{(lead.avg_ssp_price !== null && 
                           lead.avg_ssp_price !== undefined && 
                           !isNaN(lead.avg_ssp_price)) ? 
                          `$${lead.avg_ssp_price.toFixed(2)}/MWh` : 'N/A'}</p>
                  </div>
                  <div className="metric-card">
                      <h4>LTV Ratio</h4>
                      <p>{(lead.ltv_ratio !== null && 
                           lead.ltv_ratio !== undefined && 
                           !isNaN(lead.ltv_ratio)) ? 
                          `${(lead.ltv_ratio * 100).toFixed(2)}%` : 'N/A'}</p>
                  </div>
                  <div className="metric-card">
                      <h4>Total Project Cost</h4>
                      <p>{(lead.total_project_cost !== null && 
                           lead.total_project_cost !== undefined && 
                           !isNaN(lead.total_project_cost)) ? 
                          `$${lead.total_project_cost.toLocaleString()}` : 'N/A'}</p>
                  </div>
              </div>
          )}
          </section>
        </div>
        <div className="right-column">
          <section className="leads-section">
            <div className="leads-header">
              <h2>Potential Leads</h2>
              <div className="period-selector">
                <label>Lookback Period:</label>
                <select 
                  value={selectedPeriod} 
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="6m">6 Months</option>
                  <option value="12m">12 Months</option>
                  <option value="24m">24 Months</option>
                </select>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Site ID</th>
                  <th>Company</th>
                  <th>ISO</th>
                  <th>Zone</th>
                  <th>Credit Rating</th>
                  <th onClick={() => handleSort('npv')} style={{ cursor: 'pointer' }}>
                    NPV ($) {sortField === 'npv' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('irr')} style={{ cursor: 'pointer' }}>
                    IRR (%) {sortField === 'irr' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Interest Rate (%)</th>
                  <th>Avg SSP Price ($/MWh)</th>
                </tr>
              </thead>
              <tbody>
                {getSortedLeads().map(lead => (
                  <tr key={lead.id}>
                    <td>{lead.id || 'N/A'}</td>
                    <td>{lead.company_name || 'N/A'}</td>
                    <td>{lead.iso_rto || 'N/A'}</td>
                    <td>{lead.loc || 'N/A'}</td>
                    <td>{lead.credit_rating || 'N/A'}</td>
                    <td>{(() => {
                      const npv = selectedPeriod === '6m' ? lead.npv_6m :
                                 selectedPeriod === '12m' ? lead.npv_12m :
                                 lead.npv_24m;
                      return (npv !== null && npv !== undefined && !isNaN(npv)) ? 
                             npv.toLocaleString() : 'N/A';
                    })()}</td>
                    <td>{(() => {
                      const irr = selectedPeriod === '6m' ? lead.irr_6m :
                                 selectedPeriod === '12m' ? lead.irr_12m :
                                 lead.irr_24m;
                      return (irr !== null && irr !== undefined && !isNaN(irr)) ? 
                             `${(irr * 100).toFixed(2)}` : 'N/A';
                    })()}</td>
                    <td>{(lead.interest_rate !== null && 
                         lead.interest_rate !== undefined && 
                         !isNaN(lead.interest_rate)) ? 
                      `${(lead.interest_rate * 100).toFixed(2)}` : 'N/A'}</td>
                    <td>{(lead.avg_ssp_price !== null && 
                         lead.avg_ssp_price !== undefined && 
                         !isNaN(lead.avg_ssp_price)) ? 
                      lead.avg_ssp_price.toFixed(2) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
