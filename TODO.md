# Image Generator Fix Plan

## Steps
1. [x] Kill all node processes
2. [ ] Fix syntax in backend/src/models/User.js (wrap require alias in ())
3. [ ] Fix imageController.js credit/token method names
4. [ ] Start backend: cd backend && npm run dev
5. [ ] Verify http://localhost:5000/api/health
6. [ ] Ensure frontend running: cd frontend && npm start
7. [ ] Test demo login and image generation
8. [ ] Verify credits deduct only after successful generation
9. [ ] Add error logging in imageGenerator if needed

## Current Status
- Backend crashing on User.js syntax 'as' identifier
- Frontend running

