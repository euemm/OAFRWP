# OAFRWP
Open Access Funding Request Workflow Project

-- Front --
Receive request form through Google Form

Google Form > Notify people of interest
Google Form > Google Apps Script > Server
Google Form > Google Sheets (For records backup)


-- Back --
Main Server > REST API for form input
Main Server > Keep track of all form input (CSV? DB? Schema-less DB?)
Main Server > Keep track of all invoices (PDF file naming)
Main Server > Keep track of all receipts (PDF file naming)
Main Server > Keep track of all workflow status (Requested, Approved, Paid)
Main Server > Send Email on trigger (Requested, Approved, Paid)
Main Server > Manage email recipents

DB?

NGINX?
