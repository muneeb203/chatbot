const { getEmbeddings, generateEmbeddings } = require('./embeddings');

/**
 * Calculate cosine similarity between two vectors
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Cosine similarity score
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieve relevant context chunks for a query
 * @param {string} query - User query
 * @param {number} topK - Number of top results to return
 * @returns {Promise<string>} Concatenated context string
 */
async function retrieveContext(query, topK = 3) {
  try {
    // Get query embedding
    const queryEmbeddings = await generateEmbeddings([query]);
    const queryEmbedding = queryEmbeddings[0];
    
    // Get all stored embeddings
    const embeddings = await getEmbeddings();
    
    // Calculate similarities
    const similarities = embeddings.map((item, index) => ({
      index,
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
      text: item.text,
      source: item.source
    }));
    
    // Sort by similarity and get top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);
    
    // Concatenate context
    const context = topResults
      .map(result => `[Source: ${result.source}]\n${result.text}`)
      .join('\n\n---\n\n');
    
    return context;
  } catch (error) {
    console.error('Error retrieving context:', error);
    return '';
  }
}

module.exports = { retrieveContext };
