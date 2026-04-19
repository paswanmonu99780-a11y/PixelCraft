let databaseReady = false;

const normalizeEnvFlag = (value) => String(value || '').toLowerCase() === 'true';

const setDatabaseReady = (isReady) => {
  databaseReady = Boolean(isReady);
};

const isDatabaseReady = () => databaseReady;

const shouldUseMemoryStore = () => normalizeEnvFlag(process.env.USE_MEMORY_DB) || !databaseReady;

module.exports = {
  isDatabaseReady,
  setDatabaseReady,
  shouldUseMemoryStore,
};
