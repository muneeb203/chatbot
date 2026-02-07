// In-memory session storage
const sessions = new Map();

const MAX_MESSAGES_PER_SESSION = 20;

/**
 * Get conversation history for a session
 * @param {string} sessionId - Session identifier
 * @returns {Array<{role: string, content: string}>} Message history
 */
function getSessionHistory(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

/**
 * Add message to session history
 * @param {string} sessionId - Session identifier
 * @param {string} role - Message role (user/assistant)
 * @param {string} content - Message content
 */
function addMessage(sessionId, role, content) {
  const history = getSessionHistory(sessionId);
  history.push({ role, content });
  
  // Keep only last MAX_MESSAGES_PER_SESSION messages
  if (history.length > MAX_MESSAGES_PER_SESSION) {
    history.shift();
  }
  
  sessions.set(sessionId, history);
}

/**
 * Clear session history
 * @param {string} sessionId - Session identifier
 */
function clearSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Get total number of active sessions
 * @returns {number} Number of sessions
 */
function getSessionCount() {
  return sessions.size;
}

module.exports = {
  getSessionHistory,
  addMessage,
  clearSession,
  getSessionCount
};
