<div align="center">
<img width="1200" height="300" alt="ClearMark - Remove Video Watermarks Locally" src="https://images.unsplash.com/photo-1611339555312-e607c04352fd?w=1200&h=300&fit=crop" />
</div>

# 🎬 Video Watermark Remover

A powerful TypeScript-based application that intelligently removes watermarks from video files using advanced AI and image processing techniques.

[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## ✨ Features

- **AI-Powered Watermark Detection**: Automatically identifies watermarks in video frames
- **Non-Destructive Removal**: Intelligently removes watermarks while preserving video quality
- **Batch Processing**: Process multiple videos efficiently
- **Customizable Settings**: Adjust detection sensitivity and removal parameters
- **Fast Processing**: Optimized performance for quick turnaround times
- **Support for Multiple Formats**: Works with common video formats (MP4, AVI, MOV, etc.)

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16.0.0 or higher)
- **npm** or **yarn** package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER.git
cd VIDEO-WATERMARK-REMOVER
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.local.example` to `.env.local` (if it exists)
   - Set your `GEMINI_API_KEY` in [.env.local](.env.local)
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

4. Run the application:
```bash
npm run dev
```

The application will start and be accessible in your browser.

## 📦 Tech Stack

- **Language**: TypeScript (98.3%)
- **Frontend**: HTML & CSS (1.7%)
- **Runtime**: Node.js
- **API Integration**: Gemini API for AI-powered processing

## 🎯 Usage

### Basic Usage

```typescript
import { WatermarkRemover } from './src/remover';

const remover = new WatermarkRemover();
await remover.processVideo('input-video.mp4', 'output-video.mp4');
```

### Advanced Configuration

```typescript
const options = {
  sensitivity: 0.8,
  preserveQuality: true,
  outputFormat: 'mp4',
  frameRate: 30
};

await remover.processVideo('input.mp4', 'output.mp4', options);
```

## 📋 Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the project for production
- `npm run start` - Run the built application

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | API key for Gemini AI service | Yes |
| `NODE_ENV` | Environment (development/production) | No |
| `PORT` | Server port (default: 3000) | No |

## 📚 Documentation

For detailed documentation and API reference, visit the [documentation](./docs) folder.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues, questions, or suggestions, please [open an issue](https://github.com/senaiverse/VIDEO-WATERMARK-REMOVER/issues) on GitHub.

## 👤 Author

**senaiverse**
- GitHub: [@senaiverse](https://github.com/senaiverse)

---

<div align="center">

**[⬆ back to top](#video-watermark-remover)**

Made with ❤️ by senaiverse

</div>