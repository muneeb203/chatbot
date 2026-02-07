const fs = require('fs');
const path = require('path');
const { getOpenAIClient } = require('./openai');

// In-memory storage for embeddings
let embeddingsCache = null;

/**
 * Chunk text into smaller pieces with overlap
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Size of each chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<string>} Array of text chunks
 */
function chunkText(text, chunkSize = 800, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Load all .txt files from data directory
 * @returns {Array<{filename: string, content: string}>}
 */
function loadDataFiles() {
  const dataDir = path.join(process.cwd(), 'data');
  const files = [];
  
  try {
    const fileNames = fs.readdirSync(dataDir);
    
    for (const fileName of fileNames) {
      if (fileName.endsWith('.txt')) {
        const filePath = path.join(dataDir, fileName);
        const content = fs.readFileSync(filePath, 'utf-8');
        files.push({ filename: fileName, content });
      }
    }
  } catch (error) {
    console.error('Error loading data files:', error);
  }
  
  return files;
}

/**
 * Generate embeddings for text chunks
 * @param {Array<string>} texts - Array of text chunks
 * @returns {Promise<Array<Array<number>>>} Array of embeddings
 */
async function generateEmbeddings(texts) {
  const openai = getOpenAIClient();
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Initialize embeddings from data files
 * @returns {Promise<Array<{text: string, embedding: Array<number>, source: string}>>}
 */
async function initializeEmbeddings() {
  if (embeddingsCache) {
    return embeddingsCache;
  }
  
  console.log('Initializing embeddings...');
  const dataFiles = loadDataFiles();
  const allChunks = [];
  
  // Chunk all files
  for (const file of dataFiles) {
    const chunks = chunkText(file.content);
    chunks.forEach(chunk => {
      allChunks.push({
        text: chunk,
        source: file.filename
      });
    });
  }
  
  console.log(`Processing ${allChunks.length} chunks from ${dataFiles.length} files`);
  
  // Generate embeddings in batches to avoid rate limits
  const batchSize = 100;
  const embeddings = [];
  
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const batchTexts = batch.map(chunk => chunk.text);
    const batchEmbeddings = await generateEmbeddings(batchTexts);
    embeddings.push(...batchEmbeddings);
  }
  
  // Combine chunks with embeddings
  embeddingsCache = allChunks.map((chunk, index) => ({
    text: chunk.text,
    embedding: embeddings[index],
    source: chunk.source
  }));
  
  console.log('Embeddings initialized successfully');
  return embeddingsCache;
}

/**
 * Get cached embeddings (initialize if needed)
 * @returns {Promise<Array<{text: string, embedding: Array<number>, source: string}>>}
 */
async function getEmbeddings() {
  if (!embeddingsCache) {
    await initializeEmbeddings();
  }
  return embeddingsCache;
}

module.exports = {
  initializeEmbeddings,
  getEmbeddings,
  generateEmbeddings
};
