Browser SMART App
     │
     ▼
FHIR OAuth2 Token + Patient ID
     │
     ▼
Backend API (Flask / Node.js)
     ├──> Request to Cerner FHIR API
     ├──> Process / Clean data
     ├──> Send to Risk Model
     └──> Return Risk Score to Frontend
