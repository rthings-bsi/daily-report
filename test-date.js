const assert = require('assert');

// Simulate the issue
const history = [
  { reportSessionId: '2', label: '2023-01-02' },
  { reportSessionId: '1', label: '2023-01-01' }
];

let activeSessionId = '2';

// React component roughly does this
function renderSelect() {
  return `<select value="${activeSessionId}" onChange="loadSession(val)">...`
}

