const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const STORE_FILE_PATH = isProduction
  ? path.join('/data', 'assistant-memory-store.json')
  : path.join(__dirname, 'assistant-memory-store.json');
const MAX_NOTES_PER_PROFILE = 24;

const state = {
  profiles: {},
};

const trimText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const normalizeMemoryKey = (memoryKey = '') => trimText(memoryKey).slice(0, 120);

const normalizeProfile = (profile = {}) => ({
  notes: Array.isArray(profile.notes)
    ? profile.notes
        .map((note) => ({
          content: trimText(note?.content).slice(0, 280),
          source: trimText(note?.source) || 'user-message',
          createdAt: note?.createdAt || new Date().toISOString(),
          updatedAt: note?.updatedAt || note?.createdAt || new Date().toISOString(),
        }))
        .filter((note) => note.content)
        .slice(0, MAX_NOTES_PER_PROFILE)
    : [],
  updatedAt: profile.updatedAt || '',
});

const loadStore = () => {
  try {
    if (!fs.existsSync(STORE_FILE_PATH)) {
      return;
    }

    const rawStore = fs.readFileSync(STORE_FILE_PATH, 'utf8');
    if (!rawStore.trim()) {
      return;
    }

    const parsedStore = JSON.parse(rawStore);
    if (!parsedStore || typeof parsedStore !== 'object') {
      return;
    }

    state.profiles = Object.entries(parsedStore.profiles || {}).reduce((result, [memoryKey, profile]) => {
      const normalizedKey = normalizeMemoryKey(memoryKey);
      if (!normalizedKey) {
        return result;
      }

      result[normalizedKey] = normalizeProfile(profile);
      return result;
    }, {});
  } catch (error) {
    console.error('Could not load assistant memory store:', error.message);
  }
};

const saveStore = () => {
  try {
    fs.writeFileSync(
      STORE_FILE_PATH,
      JSON.stringify({ profiles: state.profiles }, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error('Could not save assistant memory store:', error.message);
  }
};

loadStore();

const ensureProfile = (memoryKey = '') => {
  const normalizedKey = normalizeMemoryKey(memoryKey);
  if (!normalizedKey) {
    return null;
  }

  if (!state.profiles[normalizedKey]) {
    state.profiles[normalizedKey] = normalizeProfile();
  }

  return {
    key: normalizedKey,
    profile: state.profiles[normalizedKey],
  };
};

const listNotes = (memoryKey = '') => {
  const normalizedKey = normalizeMemoryKey(memoryKey);
  if (!normalizedKey) {
    return [];
  }

  return normalizeProfile(state.profiles[normalizedKey]).notes;
};

const rememberNote = ({ memoryKey = '', content = '', source = 'user-message' } = {}) => {
  const memoryProfile = ensureProfile(memoryKey);
  const normalizedContent = trimText(content).slice(0, 280);

  if (!memoryProfile || !normalizedContent) {
    return null;
  }

  const now = new Date().toISOString();
  const { profile } = memoryProfile;
  const existingIndex = profile.notes.findIndex(
    (note) => note.content.toLowerCase() === normalizedContent.toLowerCase()
  );
  const previousEntry = existingIndex >= 0 ? profile.notes[existingIndex] : null;

  const nextNote = {
    content: normalizedContent,
    source: trimText(source) || 'user-message',
    createdAt: previousEntry?.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    profile.notes.splice(existingIndex, 1);
  }

  profile.notes.unshift(nextNote);
  profile.notes = profile.notes.slice(0, MAX_NOTES_PER_PROFILE);
  profile.updatedAt = now;
  saveStore();

  return nextNote;
};

module.exports = {
  listNotes,
  rememberNote,
};
