const https = require('https');
const fs = require('fs');
const path = require('path');

function downloadFile(url, outputPath) {
  const file = fs.createWriteStream(outputPath);

  https.get(url, (response) => {
    if (response.statusCode === 200) {
      response.pipe(file);
    } else {
      console.error(`Failed to get '${url}' (${response.statusCode})`);
    }

    file.on('finish', () => {
      file.close();
      console.log('Download completed.');
    });
  }).on('error', (err) => {
    fs.unlink(outputPath, () => {}); // Delete the file async. (But we don't check the result)
    console.error(`Error downloading the file: ${err.message}`);
  });
}

// Example usage:
const url = 'https://lex-usecases-templates.s3.amazonaws.com/airlines.yaml';
const outputPath = path.join(__dirname, '../lib/airlines.yaml');

downloadFile(url, outputPath);
