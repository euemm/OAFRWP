# OAFRWP - Open Access Funding Request Workflow Project

A comprehensive web application for managing Open Access Fund requests at Brandeis University Library. This system handles the complete workflow from request submission to payment processing, including budget management, file uploads, and automated email notifications.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [User Interface](#user-interface)
- [Security](#security)
- [Deployment](#deployment)
- [Development](#development)
- [Contributing](#contributing)

## Overview

The Open Access Funding Request Workflow Project (OAFRWP) is a Node.js-based web application designed to streamline the management of open access publication funding requests at Brandeis University. The system provides:

- **Public Request Submission**: Faculty and students can submit funding requests through a web form
- **Admin Dashboard**: Library staff can review, approve, deny, and track requests
- **Budget Management**: Real-time budget tracking and history
- **File Management**: Secure PDF upload and URL submission
- **Email Notifications**: Automated status updates and confirmations
- **Authentication**: Secure admin access with JWT tokens

## Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Public Web    │    │   Admin Panel   │    │   File Storage  │
│   Interface     │    │   (Protected)   │    │   & Database    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Node.js API   │
                    │   (Express.js)  │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   CSV Storage   │
                    │   (File-based)  │
                    └─────────────────┘
```

### Data Flow

1. **Request Submission**: Users submit requests via web form
2. **Data Storage**: Requests stored in CSV format
3. **Admin Review**: Library staff review requests through admin dashboard
4. **Status Updates**: Automated email notifications sent on status changes
5. **Budget Tracking**: Real-time budget calculations and history
6. **File Management**: Secure file upload and retrieval system

## Features

### Public Features
- **Request Form**: Comprehensive form for funding requests
- **File Upload**: PDF document upload with validation
- **URL Submission**: Alternative method for document submission
- **SSO Integration**: Automatic user data population
- **Email Validation**: Brandeis.edu email requirement
- **Form Validation**: Client-side and server-side validation

### Admin Features
- **Request Management**: View, approve, deny, and track all requests
- **Budget Management**: Real-time budget tracking and history
- **File Management**: View and manage uploaded documents
- **Status Workflow**: Complete request lifecycle management
- **Email Notifications**: Automated status update emails
- **User Management**: Admin user authentication and management

### Workflow States
- **SUBMITTED**: Initial request state
- **APPROVED**: Request approved for funding
- **DENIED**: Request rejected
- **PAID**: Payment processed
- **PAYMENT_PLANNED**: Payment scheduled
- **CANCELLED**: Request cancelled

## Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **EJS**: Template engine
- **Multer**: File upload handling
- **Nodemailer**: Email service
- **CSV Parser**: Data processing
- **Crypto**: Password hashing and JWT tokens

### Frontend
- **HTML5/CSS3**: Modern web standards
- **JavaScript (ES6+)**: Client-side functionality
- **Responsive Design**: Mobile-friendly interface
- **Brandeis Branding**: University-specific styling

### Data Storage
- **CSV Files**: Primary data storage
- **File System**: Document storage
- **Environment Variables**: Configuration

### Security
- **JWT Authentication**: Secure admin access
- **Password Hashing**: Scrypt-based password security
- **File Validation**: PDF-only uploads
- **CSRF Protection**: Request validation
- **SSO Integration**: Single sign-on support

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- SMTP server access
- File system permissions

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd OAFRWP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file:
   ```env
   TOKEN_SECRET=your-secret-key-here
   NODE_ENV=production
   ```

4. **Initialize Data Files**
   The application will automatically create required CSV files on first run.

5. **Start the application**
   ```bash
   npm start
   ```

### Production Deployment

1. **Server Setup**
   - Ensure Node.js is installed
   - Configure reverse proxy (Apache/Nginx)
   - Set up SSL certificates
   - Configure SMTP server

2. **File Permissions**
   ```bash
   chmod 600 cred.csv
   chmod 644 *.csv
   chmod 755 files/
   ```

3. **Environment Variables**
   ```bash
   export TOKEN_SECRET="your-production-secret"
   export NODE_ENV="production"
   ```

## API Documentation

### Authentication Endpoints

#### POST /login
Authenticate admin users
- **Body**: `{ "id": "username", "pass": "password" }`
- **Response**: `{ "token": "jwt-token", "expiresIn": 3600 }`

#### POST /register
Register new admin users
- **Body**: `{ "id": "username", "pass": "password" }`
- **Response**: `201` on success

### Request Management

#### POST /create
Create new funding request
- **Query Parameters**: All form fields
- **Response**: `200` on success
- **Side Effects**: Sends confirmation email

#### GET /fetch
Retrieve all requests (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: JSON array of requests

### Status Management

#### PUT /approve/:timestamp
Approve a request
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success
- **Side Effects**: Updates budget, sends email

#### PUT /deny/:timestamp
Deny a request
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success
- **Side Effects**: Sends email notification

#### PUT /cancel/:timestamp
Cancel an approved request
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success
- **Side Effects**: Restores budget, sends email

#### PUT /paid/:timestamp
Mark request as paid
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success
- **Side Effects**: Updates budget, sends email

#### PUT /planned/:timestamp
Mark payment as planned
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success
- **Side Effects**: Sends email notification

### File Management

#### POST /upload
Upload PDF files
- **Body**: `multipart/form-data` with `pdfs` field
- **Response**: `{ "uploaded": [file_objects] }`

#### POST /uploadURL
Submit document URL
- **Body**: `{ "url": "https://...", "email": "user@brandeis.edu" }`
- **Response**: `{ "message": "URL uploaded successfully" }`

#### GET /files
List uploaded files (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ "files": [file_objects] }`

#### GET /urls
List submitted URLs (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ "urls": [url_objects] }`

### Budget Management

#### GET /fetchBudget
Retrieve budget data (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: JSON array of budget records

#### PUT /updateBudget/:amount
Update budget amount (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success

#### POST /setBudget/:amount
Set budget total (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200` on success

### Utility Endpoints

#### GET /whoami
Debug SSO attributes
- **Response**: JSON object with SSO data

## Database Schema

### Requests Table (requests.csv)
| Column | Type | Description |
|--------|------|-------------|
| Timestamp | String | ISO timestamp of submission |
| Email Address | String | Submitter's email |
| Title of Article | String | Article/chapter title |
| Amount requested | Number | Funding amount |
| Corresponding Author Name | String | Primary author |
| Corresponding Author ORCiD | String | Author's ORCiD |
| Collaborating Author List | String | Co-authors |
| Collaborating Author ORCiD List | String | Co-authors' ORCiDs |
| Title of Journal | String | Journal name |
| Journal ISSN | String | Journal ISSN |
| Publisher | String | Publisher name |
| Article Status | String | Publication status |
| Publication Type | String | Type of publication |
| DOI | String | Digital Object Identifier |
| Comment | String | Additional comments |
| OA fund status | String | Request status |

### Budget Table (budget.csv)
| Column | Type | Description |
|--------|------|-------------|
| Timestamp | String | ISO timestamp of change |
| Total Amount | Number | Current total budget |
| Change | Number | Amount changed |
| Reason | String | Reason for change |
| RunningTotal | Number | Running total of commitments |
| RunningTotalChange | Number | Change to running total |

### URLs Table (urls.csv)
| Column | Type | Description |
|--------|------|-------------|
| Timestamp | String | ISO timestamp of submission |
| URL | String | Submitted URL |
| Email | String | Submitter's email |

### Credentials Table (cred.csv)
| Column | Type | Description |
|--------|------|-------------|
| id | String | Username |
| pass_hashed | String | Hashed password |

## User Interface

### Public Interface

#### Request Form (`/`)
- **Purpose**: Submit funding requests
- **Features**: 
  - Form validation
  - SSO integration
  - File upload capability
  - Email validation
- **Validation**: Client-side and server-side

#### Upload Page (`/upload`)
- **Purpose**: Upload documents or submit URLs
- **Features**:
  - PDF file upload
  - URL submission
  - Email validation
  - File size limits

#### Login Page (`/login`)
- **Purpose**: Admin authentication
- **Features**:
  - Username/password login
  - JWT token generation
  - Session management

### Admin Interface

#### Requests Dashboard (`/requests`)
- **Purpose**: Manage all funding requests
- **Features**:
  - Request listing with filtering
  - Status management
  - Budget display
  - Action buttons
  - Column toggles

#### Budget History (`/budget-history`)
- **Purpose**: Track budget changes
- **Features**:
  - Budget history table
  - Budget controls
  - Running total tracking
  - Change management

#### Files Management (`/files-page`)
- **Purpose**: Manage uploaded files and URLs
- **Features**:
  - File listing
  - URL listing
  - File download
  - Upload tracking

### Email Templates

#### Confirmation Email
- **Trigger**: Request submission
- **Template**: `confirmation.ejs`
- **Content**: Request confirmation and next steps

#### Status Update Emails
- **Trigger**: Status changes
- **Template**: `application-update.ejs`
- **Content**: Status-specific messages and next steps

## Security

### Authentication
- **JWT Tokens**: Secure admin authentication
- **Password Hashing**: Scrypt-based password security
- **Session Management**: HttpOnly cookies
- **Token Expiration**: 1-hour token lifetime

### Authorization
- **Admin Routes**: Protected with authentication middleware
- **File Access**: Authenticated file serving
- **API Endpoints**: Token-based access control

### Data Protection
- **File Validation**: PDF-only uploads
- **Email Validation**: Brandeis.edu domain requirement
- **Input Sanitization**: XSS prevention
- **CSV Security**: Proper file permissions

### File Security
- **Upload Limits**: 50MB per file, 10 files max
- **File Naming**: Secure filename generation
- **Access Control**: Authenticated file serving
- **MIME Validation**: PDF file type verification

## Deployment

### Production Environment
- **Server**: Linux/Unix server
- **Node.js**: v16 or higher
- **Reverse Proxy**: Apache or Nginx
- **SSL**: HTTPS configuration
- **SMTP**: Email server configuration

### File Structure
```
OAFRWP/
├── app.js                 # Main application file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── .gitignore            # Git ignore rules
├── views/                # EJS templates
│   ├── index.ejs         # Request form
│   ├── requests.ejs      # Admin dashboard
│   ├── login.ejs         # Login page
│   ├── upload.ejs        # Upload page
│   ├── confirmation.ejs  # Email template
│   └── ...
├── public/               # Static assets
│   ├── logo.svg
│   └── brandeis.png
├── files/                # Uploaded files
├── *.csv                 # Data files
└── usermanage.py         # User management script
```

### Environment Variables
```env
TOKEN_SECRET=your-secret-key
NODE_ENV=production
```

### Reverse Proxy Configuration (Apache)
```apache
<VirtualHost *:443>
    ServerName oafund.library.brandeis.edu
    DocumentRoot /path/to/OAFRWP
    
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem
</VirtualHost>
```

## Development

### Local Development
1. **Clone repository**
2. **Install dependencies**: `npm install`
3. **Set environment variables**
4. **Start development server**: `npm start`
5. **Access application**: `http://localhost:3000`

### Code Structure
- **app.js**: Main application file with all routes and middleware
- **views/**: EJS templates for all pages
- **public/**: Static assets (CSS, images, etc.)
- **files/**: Uploaded file storage
- **CSV files**: Data storage

### Key Functions
- **Authentication**: JWT token management
- **File Upload**: Multer configuration
- **Email Service**: Nodemailer setup
- **CSV Processing**: Data manipulation
- **Status Management**: Request workflow

### User Management
The system includes a Python script (`usermanage.py`) for managing admin users:
```bash
# Add user
python3 usermanage.py adduser username:password

# Change password
python3 usermanage.py changepass username:newpassword

# Remove user
python3 usermanage.py remove username

# List users
python3 usermanage.py list
```

## Contributing

### Development Guidelines
1. **Code Style**: Follow existing patterns
2. **Testing**: Test all new features
3. **Documentation**: Update documentation
4. **Security**: Follow security best practices

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

### Issue Reporting
- Use GitHub issues
- Provide detailed description
- Include steps to reproduce
- Specify environment details

## License

This project is licensed under the ISC License - see the package.json file for details.

## Support

For technical support or questions:
- **Email**: librarypublishing@brandeis.edu
- **Documentation**: This README file
- **Issues**: GitHub Issues page

## Changelog

### Version 1.0.0
- Initial release
- Complete request workflow
- Admin dashboard
- Budget management
- File upload system
- Email notifications
- User management
- Security features

---

**Note**: This system is designed specifically for Brandeis University Library's Open Access Fund program. Customization may be required for other institutions.