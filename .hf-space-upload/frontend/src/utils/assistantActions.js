const ASSISTANT_PENDING_ACTION_STORAGE_KEY = 'ai-helpper-pending-action';
export const ASSISTANT_ACTION_EVENT_NAME = 'ai-helpper:action';

const trimText = (value = '') => String(value).trim();

const createActionId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `assistant-action-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const sanitizeAction = (action = {}) => {
  const normalizedType = trimText(action.type);
  if (!normalizedType) {
    return null;
  }

  return {
    id: trimText(action.id) || createActionId(),
    type: normalizedType,
    route: trimText(action.route),
    tab: trimText(action.tab),
    prompt: trimText(action.prompt),
    ratio: trimText(action.ratio),
    quality: trimText(action.quality),
    autoRun: action.autoRun !== false,
    createdAt: action.createdAt || new Date().toISOString(),
  };
};

export const readPendingAssistantAction = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ASSISTANT_PENDING_ACTION_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    return sanitizeAction(JSON.parse(rawValue));
  } catch (error) {
    return null;
  }
};

export const clearPendingAssistantAction = (actionId = '') => {
  if (typeof window === 'undefined') {
    return;
  }

  const currentAction = readPendingAssistantAction();
  if (!currentAction) {
    return;
  }

  if (!actionId || currentAction.id === actionId) {
    window.localStorage.removeItem(ASSISTANT_PENDING_ACTION_STORAGE_KEY);
  }
};

export const dispatchAssistantAction = (action = {}) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const nextAction = sanitizeAction(action);
  if (!nextAction) {
    return null;
  }

  window.localStorage.setItem(
    ASSISTANT_PENDING_ACTION_STORAGE_KEY,
    JSON.stringify(nextAction)
  );

  window.dispatchEvent(new CustomEvent(ASSISTANT_ACTION_EVENT_NAME, {
    detail: nextAction,
  }));

  return nextAction;
};
