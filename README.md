# 🎬 Video Watermark Remover

A modern TypeScript + React web application for efficiently removing watermarks from video files in batch.

[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-0.12-007808?style=flat-square&logo=ffmpeg)](https://ffmpeg.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

[Live Demo](https://video-watermark-remover-kohl.vercel.app) | [Repository](https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER)

## 📋 Table of Contents

- [About](#about)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Building](#-building)
- [Contributing](#-contributing)
- [License](#-license)

## About

This is a **development project** for batch video watermark removal. Built with modern web technologies including React, TypeScript, Vite, and FFmpeg for efficient video processing.

The application provides a foundation for video processing tasks with a clean UI and efficient batch processing capabilities.

> ⚠️ **Project Status**: Under active development. Core implementation is in progress.

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 19.0.0 | UI framework |
| **TypeScript** | 5.8.2 | Type-safe development |
| **Vite** | 6.2.0 | Build tool & dev server |
| **Tailwind CSS** | 4.1.14 | Styling framework |
| **FFmpeg.wasm** | 0.12.15 | Video processing in browser |
| **Express** | 4.21.2 | Backend server |

## Prerequisites

- **Node.js** 16.0.0 or higher - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER.git
cd VIDEO-WATERMARK-REMOVER
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file:

```env
VITE_APP_URL=http://localhost:3000
```

Or copy the example:

```bash
cp .env.example .env.local
```

## 🚀 Getting Started

### Development Server

Start the development server with hot module reloading:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

Compile the project for production:

```bash
npm run build
```

Output will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

### Additional Commands

```bash
npm run lint        # Check TypeScript types
npm run clean       # Remove build artifacts
```

## 📁 Project Structure

```
VIDEO-WATERMARK-REMOVER/
├── src/                    # Source code (React components, utilities)
├── public/                 # Static assets
├── dist/                   # Production build output
├── index.html              # Entry HTML file
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 💻 Development

### Code Structure

- **`src/main.tsx`** - Application entry point
- **`src/App.tsx`** - Main React component
- **`src/components/`** - Reusable React components
- **`src/utils/`** - Utility functions and helpers

### Development Workflow

1. **Start the dev server**: `npm run dev`
2. **Edit files** in `src/` - changes will hot-reload automatically
3. **Check types**: `npm run lint` to catch TypeScript errors
4. **Build for production** when ready: `npm run build`

### Environment Setup

The application loads environment variables from:
- `.env` - Default values
- `.env.local` - Local overrides (not committed)
- `.env.development` - Development-specific values

## 🏗️ Building

### Build Output

```bash
npm run build
```

This generates optimized production files in the `dist/` directory.

### Build Optimization

- Tree-shaking for unused code removal
- Code splitting for better caching
- Minification for smaller bundle sizes
- Source maps for debugging

## 🤝 Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Make** your changes and commit: `git commit -m 'Add your feature'`
4. **Push** to your fork: `git push origin feature/your-feature-name`
5. **Open** a Pull Request with a clear description

### Code Standards

- Use TypeScript for type safety
- Follow existing code style
- Write meaningful commit messages
- Test your changes before pushing

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 Read the [documentation](./docs) (coming soon)
- 🐛 [Report an issue](https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER/issues)
- 💬 [Start a discussion](https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER/discussions)
- 🌐 [Visit the live demo](https://video-watermark-remover-kohl.vercel.app)

## 👤 Author

**senaiverse**
- GitHub: [@senaiverse](https://github.com/senaiverse)
- Repository: [VIDEO-WATERMARK-REMOVER](https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER)

---

<div align="center">

Made with ❤️ by senaiverse

[⬆ back to top](#-video-watermark-remover)

</div>
