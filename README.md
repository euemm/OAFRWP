# OAFRWP - Open Access Funding Request Workflow Project

A comprehensive web application for managing Open Access Fund requests at Brandeis University Library. This system handles the complete workflow from request submission to payment processing, including budget management, file uploads, and automated email notifications.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [SQLite Migration Guide](#sqlite-migration-guide)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [User Interface](#user-interface)
- [User Management](#user-management)
- [Security](#security)
- [Deployment](#deployment)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
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
                    │   SQLite DB     │
                    │   (oafrwp.db)   │
                    └─────────────────┘
```

### Data Flow

1. **Request Submission**: Users submit requests via web form
2. **Data Storage**: Requests stored in SQLite database
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
- **SQLite3**: Database
- **Crypto**: Password hashing and JWT tokens

### Frontend
- **HTML5/CSS3**: Modern web standards
- **JavaScript (ES6+)**: Client-side functionality
- **Responsive Design**: Mobile-friendly interface
- **Brandeis Branding**: University-specific styling

### Data Storage
- **SQLite Database**: Primary data storage (oafrwp.db)
- **File System**: Document storage
- **Environment Variables**: Configuration

### Security
- **JWT Authentication**: Secure admin access
- **Password Hashing**: Scrypt-based password security
- **File Validation**: PDF-only uploads
- **Input Sanitization**: XSS prevention
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

   **Note about sqlite3**: The `sqlite3` package uses native bindings. If you encounter build issues:
   - **macOS**: Install Xcode Command Line Tools: `xcode-select --install`
   - **Linux**: Install build tools: `sudo apt-get install build-essential python3` (or equivalent)
   - **Windows**: May need Visual Studio Build Tools

3. **Environment Configuration**
   Create a `.env` file:
   ```env
   TOKEN_SECRET=your-secret-key-here
   LOCAL_URL=https://oafund.library.brandeis.edu
   NODE_ENV=production
   ```
   
   **Environment Variables:**
   - `TOKEN_SECRET`: Secret key for JWT token signing (required)
   - `LOCAL_URL`: Base URL for the application (defaults to `https://oafund.library.brandeis.edu` if not set)
   - `NODE_ENV`: Environment setting (e.g., `production` or `development`)

4. **Initialize Database**
   If you have existing CSV files, run the migration script:
   ```bash
   node migrate.js
   ```

   Otherwise, the database will be created automatically on first run.

5. **Start the application**
   ```bash
   npm start
   ```

## SQLite Migration Guide

### Quick Start for Local Testing

#### Step 1: Backup Your CSV Files (Recommended)
```bash
cp requests.csv requests.csv.backup
cp budget.csv budget.csv.backup
cp cred.csv cred.csv.backup
cp urls.csv urls.csv.backup  # if exists
```

#### Step 2: Run Migration
```bash
node migrate.js
```

The migration script will:
- Create `oafrwp.db` SQLite database
- Create all tables (requests, budget, urls, files, credentials)
- Import data from:
  - ✅ `requests.csv`
  - ✅ `budget.csv`
  - ✅ `cred.csv` (user credentials)
  - ✅ `urls.csv` (if exists)
- **Note**: Files table is created but files are not migrated from filesystem (files uploaded after migration will be tracked automatically)

#### Step 3: Test Migration
```bash
node test-migration.js
```

This will verify:
- Database file exists
- All tables have data
- Sample records look correct

#### Step 4: Start Application
```bash
npm start
```

The application will now use SQLite instead of CSV files.

### Verification

#### Check Database Directly (Optional)
If you have SQLite CLI installed:
```bash
sqlite3 oafrwp.db

# Check tables
.tables

# Count records
SELECT COUNT(*) FROM requests;
SELECT COUNT(*) FROM budget;
SELECT COUNT(*) FROM credentials;

# Get latest budget
SELECT * FROM budget ORDER BY timestamp DESC LIMIT 1;

# Exit
.quit
```

#### Test API Endpoints

1. **Login** (using migrated credentials):
   ```bash
   curl -X POST http://localhost:3000/login \
     -H "Content-Type: application/json" \
     -d '{"id":"testuser","pass":"yourpassword"}'
   ```

2. **Fetch Requests** (requires auth token):
   ```bash
   curl -X GET http://localhost:3000/fetch \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Fetch Budget**:
   ```bash
   curl -X GET http://localhost:3000/fetchBudget \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Production Deployment

#### 1. Backup Strategy
- **Before migration**: Backup all CSV files
- **After migration**: Keep CSV files as backup for 30 days
- **Database backup**: Regularly backup `oafrwp.db` file

#### 2. Deployment Steps
1. **Stop the application** on production server
2. **Backup CSV files**:
   ```bash
   cp requests.csv requests.csv.backup.$(date +%Y%m%d)
   cp budget.csv budget.csv.backup.$(date +%Y%m%d)
   cp cred.csv cred.csv.backup.$(date +%Y%m%d)
   ```
3. **Deploy new code** (with SQLite migration)
4. **Run migration**:
   ```bash
   node migrate.js
   ```
5. **Verify migration**:
   ```bash
   node test-migration.js
   ```
6. **Start application**: `npm start`
7. **Test login** and key functionality
8. **Monitor** for any issues

#### 3. Database File Permissions
```bash
# Set appropriate permissions
chmod 600 oafrwp.db        # Read/write for owner only
chmod 644 oafrwp.db-wal    # If WAL mode is enabled
chmod 644 oafrwp.db-shm    # If WAL mode is enabled
```

#### 4. Performance Benefits
- **Faster queries**: Database indexes (especially on timestamp fields) improve query speed
- **Better concurrency**: SQLite handles concurrent reads efficiently
- **Data integrity**: ACID transactions prevent data corruption
- **Easy backup**: Single file backup (`oafrwp.db`)
- **Efficient budget queries**: Indexed timestamp column makes getting latest budget state fast

#### 5. Rollback Plan (If Needed)
If you need to rollback:
1. Stop application
2. Delete `oafrwp.db`
3. Restore CSV files from backup
4. Revert `app.js` to CSV version (from git history)
5. Restart application

### What's Different After Migration

1. **No more CSV file operations** - All data is in SQLite
2. **Faster queries** - Database queries are faster than CSV parsing (with indexes on timestamp fields)
3. **Better data integrity** - SQLite provides ACID transactions
4. **Budget history tracking** - All budget changes are stored in the budget table with timestamps
5. **Credentials in database** - User credentials are now in the database instead of CSV
6. **File tracking** - Uploaded files are now tracked in the database with metadata (email, timestamp, original filename, size)

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
- **Body**: `multipart/form-data` with `pdfs` field and `email` field
- **Response**: `{ "uploaded": [file_objects] }`
- **Note**: File metadata (email, timestamp, filename, size) is automatically saved to database

#### POST /uploadURL
Submit document URL
- **Body**: `{ "url": "https://...", "email": "user@brandeis.edu" }`
- **Response**: `{ "message": "URL uploaded successfully" }`

#### GET /files
List uploaded files (Admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ "files": [file_objects] }`
- **Note**: Returns files from database with metadata (email, timestamp, original filename, size). Also includes files from filesystem that aren't in database yet (backward compatibility)

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

### Requests Table
| Column | Type | Description |
|--------|------|-------------|
| timestamp | TEXT PRIMARY KEY | ISO timestamp of submission |
| email_address | TEXT | Submitter's email |
| title_of_article | TEXT | Article/chapter title |
| amount_requested | REAL | Funding amount |
| corresponding_author_name | TEXT | Primary author |
| corresponding_author_orcid | TEXT | Author's ORCiD |
| collaborating_author_list | TEXT | Co-authors |
| collaborating_author_orcid_list | TEXT | Co-authors' ORCiDs |
| title_of_journal | TEXT | Journal name |
| journal_issn | TEXT | Journal ISSN |
| publisher | TEXT | Publisher name |
| article_status | TEXT | Publication status |
| publication_type | TEXT | Type of publication |
| doi | TEXT | Digital Object Identifier |
| comment | TEXT | Additional comments |
| oa_fund_status | TEXT | Request status |

### Budget Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| timestamp | TEXT | ISO timestamp of change |
| total_amount | REAL | Total budget at this point in time |
| change_amount | REAL | Amount changed in this transaction |
| reason | TEXT | Reason for change |
| running_total | REAL | Running total of commitments at this point |
| running_total_change | REAL | Change to running total in this transaction |

**Note**: The latest budget record (ordered by timestamp DESC) represents the current budget state. An index on `timestamp` ensures fast queries for the current state.

### URLs Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| timestamp | TEXT | ISO timestamp of submission |
| url | TEXT | Submitted URL |
| email | TEXT | Submitter's email |

### Files Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-increment ID |
| timestamp | TEXT | ISO timestamp of upload |
| filename | TEXT | Stored filename on disk |
| original_filename | TEXT | Original filename from user |
| email | TEXT | Submitter's email |
| file_size | INTEGER | File size in bytes |
| file_path | TEXT | Full path to file on disk |

### Credentials Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Username |
| pass_hashed | TEXT | Hashed password |

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

## User Management

The system includes a JavaScript script (`usermanage.js`) for managing admin users:

```bash
# Add user
node usermanage.js adduser username:password

# Change password
node usermanage.js changepass username:newpassword

# Remove user
node usermanage.js remove username

# List users
node usermanage.js list
```

**Note**: User credentials are stored in the SQLite database (`credentials` table), not in CSV files.

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
- **Database Security**: Proper file permissions on oafrwp.db
- **SQL Injection Protection**: Parameterized queries

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
├── db.js                  # Database module
├── migrate.js             # Migration script
├── test-migration.js      # Migration test script
├── usermanage.js          # User management script
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── .gitignore            # Git ignore rules
├── oafrwp.db             # SQLite database
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
└── files/                # Uploaded files
```

### Environment Variables
```env
TOKEN_SECRET=your-secret-key
LOCAL_URL=https://oafund.library.brandeis.edu
NODE_ENV=production
```

**Environment Variable Details:**
- `TOKEN_SECRET` (required): Secret key used for signing JWT tokens. Should be a strong, random string.
- `LOCAL_URL` (optional): Base URL for the application. Used for generating absolute URLs in email templates and API responses. Defaults to `https://oafund.library.brandeis.edu` if not set.
- `NODE_ENV` (optional): Environment setting. Use `production` for production deployments, `development` for local development.

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
4. **Run migration** (if needed): `node migrate.js`
5. **Start development server**: `npm start`
6. **Access application**: `http://localhost:3000`

### Code Structure
- **app.js**: Main application file with all routes and middleware
- **db.js**: Database module with SQLite operations
- **migrate.js**: CSV to SQLite migration script
- **usermanage.js**: User management CLI tool
- **views/**: EJS templates for all pages
- **public/**: Static assets (CSS, images, etc.)
- **files/**: Uploaded file storage

### Key Functions
- **Authentication**: JWT token management
- **File Upload**: Multer configuration
- **Email Service**: Nodemailer setup
- **Database Operations**: SQLite queries and transactions
- **Status Management**: Request workflow

## Troubleshooting

### Migration Issues

#### Issue: "Error: Cannot find module 'sqlite3'"
**Solution**: Run `npm install` again. If it fails, you may need to install build tools.

#### Issue: "Error initializing database"
**Solution**: Check that you have write permissions in the project directory.

#### Issue: Migration fails on specific CSV rows
**Solution**: The migration script will log errors for specific rows but continue. Check the console output for details.

#### Issue: Database file created but empty
**Solution**: Check that your CSV files have the correct headers and data format.

#### Issue: "Database is locked"
**Solution**: Make sure application is stopped during migration.

#### Issue: Login fails after migration
**Solution**: Verify credentials were migrated: Run `node usermanage.js list` or check database directly.

### Application Issues

#### Issue: Application won't start
**Solution**: 
- Check that `TOKEN_SECRET` is set in `.env`
- Verify database file exists: `ls -lh oafrwp.db`
- Check application logs for specific errors

#### Issue: Database queries fail
**Solution**: 
- Ensure database file has correct permissions: `chmod 600 oafrwp.db`
- Check that database was initialized: Run `node test-migration.js`

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

### Version 2.0.0
- Migrated from CSV to SQLite database
- Budget history tracking with indexed timestamp queries
- Converted user management script from Python to JavaScript
- Improved performance and data integrity
- Better backup and recovery options

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
