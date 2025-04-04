import React, { useState } from 'react';
import axios from 'axios';
import {
  Container,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Box,
  AppBar,
  Toolbar,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CodeIcon from '@mui/icons-material/Code';
import GitHubIcon from '@mui/icons-material/GitHub';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

function App() {
  const [mode, setMode] = useState('code'); // 'code' or 'repo'
  const [query, setQuery] = useState('');
  const [repos, setRepos] = useState([]);
  const [codeSummary, setCodeSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [files, setFiles] = useState([]);
  const [fileContent, setFileContent] = useState('');
  const [codeBlock, setCodeBlock] = useState('');
  const [filters, setFilters] = useState({
    minStars: 0,
    language: '',
    sort: 'stars',
    license: '',
    hasIssues: false,
    hasWiki: false,
    hasGoodFirstIssues: false,
    isOpenSource: false,
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const handleModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
      setCodeBlock('');
      setQuery('');
      setRepos([]);
      setSelectedRepo(null);
      setFiles([]);
      setFileContent('');
      setCodeSummary(null);
      setError('');
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setSearching(true);
    setError('');
    try {
      const response = await axios.get('http://localhost:5001/search-repos', {
        params: {
          query: query,
          minStars: filters.minStars,
          language: filters.language,
          sort: filters.sort,
          license: filters.license,
          hasIssues: filters.hasIssues,
          hasWiki: filters.hasWiki,
          hasGoodFirstIssues: filters.hasGoodFirstIssues,
          isOpenSource: filters.isOpenSource
        }
      });
      setRepos(response.data.items);
    } catch (error) {
      setError('Failed to fetch repositories. Please try again.');
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleRepoSelect = async (repo) => {
    setSelectedRepo(repo);
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/contents`);
      setFiles(response.data.filter(item => item.type === 'file'));
    } catch (error) {
      setError('Failed to fetch repository files. Please try again.');
      console.error('File fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(file.download_url);
      setFileContent(response.data);
      setCodeBlock('');
      setSelectedFile(file);

      // Generate summary for the selected file
      const summaryResponse = await axios.post('http://localhost:5001/summarize-code', {
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        filePath: file.path,
      });

      if (summaryResponse && summaryResponse.data) {
        setCodeSummary({
          overview: summaryResponse.data.overview,
          keyComponents: summaryResponse.data.keyComponents,
          technicalDetails: summaryResponse.data.technicalDetails,
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      if (error.response?.data?.error?.includes('empty or its content could not be retrieved')) {
        setError('The selected file is empty or its content could not be retrieved.');
      } else {
        setError('Failed to fetch file content or generate summary. Please try again.');
      }
      console.error('File content error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!codeBlock.trim()) {
      setError('Please enter a code block to summarize');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5001/summarize-code', {
        codeBlock: codeBlock.trim()
      });
      
      if (response && response.data) {
        setCodeSummary({
          overview: response.data.overview,
          keyComponents: response.data.keyComponents,
          technicalDetails: response.data.technicalDetails
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      setError('Failed to generate summary. Please try again.');
      console.error('Summarize error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarizeAll = async () => {
    if (!selectedRepo) {
      setError('Please select a repository to summarize all files');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5001/summarize-code', {
        owner: selectedRepo.owner.login,
        repo: selectedRepo.name,
        summarizeAll: true,
      });

      if (response && response.data) {
        setCodeSummary({
          overview: response.data.overview,
          keyComponents: response.data.keyComponents,
          technicalDetails: response.data.technicalDetails,
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      if (error.response?.data?.error?.includes('empty or its content could not be retrieved')) {
        setError('One or more files in the repository are empty or their content could not be retrieved. These files were skipped.');
      } else {
        setError('Failed to summarize all files. Please try again.');
      }
      console.error('Summarize all error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const formatSummary = (summary) => {
    const formatText = (text) => {
      return text
        .replace(/\*\*(.*?)\*\*/g, (_, text) => `\n\n${text.toUpperCase()}\n`) // Convert **bold** to uppercase headings
        .replace(/\*(.*?)\*/g, (_, text) => `- ${text}`) // Convert *bullet points* to proper bullet points
        .replace(/## (.*?)\n/g, (_, text) => `\n\n${text.toUpperCase()}\n`) // Convert ## headings to uppercase
        .replace(/# (.*?)\n/g, (_, text) => `\n\n${text.toUpperCase()}\n`); // Convert # headings to uppercase
    };

    return (
      <Box sx={{ maxHeight: '400px', overflow: 'auto', p: 2 }}>
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="overview-content"
            id="overview-header"
          >
            <Typography variant="subtitle1">Overview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography paragraph sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
              {formatText(summary.overview)}
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="key-components-content"
            id="key-components-header"
          >
            <Typography variant="subtitle1">Key Components</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography paragraph sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
              {formatText(summary.keyComponents)}
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="technical-details-content"
            id="technical-details-header"
          >
            <Typography variant="subtitle1">Technical Details</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography paragraph sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
              {formatText(summary.technicalDetails)}
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Code Summarizer
          </Typography>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={handleModeChange}
            aria-label="mode"
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: 'white !important',
                backgroundColor: '#2196f3',
                '&.Mui-selected': {
                  backgroundColor: '#1976d2',
                  color: 'white !important',
                  '&:hover': {
                    backgroundColor: '#1565c0',
                  },
                },
                '&:hover': {
                  backgroundColor: '#42a5f5',
                },
                '&:not(.Mui-selected)': {
                  backgroundColor: '#64b5f6',
                  color: 'white !important',
                },
              },
            }}
          >
            <ToggleButton value="code" aria-label="code mode">
              <CodeIcon sx={{ mr: 1 }} />
              Code Block
            </ToggleButton>
            <ToggleButton value="repo" aria-label="repository mode">
              <GitHubIcon sx={{ mr: 1 }} />
              GitHub Repo
            </ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Grid container spacing={3}>
          {/* Left column - Input */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              {mode === 'code' ? (
                <>
                  <Typography variant="h6" gutterBottom>
                    Enter Code Block
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={15}
                    value={codeBlock}
                    onChange={(e) => setCodeBlock(e.target.value)}
                    placeholder="Paste your code block here..."
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSummarize}
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? <CircularProgress size={24} /> : 'Generate Summary'}
                  </Button>
                </>
              ) : (
                <>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a repository"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  disabled={searching}
                  startIcon={searching ? <CircularProgress size={20} /> : <SearchIcon />}
                >
                  Search
                </Button>
              </Box>

              {/* Filters */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Filters
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={filters.language}
                        label="Language"
                        onChange={(e) => handleFilterChange('language', e.target.value)}
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="javascript">JavaScript</MenuItem>
                        <MenuItem value="python">Python</MenuItem>
                        <MenuItem value="java">Java</MenuItem>
                        <MenuItem value="cpp">C++</MenuItem>
                        <MenuItem value="go">Go</MenuItem>
                        <MenuItem value="rust">Rust</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Sort By</InputLabel>
                      <Select
                        value={filters.sort}
                        label="Sort By"
                        onChange={(e) => handleFilterChange('sort', e.target.value)}
                      >
                        <MenuItem value="stars">Stars</MenuItem>
                        <MenuItem value="forks">Forks</MenuItem>
                        <MenuItem value="updated">Updated</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Minimum Stars: {filters.minStars}
                    </Typography>
                    <Slider
                      value={filters.minStars}
                      onChange={(e, value) => handleFilterChange('minStars', value)}
                      min={0}
                      max={100000}
                      step={1000}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>License</InputLabel>
                      <Select
                        value={filters.license}
                        label="License"
                        onChange={(e) => handleFilterChange('license', e.target.value)}
                      >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="mit">MIT</MenuItem>
                        <MenuItem value="apache-2.0">Apache 2.0</MenuItem>
                        <MenuItem value="gpl-3.0">GPL 3.0</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Repository Features
                    </Typography>
                    <FormGroup>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={filters.hasIssues}
                              onChange={(e) => handleFilterChange('hasIssues', e.target.checked)}
                            />
                          }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                Has Any Issues
                                <Tooltip title="Check if the repository has any issues (bug reports, feature requests, etc.)">
                                  <HelpOutlineIcon fontSize="small" sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Tooltip>
                              </Box>
                            }
                          />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={filters.hasWiki}
                              onChange={(e) => handleFilterChange('hasWiki', e.target.checked)}
                            />
                          }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                Has Wiki
                                <Tooltip title="Check if the repository has issues specifically tagged for beginners">
                                  <HelpOutlineIcon fontSize="small" sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Tooltip>
                              </Box>
                            }
                          />
                    </FormGroup>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Contributor-Friendly
                    </Typography>
                    <FormGroup>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={filters.hasGoodFirstIssues}
                              onChange={(e) => handleFilterChange('hasGoodFirstIssues', e.target.checked)}
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              Has Good First Issues
                              <Tooltip title="These are issues specifically marked as suitable for newcomers to the project">
                                <HelpOutlineIcon fontSize="small" sx={{ fontSize: 16, color: 'text.secondary' }} />
                              </Tooltip>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={filters.isOpenSource}
                              onChange={(e) => handleFilterChange('isOpenSource', e.target.checked)}
                            />
                          }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                Open Source Project
                                <Tooltip title="Find repositories that are explicitly marked as open source projects">
                                  <HelpOutlineIcon fontSize="small" sx={{ fontSize: 16, color: 'text.secondary' }} />
                                </Tooltip>
                              </Box>
                            }
                          />
                    </FormGroup>
                  </Grid>
                </Grid>
              </Box>

              <List sx={{ maxHeight: 'calc(100vh - 600px)', overflow: 'auto' }}>
                {repos.map((repo) => (
                  <ListItem
                    key={repo.id}
                    button
                        onClick={() => handleRepoSelect(repo)}
                  >
                    <ListItemText
                      primary={repo.name}
                      secondary={
                        <>
                          {repo.owner.login} - {repo.description || 'No description'}
                          <br />
                          Stars: {repo.stargazers_count} | Language: {repo.language || 'Unknown'}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>

                  {selectedRepo && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Files in {selectedRepo.name}
                      </Typography>
                      <List sx={{ maxHeight: '300px', overflow: 'auto' }}>
                        {files.map((file) => (
                          <ListItem
                            key={file.sha}
                            button
                            onClick={() => handleFileSelect(file)}
                          >
                            <ListItemText
                              primary={file.name}
                              secondary={`Size: ${(file.size / 1024).toFixed(2)} KB`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {fileContent && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        File Content
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        rows={10}
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        variant="outlined"
                        sx={{ mb: 2 }}
                      />
                    </Box>
                  )}

                  {mode === 'repo' && selectedRepo && (
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={handleSummarizeAll}
                      disabled={loading}
                      sx={{ mt: 2 }}
                    >
                      {loading ? <CircularProgress size={24} /> : 'Summarize All Files'}
                    </Button>
                  )}
                </>
              )}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </Paper>
          </Grid>

          {/* Right column - Code Summary */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Code Summary
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : codeSummary ? (
                formatSummary(codeSummary)
              ) : (
                <Typography color="text.secondary">
                  {mode === 'code' 
                    ? 'Enter a code block to generate a summary'
                    : 'Search for a repository or select a file to generate a summary'}
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default App;
