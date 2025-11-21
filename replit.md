# Restaurant POS System

## Overview

This is a comprehensive restaurant Point of Sale (POS) and management system built as a full-stack web application. The system aims to match or exceed PetPooja software in functionality, providing a complete solution for restaurant operations including billing, table management, kitchen display, inventory, staff management, reporting, and customer engagement features.

The application is designed as a single-page application (SPA) with no page reloads, featuring a professional, clean, and minimalist design approach with modern UI/UX patterns.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Language**: React with TypeScript, following component-based architecture with strict type safety.

**UI Component System**: Utilizes shadcn/ui components (Radix UI primitives) configured in "new-york" style with a custom design system. The component configuration supports both RSC and client-side rendering patterns.

**Styling Approach**: 
- Tailwind CSS for utility-first styling with custom design tokens
- CSS variables for theming (light/dark mode support built-in)
- Custom color palette defined in design guidelines featuring primary red (#E74C3C), secondary blue (#3498DB), and status colors
- Typography system using Inter, Poppins, and Roboto font families

**State Management**: Hybrid approach using React Context API and Redux Toolkit for complex state. TanStack Query (React Query) handles server state with custom query functions.

**Routing**: Wouter for lightweight client-side routing, supporting the SPA architecture.

**Form Handling**: React Hook Form with Hookform Resolvers for validation, using Yup schemas.

**Data Visualization**: Recharts for charts and analytics dashboards.

**Interactions & Animations**: 
- Framer Motion for smooth animations
- Custom hover/active states using elevation utilities
- Toast notifications for user feedback

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js.

**API Design**: RESTful API architecture with routes prefixed under `/api`. The route registration system is modular and extensible.

**Database Layer**: 
- Uses MongoDB (v6) for persistent NoSQL data storage
- Direct MongoDB Node.js driver integration (no ORM)
- Connection managed through custom MongoDB service (`server/mongodb.ts`)
- Database-agnostic schema with TypeScript interfaces and Zod validation

**Data Storage Strategy**: MongoDB-based persistent storage:
- `MongoStorage`: Primary storage implementation using MongoDB collections
- All data (tables, orders, menu items, invoices, etc.) persists in MongoDB
- Automatic seed data initialization on first run (creates default floors, tables, menu items)
- Storage interface (`IStorage`) allows future migration to other databases if needed

**Session Management**: Prepared for session handling with connect-pg-simple for PostgreSQL-backed sessions.

**Development Tooling**: 
- Vite for fast development server with HMR
- Replit-specific plugins for enhanced development experience
- Custom error overlays and runtime error handling

### Application Structure

**Page Organization**: Modular page components for each major feature:
- Core Operations: Dashboard, Billing, Tables, Kitchen (KDS)
- Menu & Inventory: Menu management, Inventory, Purchase Orders, Suppliers
- Customer Management: Customers, Loyalty, Reservations, Feedback
- Staff & HR: Staff, Attendance, User Roles
- Financial: Expenses, Payment Settlement, Accounting, Invoices, Tax Reports
- Marketing: Offers, Coupons, Gift Cards, Email Templates
- Analytics: Reports, Sales Analysis, Item Performance, Kitchen Performance
- System: Settings, Multi-location, Audit Logs, Backup, Integrations

**Component Architecture**:
- Reusable UI components (AppHeader, StatCard, TableCard, MenuItemCard, etc.)
- Feature-specific components (KDSOrderCard, OrderCart, CategorySidebar)
- Sidebar navigation with hierarchical menu structure
- Responsive layout with mobile detection hooks

**Design Philosophy**:
- Three-column layout for billing (category sidebar, items grid, order cart)
- Visual layouts for table management with color-coded status
- Kitchen Display System with real-time order tracking
- Single-window application principle - no page reloads
- Material Design principles for data-heavy enterprise UI

### Integrations

**Digital Menu Integration** (November 14, 2025):
- Automatic sync service that polls MongoDB `digital_menu_customer_orders` collection every 5 seconds
- Converts digital menu orders to POS orders in real-time
- Uses both tableNumber and floorNumber for accurate table matching
- Validates order totals (calculates from items and compares with digital menu total)
- Maps payment status ('paid' → 'billed', else 'active')
- Persists sync status in MongoDB (adds `syncedToPOS: true` and `syncedAt` timestamp)
- Prevents duplicate processing across server restarts
- API endpoints for status monitoring and manual sync triggers
- Preserves item-level data (spice level, notes) in POS order items
- Auto-updates table status to 'occupied' when digital menu order is synced

### Recent Changes (November 2025)

**Recipe Ingredients System - FULLY FIXED** (November 21, 2025):
- Fixed critical bug where recipes were created with 0 ingredients
- Root cause: Database contained stale recipes from previous seeding attempts; API returned old recipes instead of new ones
- Solution implemented:
  1. Modified `getRecipeByMenuItemId()` to sort by `createdAt` descending (returns latest recipe)
  2. Added automatic cleanup in seeding endpoint to delete old recipes before creating new ones
- Result: All 5 Thai recipes now correctly show 6-9 ingredients each
- All 11 Thai ingredients confirmed in inventory: Paneer, Thai Basil, Red Chili, Garlic, Ginger, Lemongrass, Lime, Fish Sauce, Green Chili, Coconut Milk, Prawns
- Recipe system ready for production use with automatic inventory deduction on order checkout

**Complete MongoDB Migration** (November 6, 2025):
- Migrated entire project from in-memory storage to MongoDB for persistent data storage
- Removed PostgreSQL/Drizzle ORM dependencies (deleted server/db.ts, drizzle.config.ts)
- Created MongoDB connection service with automatic database name extraction from URI
- Updated schema from Drizzle pgTable definitions to pure TypeScript interfaces
- Implemented MongoStorage class with full IStorage interface support for all collections
- Added automatic seed data (floors, tables, menu items) on first database connection
- All CRUD operations now use MongoDB directly through the Node.js driver v6
- Data persists across server restarts using MONGODB_URI environment variable

**MongoDB Menu Synchronization**:
- Extended menu items schema to include `image` (URL) and `description` fields
- Added settings storage interface for persistent configuration (MongoDB URI)
- Created MongoDB service (`server/mongodbService.ts`) for external database connectivity
- Implemented API endpoints:
  - `GET /api/settings/mongodb-uri` - Retrieve saved MongoDB URI
  - `POST /api/settings/mongodb-uri` - Save MongoDB connection string
  - `POST /api/menu/sync-from-mongodb` - Sync menu items from MongoDB
- Enhanced Menu UI:
  - Simplified table layout (Item Name, Image, Category, Price, Status, Actions)
  - Three-dot hamburger menu for MongoDB operations
  - Database URI configuration dialog
  - Sync dialog with optional database name override
  - Edit dialog with full field support (name, category, price, cost, image, description, isVeg)
  - Image viewer dialog with Eye icon for quick preview
  - Error handling with user-friendly toast notifications

**PDF Invoice and KOT Generation System** (November 6, 2025):
- Implemented programmatic PDF generation using jsPDF library (no screen printing)
- Created two specialized PDF generators:
  - `server/utils/invoiceGenerator.ts` - Generates invoices with order-type specific attributes
  - `server/utils/kotGenerator.ts` - Generates Kitchen Order Tickets for kitchen staff
- Invoice PDFs adapt to service type:
  - **Dine-in**: Shows table number and floor name
  - **Delivery**: Shows customer name, phone, and delivery address
  - **Pickup**: Shows customer name and phone number
- API Endpoints:
  - `GET /api/orders/:id/invoice/pdf` - Generates and downloads invoice PDF
  - `GET /api/orders/:id/kot/pdf` - Generates and downloads KOT PDF
- Billing Page Integration:
  - **KOT & Print** button → Downloads KOT PDF for kitchen
  - **Save & Print** button → Creates invoice and downloads invoice PDF
  - **Bill & Print** button → Creates invoice and downloads invoice PDF
- Technical Implementation:
  - PDFs generated server-side with proper Content-Type headers
  - Client downloads PDFs with descriptive filenames (Invoice-INV-0001.pdf, KOT-{orderId}.pdf)
  - Fixed route ordering to prevent route conflicts (specific routes before generic :id routes)
  - Save endpoint creates invoices when print=true for seamless workflow

**Enhanced Invoice Management with Full Cart Functionality** (November 6, 2025):
- Implemented comprehensive invoice management with delete and regenerate capabilities
- **Delete Invoice**: Confirmation dialog prevents accidental deletions
  - Shows invoice number and total in confirmation message
  - Backend validates invoice exists before deletion
  - Real-time invoice list update via WebSocket
- **Regenerate Invoice with Cart Interface**: Full billing-cart style workflow
  - Two-panel layout: Menu items (2/3 width) + Current items cart (1/3 width)
  - **Add Items Section**: Category-based menu item selection
    - Fetches menu items and categories from MongoDB when dialog opens
    - Category tabs for filtering (All + dynamic categories)
    - Click menu item to add (auto-increments quantity if already in cart)
    - Shows veg/non-veg indicator, name, category, and price
  - **Cart Section**: Mimics billing cart interface
    - Card-based item display with veg/non-veg indicators
    - +/- buttons for quantity adjustment (enforces minimum quantity of 1)
    - Individual item totals and notes displayed
    - Remove item button per item
    - "Add/Edit Notes" button opens dedicated notes dialog
  - **Notes Management**: Predefined options + custom notes
    - 8 predefined notes (Make it Spicy, Less Spicy, No Onions, etc.)
    - Custom note input field
    - Notes persist with each invoice item
  - **Real-time Calculations**: Automatic totals update
    - Subtotal, Tax (5%), and Total recalculate on any change
    - Displayed in summary box at bottom of cart
  - **Data Validation**: Comprehensive input validation
    - Empty item names blocked
    - Quantity >= 1 enforced
    - Price >= 0 enforced
    - Invoice item structure preserved (name, quantity, price, isVeg, notes)

### Data Models

**Current Schema**: Minimal starter schema with users table, designed to be extended for:
- Menu items and categories
- Orders and order items
- Tables and reservations
- Inventory items and stock tracking
- Customers and loyalty programs
- Staff and attendance records
- Financial transactions and reports

**Schema Strategy**: Uses Drizzle-Zod integration for runtime validation and type safety across the stack.

## External Dependencies

### Database & ORM
- **Neon Serverless PostgreSQL**: Cloud-hosted PostgreSQL database
- **Drizzle ORM**: Type-safe ORM with schema migrations
- **Drizzle Kit**: Schema management and migration tooling

### UI Component Libraries
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu
  - Navigation Menu, Popover, Select, Slider, Tabs, Toast, Tooltip, etc.
- **CMDK**: Command palette component
- **Lucide React**: Icon library

### State & Data Management
- **TanStack React Query**: Server state management with caching
- **date-fns**: Date manipulation and formatting

### Development Tools
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety across the codebase
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS & Autoprefixer**: CSS processing
- **ESBuild**: Fast bundler for production builds

### Replit Integration
- **@replit/vite-plugin-runtime-error-modal**: Error handling overlay
- **@replit/vite-plugin-cartographer**: Development navigation
- **@replit/vite-plugin-dev-banner**: Development mode indicator

### Utility Libraries
- **clsx & tailwind-merge**: Conditional class name utilities
- **class-variance-authority**: Component variant management
- **nanoid**: ID generation
- **ws**: WebSocket support for database connections

### Implemented Integrations
- **MongoDB Integration**: Full menu synchronization from external MongoDB databases
  - Secure URI storage via settings interface
  - Automatic database name extraction from appName parameter or URI path
  - Optional manual database name override
  - Fetches all collections and maps items to menu schema
  - Fields mapped: name, description, price, category, isVeg, image (restaurantName)
  - Cost automatically calculated as 40% of price for imported items

### Planned Integrations
- Payment gateways (Stripe, PayTM)
- Online ordering platforms (Zomato, Swiggy)
- Analytics (Google Analytics)
- Email/SMS services for notifications