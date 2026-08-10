# Architecture Document

## System Hub Architecture Overview

### 1. High-Level Architecture
System Hub follows a modern web application architecture with:
- **Frontend**: Next.js 16.2.12 with App Router, React 18, TypeScript
- **Backend**: Supabase (PostgreSQL database, Authentication, Storage, Edge Functions)
- **Styling**: Tailwind CSS v4 via PostCSS
- **State Management**: React Hooks (useState, useEffect, useContext)
- **Build Tool**: Next.js built-in compiler with TypeScript support

### 2. System Components

#### 2.1 Frontend Layer (Client-Side)
- **Framework**: Next.js App Router for server-side rendering and routing
- **Language**: TypeScript for type safety
- **UI Library**: Custom components with Tailwind CSS utility classes
- **State Management**: React Hooks for local state, Context API for global state where needed
- **Data Fetching**: Direct Supabase client calls from browser
- **File Handling**: 
  - Excel processing with `xlsx` library
  - Image capture and processing with camera access
  - PDF generation planned with `html2pdf.js`

#### 2.2 Backend Layer (Supabase)
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth with email/password providers
- **Storage**: Supabase Storage for file uploads (equipment photos, inspection photos, PIC profiles)
- **Real-time**: Supabase Realtime for future enhancements
- **Edge Functions**: Available for future serverless backend logic
- **Row Level Security (RLS)**: Implemented for data access control

#### 2.3 External Services
- **Camera API**: Browser getUserMedia for live photo capture
- **File System**: Browser-based file operations for Excel import/export
- **Print API**: Window.print() for checklist printing

### 3. Architectural Patterns

#### 3.1 Component Architecture
- **Page Components**: Located in `/app` directory, correspond to routes
- **UI Components**: Reusable components in `/app/components/ui`
- **Feature Components**: Domain-specific components in `/app/components/[feature]`
- **Layout Components**: Shared layout structures in `/app/layout.tsx`

#### 3.2 Data Flow Architecture
1. **User Interaction**: User interacts with UI components
2. **State Updates**: React hooks update local component state
3. **Data Mutations**: Direct Supabase calls for CRUD operations
4. **Real-time Updates**: Component re-renders on state changes
5. **Optimistic Updates**: Immediate UI feedback before server confirmation

#### 3.3 State Management Approach
- **Local State**: useState/useReducer for component-specific state
- **Shared State**: Context API for app-wide state (authentication, user preferences)
- **Server State**: Direct Supabase calls with manual caching via reload triggers
- **Form State**: Controlled components with validation

#### 3.4 Data Access Layer
- **Direct Supabase Calls**: All data operations go through `@supabase/ssr` browser client
- **Centralized Helper**: `getSupabaseClient()` in `/app/lib/supabaseClient.ts`
- **Storage Operations**: Dedicated helper in `/app/lib/storageHelpers.ts`
- **Business Logic**: Encapsulated in service functions and custom hooks

### 4. Module Architecture

#### 4.1 Core Modules
- **Authentication Module**: Handles login/logout, session management
- **Equipment Module**: CRUD operations for equipment masterlist
- **Inspection Module**: Equipment inspection workflow with photo capture
- **Reporting Module**: Inspection logs viewing and filtering
- **PIC Module**: Person-in-Charge management
- **Utilities**: Shared helper functions (storage, date formatting, etc.)

#### 4.2 Key Files and Their Responsibilities
- `/app/layout.tsx`: Root layout with authentication checking
- `/app/lib/supabaseClient.ts`: Supabase client initialization
- `/app/lib/storageHelpers.ts`: Supabase storage file operations
- `/app/lib/inspectionChecklists.ts`: Equipment-specific inspection checklists
- `/app/components/inspection/`: Inspection-specific components (form, camera capture)
- `/app/components/ui/`: Reusable UI components (modals, buttons, icons)
- `/app/dashboard/`: Admin dashboard pages (equipment masterlist)
- `/app/dashboard/inspections/`: Inspection logs and reporting
- `/app/dashboard/pics/`: PIC management
- `/app/guest/`: Guest/view-only access pages

### 5. Database Schema Overview
(See Schema.md for detailed specification)

#### 5.1 Core Tables
- **profiles**: User profile information linked to Supabase Auth users
- **equipment**: Master list of K3 equipment with specifications
- **pic**: Person-in-Charge information for equipment responsibility
- **inspections**: Record of equipment inspections with results and photos
- **storage buckets**: 
  - `equipment_photos`: Equipment profile photos, PIC photos
  - `inspection_photos`: Inspection verification photos

#### 5.2 Relationships
- profiles → pic (one-to-one, optional)
- equipment → pic (foreign key for pic_1_id and pic_2_id)
- inspections → equipment (foreign key)
- inspections → profiles (denormalized inspector_name for performance)

### 6. Security Architecture

#### 6.1 Authentication Security
- Supabase Auth with secure password handling
- JWT-based session management
- HTTP-only cookies for session storage
- Rate limiting on authentication attempts

#### 6.2 Authorization Security
- Role-Based Access Control (RBAC) implemented in frontend routes
- Row Level Security (RLS) policies in Supabase database
- Protected routes redirect unauthorized users
- API exposure limited to necessary Supabase client operations

#### 6.3 Data Security
- Input validation on client and server sides
- Parameterized queries to prevent SQL injection
- File upload validation (type, size, content)
- Secure storage with signed URLs for temporary access
- Environment variable management for secrets

#### 6.4 Network Security
- HTTPS enforcement
- CORS policies configured in Supabase
- Security headers implemented via Next.js
- Dependency scanning for vulnerabilities

### 7. Deployment Architecture

#### 7.1 Development Environment
- Local development with `npm run dev`
- Environment variables from `.env` files
- Hot module replacement for rapid development
- Supabase local emulator option available

#### 7.2 Production Environment
- Vercel platform for Next.js hosting
- Supabase managed PostgreSQL and storage
- Environment variables configured in Vercel dashboard
- Automatic deployments from Git repository
- CDN caching for static assets
- Database backups handled by Supabase

#### 7.3 Scaling Considerations
- Horizontal scaling via Vercel's serverless functions
- Database connection pooling in Supabase
- Storage scalability with Supabase object storage
- Caching strategies for frequently accessed data
- Load balancing handled by Vercel infrastructure

### 8. Integration Points

#### 8.1 Internal Integrations
- Authentication → All protected routes
- Equipment masterlist → Inspection equipment selection
- PIC masterlist → Equipment assignment and inspection inspector selection
- Inspection module → Reporting dashboard data source
- Storage helpers → All photo upload/download operations

#### 8.2 External Integrations
- Browser camera API → Live photo capture for inspections
- File System API → Excel import/export operations
- Window.print() → Checklist and report printing
- Supabase Realtime → Future live updates enhancement
- Webhooks → Potential third-party service integrations

### 9. Performance Optimization Strategies

#### 9.1 Frontend Optimizations
- Code splitting via Next.js dynamic imports
- Image optimization with Next.js Image component (future)
- Memoization of expensive computations
- Virtual scrolling for large lists (planned)
- Efficient React rendering with useCallback/useMemo

#### 9.2 Backend Optimizations
- Database indexing on frequently queried columns
- Supabase edge caching where applicable
- Efficient query design with proper joins and filters
- Storage optimization through image compression (planned)
- Connection pooling and query optimization

#### 9.3 Asset Optimization
- Tailwind CSS purging for minimal CSS bundle
- Image compression before upload (planned)
- Lazy loading of non-critical resources
- Font optimization with next/font
- Bundle analysis and optimization

### 10. Error Handling and Monitoring

#### 10.1 Frontend Error Handling
- Error boundaries for graceful error recovery
- Form validation with user-friendly error messages
- Loading states for asynchronous operations
- Retry mechanisms for failed requests
- Console error logging in development

#### 10.2 Backend Error Handling
- Supabase error handling with try/catch blocks
- Database constraint validation
- Storage operation error handling
- Graceful degradation when services are unavailable

#### 10.3 Monitoring and Logging
- Client-side error logging to console (development)
- Planned integration with monitoring services (Sentry, LogRocket)
- Performance metrics collection
- Audit trail for critical operations (planned)
- Health check endpoints for service monitoring

### 11. Communication Patterns

#### 11.1 Synchronous Communication
- REST-like API calls via Supabase client library
- Direct database queries and mutations
- Real-time subscription patterns (available but not heavily used)

#### 11.2 Asynchronous Communication
- Promise-based async/await for non-blocking operations
- Background processing where applicable
- Event-driven updates for UI state changes
- WebSocket potential for real-time features

#### 11.3 Data Serialization
- JSON for Supabase communication
- FormData for file uploads
- Binary data for image processing
- CSV/Excel formats for data import/export

### 12. Technology Stack Justification

#### 12.1 Next.js
- Server-side rendering for SEO and performance
- App Router for modern routing paradigms
- Built-in TypeScript support
- Excellent developer experience
- Vercel integration for seamless deployment

#### 12.2 Supabase
- Open-source Firebase alternative
- PostgreSQL reliability with convenient interfaces
- Integrated authentication and storage
- Row Level Security for robust access control
- Generous free tier for development
- Real-time capabilities for future enhancements

#### 12.3 Tailwind CSS
- Utility-first CSS for rapid development
- No unused CSS in production builds
- Responsive design capabilities
- Consistent design system
- Easy customization and theming

#### 12.4 TypeScript
- Static type checking for fewer runtime errors
- Better IDE support and refactoring
- Self-documenting code
- Improved team collaboration
- Gradual adoption path

### 13. Architectural Decisions and Trade-offs

#### 13.1 Client-Side vs Server-Side Rendering
- **Chosen**: Client-side rendering for interactive features
- **Reason**: Heavy client-side interactivity (forms, camera, state management)
- **Trade-off**: Initial load time vs. rich interactivity
- **Mitigation**: Code splitting and loading states

#### 13.2 State Management Approach
- **Chosen**: React Hooks with direct Supabase calls
- **Reason**: Simplicity and direct data manipulation
- **Trade-off**: Potential for stale data vs. reduced complexity
- **Mitigation**: Reload triggers and manual cache invalidation

#### 13.3 Storage Strategy
- **Chosen**: Supabase Storage for binary files
- **Reason**: Integrated with authentication and security
- **Trade-off**: Vendor lock-in vs. integrated solution
- **Mitigation**: Abstracted storage helpers for potential migration

#### 13.4 Database Design
- **Chosen**: Normalized schema with selective denormalization
- **Reason**: Data integrity with performance considerations
- **Trade-off**: Join complexity vs. data consistency
- **Mitigation**: Denormalized fields for frequently accessed data (inspector_name)

#### 13.5 Styling Approach
- **Chosen**: Utility-first CSS (Tailwind)
- **Reason**: Development speed and consistency
- **Trade-off**: Longer class names vs. maintainability
- **Mitigation**: Component extraction for repetitive patterns

### 14. Diagrams (Conceptual)

#### 14.1 Component Hierarchy
```
Root Layout
├── Authentication Wrapper
├── Navigation Sidebar
├── Main Content Area
│   ├── Page-Specific Components
│   ├── Feature-Specific Components
│   └── Reusable UI Components
�└── Footer (if applicable)
```

#### 14.2 Data Flow Diagram
```
User Action → React State Update → Supabase API Call → Database Update → 
Subscription/Reload Trigger → State Refresh → UI Re-render
```

#### 14.3 Deployment Diagram
```
User Browser ↔ Vercel Edge Network ↔ Next.js Application 
                              � ↓
                      Supabase Platform
                          � ↓
        � ┌─────────────�┬─────────────�┬─────────────�┐
        │ PostgreSQL  │   Auth      │   Storage   │
        │ Database    │ Management  │ (S3-like)   │
        └─────────────�┴─────────────�┴─────────────�┘
```