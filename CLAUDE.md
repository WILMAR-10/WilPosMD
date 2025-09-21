# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WilPOS is a **desktop application** built with Electron that uses web technologies (React, TypeScript, HTML, CSS). It's a Point of Sale (POS) system with SQLite database, thermal printing capabilities, inventory management, sales tracking, and user authentication with role-based permissions.

**Key Architecture**: Electron allows us to build a native desktop application using familiar web technologies, with the main process handling system operations (database, printing, file access) and the renderer process running the React UI.

## Development Commands

### Core Development (Desktop App with Web Technologies)
WilPOS is an Electron desktop application that uses web technologies (React, TypeScript). You need to run both frontend and backend simultaneously:

- `npm run electron-dev` - **Primary development command** - Runs both Vite dev server (port 3000) AND Electron app concurrently
- `npm run start` - Start only Vite dev server on port 3000 (frontend only)
- `npm run electron` - Run only Electron app (requires dev server or built assets)
- `npm run build` - Build React app for production using Vite
- `npm run electron-build` - Build complete Electron app for distribution (Windows/macOS/Linux)
- `npm run test` - Run tests with Vitest

**For development, always use `npm run electron-dev`** - This ensures both the web frontend and Electron backend run together.

### Build System
- Uses Vite for React bundling and development server
- Uses Electron Builder for desktop app packaging
- Supports Windows (NSIS), macOS (DMG), and Linux (AppImage/DEB) builds

## Architecture

### Main Process (`main.js`)
- **UnifiedPrinterService**: Handles ESC/POS thermal printing, PDF generation, and cash drawer control
- **WindowService**: Manages multiple windows and component routing
- **FileService**: File system operations and path management
- Database initialization and IPC handler setup

### Renderer Process
- **React app** with TypeScript running in `src/`
- **AppRouter**: Main routing component with permission-based access control
- **AuthContext**: User authentication and permission management
- **Component-based architecture** with pages for different POS functions

### Database Layer (`src/database/`)
- **SQLite database** stored in user data directory
- **DAO pattern** for data access (UsuarioDAO, ProductoDAO, VentaDAO, etc.)
- **Migration system** for schema updates
- **IPC handlers** for secure main-renderer communication

### Printing System
The app uses a unified printing architecture:
- **ESC/POS commands** for thermal printers via `node-escpos-print`
- **Automatic printer detection** with thermal printer identification
- **Receipt generation** with business info, items, totals, and tax handling
- **Cash drawer integration** via ESC/POS commands
- **PDF export** capability for non-thermal printers

### Key Components
- **Caja** (`src/pages/Caja.tsx`): Cash register/POS interface
- **Inventario** (`src/pages/Inventario.tsx`): Inventory management
- **Factura** (`src/pages/Factura.tsx`): Invoice management and viewing
- **Usuarios** (`src/pages/Usuarios.tsx`): User management with role-based permissions
- **Informes** (`src/pages/Informes.tsx`): Sales reports and analytics
- **Configuracion** (`src/pages/Configuracion.tsx`): System settings

### IPC Communication
All main-renderer communication uses IPC handlers defined in `src/database/index.js`:
- Database operations (`productos:*`, `ventas:*`, `usuarios:*`, etc.)
- Printing operations (`printer:*`)
- Window management (`openComponentWindow`, etc.)

### Permission System
- Role-based access control with granular permissions
- Permissions stored as JSON in user records
- Components protected with `hasPermission()` checks
- Default admin user created on first run (username: admin, password: admin)

### Development Notes
- The app uses ES modules (type: "module" in package.json)
- Main process uses `.js` extension, renderer uses `.tsx/.ts`
- Preload script (`preload.cjs`) exposes APIs to renderer via context bridge
- Database schema defined in migration functions
- Thermal printer support requires `node-escpos-print` module

### File Structure
- `/src/pages/` - Main application pages/screens
- `/src/components/` - Reusable React components  
- `/src/database/` - Database layer (SQLite + DAOs)
- `/src/services/` - Business logic services
- `/src/types/` - TypeScript type definitions
- `/src/hooks/` - Custom React hooks
- `/main.js` - Electron main process
- `/preload.cjs` - IPC bridge for renderer

### Testing
- Uses Vitest for unit testing
- Test files should follow `*.test.ts` pattern
- Run tests with `npm run test`

## Important Notes

### Database
- SQLite database auto-created on first run
- Default admin user: username `admin`, password `admin`
- Schema migrations handled automatically
- Database located in Electron userData directory

### Printing
- Thermal printers detected automatically by name patterns
- ESC/POS commands used for receipt printing
- Cash drawer opens via printer connection
- PDF fallback for non-thermal printers

### Security
- Context isolation enabled in Electron
- Node integration disabled in renderer
- IPC communication uses invoke/handle pattern
- Password hashing should be implemented for production use