# GitHub Code Summarizer

A web application that allows users to search GitHub repositories and view code summaries. Built with React, Node.js, and the GitHub API.

## Features

- Search GitHub repositories
- View repository contents
- Display file contents
- Modern, responsive UI with Material-UI
- Dark mode support

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- GitHub API token

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/github-code-summarizer.git
cd github-code-summarizer
```

2. Set up the backend:
```bash
cd backend
npm install
```

3. Create a `.env` file in the backend directory with your GitHub API token:
```
GITHUB_TOKEN=your_github_token_here
PORT=5001
```

4. Set up the frontend:
```bash
cd ../frontend
npm install
```

## Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. In a new terminal, start the frontend development server:
```bash
cd frontend
npm start
```

3. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
github-code-summarizer/
├── backend/
│   ├── node_modules/
│   ├── .env
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.js
│   └── package.json
└── README.md
```

## Technologies Used

- Frontend:
  - React
  - Material-UI
  - React Router
  - Axios

- Backend:
  - Node.js
  - Express
  - GitHub API
  - CORS

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 