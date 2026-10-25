import { detectPlan } from './detector.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ id: data.id, result: detectPlan(data.image, data.options) }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
