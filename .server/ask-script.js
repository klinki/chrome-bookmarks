const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const BASE_DIR = '/var/www';
const PORT = 5555;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // Caddy sends a GET request with a 'domain' query parameter
  if (parsedUrl.pathname === '/check' && req.method === 'GET') {
    const domain = parsedUrl.query.domain;

    if (!domain) {
      res.statusCode = 400;
      res.end('Missing domain parameter');
      return;
    }

    console.log(`Checking domain: ${domain}`);

    // Parse the domain to extract project and folder
    // Expected format: {pr-number}.{project}.github.klinki.cz
    const parts = domain.split('.');

    // We expect at least 5 parts: pr-XX, project, github, klinki, cz
    if (parts.length < 5) {
      console.log(`Invalid domain format: ${domain}`);
      res.statusCode = 403; // Forbidden
      res.end('Invalid domain format');
      return;
    }

    // Right-to-left indexing matches Caddy labels
    // cz (0), klinki (1), github (2) are base
    // project is index 3 from right (length-4)
    // pr-number is index 4 from right (length-5)

    const project = parts[parts.length - 4];
    const prFolder = parts[parts.length - 5];

    // Validate simple alphanumeric to prevent traversal
    const safeNameRegex = /^[a-zA-Z0-9-_]+$/;
    if (!safeNameRegex.test(project) || !safeNameRegex.test(prFolder)) {
        console.log(`Invalid characters in project or prFolder: ${project}/${prFolder}`);
        res.statusCode = 403;
        res.end('Invalid characters');
        return;
    }

    const dirPath = path.join(BASE_DIR, project, prFolder);

    fs.access(dirPath, fs.constants.F_OK, (err) => {
      if (err) {
        console.log(`Directory not found: ${dirPath}`);
        res.statusCode = 404; // Not Found - Caddy will not issue cert
        res.end('Domain not provisioned');
      } else {
        console.log(`Directory verified: ${dirPath}`);
        res.statusCode = 200; // OK - Caddy will issue cert
        res.end('OK');
      }
    });

  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Ask script listening on port ${PORT}`);
});
