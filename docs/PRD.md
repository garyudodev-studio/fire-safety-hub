# Product Requirements Document (PRD)

## System Hub - K3 Equipment Management System

### 1. Executive Summary
System Hub is a Next.js web application designed to manage K3 (Occupational Health and Safety) equipment inspections, maintenance, and reporting. The system enables administrators to manage equipment masterlists, inspectors to perform live equipment inspections with photo verification, and provides reporting capabilities for tracking equipment status and compliance.

### 2. Problem Statement
Organizations struggle with manual, paper-based equipment inspection processes that are:
- Time-consuming and error-prone
- Difficult to track and audit
- Lack real-time visibility into equipment status
- Challenging to maintain compliance with safety regulations

### 3. Solution Overview
System Hub provides a digital platform that:
- Centralizes equipment masterlist management
- Enables live equipment inspections with mandatory photo verification
- Automates inspection scheduling and duplicate prevention
- Generates comprehensive reports and analytics
- Supports role-based access control (Admin vs Inspector)
- Integrates with Supabase for backend services and storage

### 4. Target Users
1. **Administrators** - Manage equipment masterlists, PICs, exports/imports, and have full system access
2. **Inspectors** - Perform equipment inspections, view reports, limited to operational features
3. **Guest Users** - View-only access to equipment status and inspection reports

### 5. Functional Requirements

#### 5.1 Authentication & Authorization
- Email/password authentication via Supabase Auth
- Role-Based Access Control (RBAC) with two roles:
  - Admin: Full access to all features
  - Inspector: Limited to inspections and reports
- Automatic role-based UI adaptation and route protection

#### 5.2 Equipment Masterlist Management (Admin)
- View equipment list with grid/list toggle
- Search equipment by ID, PIC name, or location
- Filter by entity, facility, type, and area
- Add new equipment with form validation
- Edit existing equipment details
- Delete equipment with cascade removal of related data
- Bulk assign PICs to multiple equipment
- Import equipment data via Excel (.xlsx, .xls)
- Export equipment data to Excel
- Download equipment template
- Print equipment checklists
- Automatic cleanup of old photos when replacing equipment images
- Photo upload for PIC profiles (profile and contact photos)

#### 5.3 Inspection Module
- Select equipment from filtered masterlist
- Display dynamic checklist based on equipment type
- Mandatory live camera photos:
  1. Equipment unit photo (live camera only)
  2. Completed checklist form photo (live camera only)
- Inspector selection from PIC masterlist (auto-assigned based on equipment assignment or user profile)
- Auto-calculated inspection week and month/year from inspection date
- Real-time inspection results calculation (PASS/NEEDS_ATTENTION)
- Prevent duplicate inspections (same equipment + same month/year + same week)
- Add remarks and action taken notes
- Save inspection with photo upload to Supabase Storage
- View inspection details with photo preview
- Delete inspection logs with associated photo cleanup

#### 5.4 Reporting Dashboard
- View inspection logs with filtering capabilities
- Filter by:
  - Search (equipment ID, inspector name, equipment type)
  - Entity and facility
  - Equipment type
  - Status (PASS/NEEDS_ATTENTION)
  - Month/Year and Week
- Display key metrics:
  - Total inspections
  - Pass rate percentage
  - Needs attention count
  - Checklist standard compliance
- Export filtered inspection data to Excel (planned)
- View detailed inspection records with photo verification

#### 5.5 Guest Mode
- Read-only access to equipment masterlist
- View-only access to inspection logs
- No authentication required for basic viewing
- Limited to non-sensitive information display

#### 5.6 Special Features
- Fire extinguisher expiry monitoring (30-day warning)
- Automatic photo compression and watermarking (planned for future enhancement)
- Dynamic checklist generation based on equipment type
- Photo validation to ensure live camera images (not uploads from gallery)
- Automatic database cleanup when deleting records

### 6. Non-Functional Requirements

#### 6.1 Performance
- Page load time < 3 seconds for main views
- Inspection form submission < 5 seconds
- Concurrent user support for 50+ users

#### 6.2 Security
- Row Level Security (RLS) enforced via Supabase
- Secure file uploads with proper validation
- Protection against common web vulnerabilities (XSS, CSRF, etc.)
- HTTPS enforcement
- Secure handling of uploaded files (scanning for malware recommended in production)

#### 6.3 Usability
- Intuitive UI with clear navigation
- Responsive design for mobile and desktop use
- Clear visual feedback for user actions
- Error prevention (e.g., duplicate inspection prevention)
- Help text and tooltips where needed

#### 6.4 Reliability
- Graceful degradation when offline (client-side caching where applicable)
- Automatic retry for failed operations
- Data validation on both client and server sides
- Backup and recovery procedures (handled by Supabase)

### 7. Assumptions and Dependencies
- Supabase backend service is available and properly configured
- Users have access to devices with cameras for inspection photo requirements
- Modern web browsers are used (Chrome, Firefox, Safari, Edge)
- Internet connectivity is required for real-time operations
- Excel import/export functionality assumes properly formatted files
- Equipment checklists are maintained in the inspectionChecklists.ts file

### 8. Success Metrics
- Reduction in inspection processing time by 50%
- Increase in inspection compliance rate to 95%+
- Reduction in equipment-related incidents through better tracking
- User satisfaction score > 4.0/5.0
- Adoption rate > 80% of target users within 3 months

### 9. Future Enhancements
- PDF generation of inspection reports with embedded photos and signatures
- Advanced analytics dashboard with trends and predictive maintenance
- Mobile application for offline inspection capabilities
- Integration with IoT sensors for automated equipment monitoring
- Multilingual support
- Equipment calibration tracking and scheduling
- Work order management system integration