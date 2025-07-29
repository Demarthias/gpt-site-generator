# GPT Site Generator

A powerful website generator that uses GPT and DALL-E to create custom websites with AI-generated content and images.

## Features

- 🎨 AI-powered website content generation
- 🖼️ Image upload and management
- 🤖 DALL-E integration for AI image generation
- 🎭 Multiple theme support (Light/Dark)
- 📱 Responsive design
- 🔒 Secure file handling
- 🚀 Optimized image processing
- ☁️ Cloud storage integration

## Prerequisites

- Node.js (v14 or higher)
- NPM (v6 or higher)
- OpenAI API key
- Cloudinary account (for image hosting)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gpt-site-gen.git
   cd gpt-site-gen
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a .env file:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in .env:
   - Add your OpenAI API key
   - Add your Cloudinary credentials
   - Configure other settings as needed

## Usage

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Access the application:
   - Main page: http://localhost:3000
   - Image manager: http://localhost:3000/image-manager.html

## Features

### Website Generation
- Input your business details
- Choose a theme
- Add custom images or generate with AI
- Get a complete, responsive website

### Image Management
- Upload multiple images
- Generate AI images with DALL-E
- Preview and organize images
- Automatic optimization

### Themes
- Light and dark mode support
- Customizable styles
- Responsive design

## Security Features

- Rate limiting
- Input validation
- Secure file handling
- CORS protection
- XSS prevention

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/AmazingFeature`
3. Commit your changes: `git commit -m 'Add some AmazingFeature'`
4. Push to the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenAI for GPT and DALL-E APIs
- Cloudinary for image hosting
- Express.js framework
- Node.js community
