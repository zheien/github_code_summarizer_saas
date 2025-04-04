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
  if (!owner || !repo || !filePath) {
    throw new Error('Invalid arguments: owner, repo, and filePath are required');
  }
  try {
    console.log(`Fetching content for ${owner}/${repo}/${filePath}`);
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
      },
    });

    if (!response.data) {
      throw new Error('Invalid response from GitHub API: Response data is missing');
    }

    if (response.data.type === 'submodule') {
      console.warn(`Skipping submodule: ${filePath} (submodules are not supported)`);
      return ''; // Return an empty string for submodules
    }

    if (response.data.type !== 'file') {
      console.error('GitHub API Response:', response.data);
      throw new Error(`Invalid response from GitHub API: Expected a file but received a ${response.data.type}`);
    }

    if (!response.data.content) {
      console.error('GitHub API Response:', response.data);
      if (response.data.size === 0) {
        throw new Error(`The file at ${filePath} is empty.`);
      }
      throw new Error('Invalid response from GitHub API: Missing content field');
    }

    console.log('GitHub API response received');
    return Buffer.from(response.data.content, 'base64').toString('utf-8');
  } catch (error) {
    console.error('GitHub API Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
    });
    throw new Error(`GitHub API Error: ${error.response?.data?.message || error.message}`);
  }
}

// Helper function to check if a file is a priority file
function isPriorityFile(filePath) {
  const priorityFiles = [
    'README.md', 'project_description.txt', 'overview.md', 'SUMMARY.md',
    'main.py', 'index.js', 'setup.py', 'package.json', 'pubspec.yaml',
    'requirements.txt', '.project'
  ];
  const priorityFolders = ['docs/'];

  const isPriorityFile = priorityFiles.some(priority => filePath.endsWith(priority));
  const isInPriorityFolder = priorityFolders.some(folder => filePath.startsWith(folder));
  return isPriorityFile || isInPriorityFolder;
}

// Helper function to fetch all files recursively from a repository
async function getAllFiles(owner, repo, path = '') {
  if (!owner || !repo) {
    throw new Error('Invalid arguments: owner and repo are required');
  }
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
      },
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid response from GitHub API: Expected an array of files');
    }

    let files = [];
    for (const item of response.data) {
      if (item.type === 'file' && isPriorityFile(item.path)) {
        files.push(item.path);
      } else if (item.type === 'dir') {
        const subFiles = await getAllFiles(owner, repo, item.path);
        files = files.concat(subFiles);
      } else if (item.type === 'submodule') {
        console.warn(`Skipping submodule: ${item.path} (submodules are not supported)`);
      } else {
        console.warn(`Skipping unsupported or non-priority type: ${item.type} at ${item.path}`);
      }
    }
    return files;
  } catch (error) {
    console.error('Error fetching all files:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });
    throw new Error('Failed to fetch all files from the repository');
  }
}

// Helper function to filter and prioritize specific files and folders
function filterPriorityFiles(files) {
  const priorityFiles = [
    'README.md', 'project_description.txt', 'overview.md', 'SUMMARY.md',
    'main.py', 'index.js', 'setup.py', 'package.json', 'pubspec.yaml',
    'requirements.txt', '.project'
  ];
  const priorityFolders = ['docs/'];

  // Filter files to include only priority files and folders
  const filteredFiles = files.filter(file => {
    const isPriorityFile = priorityFiles.some(priority => file.endsWith(priority));
    const isInPriorityFolder = priorityFolders.some(folder => file.startsWith(folder));
    return isPriorityFile || isInPriorityFolder;
  });

  return filteredFiles;
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
      prompt: `What are the key technical aspects, patterns, or notable implementation details in this code? 
      Keep it focused on technical specifics:

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

// Update the summarize-code endpoint to validate inputs
app.post('/summarize-code', async (req, res) => {
  const { codeBlock, owner, repo, filePath, summarizeAll } = req.body;

  if (!codeBlock && !(owner && repo) && !summarizeAll) {
    return res.status(400).json({ error: 'Invalid request: Provide a code block or repository details' });
  }

  try {
    let codeToSummarize = '';
    const skippedFiles = []; // Track skipped files

    if (summarizeAll && owner && repo) {
      console.log(`Fetching all files for ${owner}/${repo}`);
      const allFiles = await getAllFiles(owner, repo);
      for (const file of allFiles) {
        try {
          const fileContent = await getFileContent(owner, repo, file);
          codeToSummarize += `\n\n// File: ${file}\n${fileContent}`;
        } catch (error) {
          if (error.message.includes('empty') || error.message.includes('Missing content field')) {
            console.warn(`Skipping file: ${file} - ${error.message}`);
            skippedFiles.push(file);
          } else {
            throw error;
          }
        }
      }
    } else if (owner && repo && filePath) {
      console.log(`Fetching content for ${owner}/${repo}/${filePath}`);
      codeToSummarize = await getFileContent(owner, repo, filePath);
    } else if (codeBlock) {
      codeToSummarize = codeBlock;
    } else {
      throw new Error('Invalid input: Unable to determine code to summarize');
    }

    console.log('Generating summary for code content');
    const summary = await generateSummary(codeToSummarize);

    // Include skipped files in the response if any
    res.json({ ...summary, skippedFiles });
  } catch (error) {
    console.error('Error in /summarize-code:', error);

    if (error.message.includes('Missing content field')) {
      return res.status(400).json({ error: 'The requested file is empty or its content could not be retrieved from GitHub.' });
    }

    res.status(500).json({ error: error.message });
  }
});

app.post('/summarize-priority-files', async (req, res) => {
  const { owner, repo } = req.body;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Invalid request: Provide repository owner and name' });
  }

  try {
    console.log(`Fetching all files for ${owner}/${repo}`);
    const allFiles = await getAllFiles(owner, repo);
    const priorityFiles = filterPriorityFiles(allFiles);

    if (priorityFiles.length === 0) {
      return res.status(404).json({ error: 'No priority files or folders found in the repository' });
    }

    let codeToSummarize = '';
    const skippedFiles = [];

    for (const file of priorityFiles) {
      try {
        const fileContent = await getFileContent(owner, repo, file);
        codeToSummarize += `\n\n// File: ${file}\n${fileContent}`;
      } catch (error) {
        if (error.message.includes('empty') || error.message.includes('Missing content field')) {
          console.warn(`Skipping file: ${file} - ${error.message}`);
          skippedFiles.push(file);
        } else {
          throw error;
        }
      }
    }

    console.log('Generating summary for priority files');
    const summary = await generateSummary(codeToSummarize);

    res.json({ ...summary, skippedFiles });
  } catch (error) {
    console.error('Error in /summarize-priority-files:', error);
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
