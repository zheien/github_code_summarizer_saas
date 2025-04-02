const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();

// Load environment variables
dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());

// GitHub API credentials from environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Log environment variables (without exposing the full keys)
console.log('Environment check:');
console.log('GitHub Token exists:', !!GITHUB_TOKEN);

// GitHub API request to fetch code content from a repository
async function getFileContent(owner, repo, filePath) {
  try {
    console.log(`Fetching content for ${owner}/${repo}/${filePath}`);
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
      },
    });
    console.log('GitHub API response received');
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (error) {
    console.error('GitHub API Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
    throw new Error(`GitHub API Error: ${error.response?.data?.message || error.message}`);
  }
}

// Ollama API request to generate code summary
async function generateSummary(codeSnippet) {
  try {
    console.log('Sending request to Ollama API');
    
    // Generate overview
    const overviewResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2',
      prompt: `Provide a brief 2-3 sentence overview of what this code does:

${codeSnippet}`,
      stream: false
    });

    // Generate key components
    const componentsResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2',
      prompt: `List the main components, functions, or classes in this code. Keep it concise and bullet-pointed:

${codeSnippet}`,
      stream: false
    });

    // Generate technical details
    const technicalResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2',
      prompt: `What are the key technical aspects, patterns, or notable implementation details in this code? Keep it focused on technical specifics:

${codeSnippet}`,
      stream: false
    });

    console.log('Ollama API responses received');
    
    return {
      overview: overviewResponse.data.response.trim(),
      keyComponents: componentsResponse.data.response.trim(),
      technicalDetails: technicalResponse.data.response.trim()
    };
  } catch (error) {
    console.error('Ollama API Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    throw new Error(`Ollama API Error: ${error.message}`);
  }
}

// API endpoint to summarize code
app.post('/summarize-code', async (req, res) => {
  const { codeBlock, owner, repo, filePath } = req.body;
  
  try {
    let codeToSummarize;
    
    // If repository details are provided, fetch the file content
    if (owner && repo && filePath) {
      console.log(`Fetching content for ${owner}/${repo}/${filePath}`);
      codeToSummarize = await getFileContent(owner, repo, filePath);
    } else if (codeBlock) {
      // If code block is provided, use it directly
      codeToSummarize = codeBlock;
    } else {
      return res.status(400).json({ error: 'Please provide either a code block or repository file details' });
    }

    console.log('Generating summary for code content');
    const summary = await generateSummary(codeToSummarize);
    res.json(summary);
  } catch (error) {
    console.error('Error in /summarize-code:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to search repositories
app.get('/search-repos', async (req, res) => {
  const { query, minStars, language, sort, license, hasIssues, hasWiki, hasGoodFirstIssues, isOpenSource } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    let searchQuery = query;
    
    // Add filters to the search query
    if (minStars) {
      searchQuery += ` stars:>=${minStars}`;
    }
    if (language) {
      searchQuery += ` language:${language}`;
    }
    if (license) {
      searchQuery += ` license:${license}`;
    }
    if (hasIssues === 'true') {
      searchQuery += ' has:issues';
    }
    if (hasWiki === 'true') {
      searchQuery += ' has:wiki';
    }
    if (hasGoodFirstIssues === 'true') {
      searchQuery += ' label:good-first-issue';
    }
    if (isOpenSource === 'true') {
      searchQuery += ' topic:open-source';
    }

    const response = await axios.get(`https://api.github.com/search/repositories`, {
      params: {
        q: searchQuery,
        sort: sort || 'stars',
        order: 'desc',
      },
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in /search-repos:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
